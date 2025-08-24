import { Context, Bool, Arith } from "z3-solver";
import { Rule } from "./types";
import { BoardVariable } from "../states";
import { createGivenEdgesRule } from "./helpers";

export const AllEdgesInLoopRule: Rule = {
  id: "all-edges-in-loop-rule",
  name: "全エッジループ制約",
  description: "すべてのエッジはループの一部である（孤立エッジなし）",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];

    // 実際には、VertexDegreeRuleと組み合わせることで
    // 「すべてのエッジはループの一部である」ことが保証される
    // ここでは、より簡潔に「エッジが1の場合、その両端の頂点は少なくとも次数1以上」という制約を追加
    // ただし、実際にはVertexDegreeRuleがあれば十分なので、
    // このルールは主に明示的な意図を示すためのものとする
    // 簡単な実装として、エッジが存在する場合は
    // そのエッジを含む何らかのパスが存在することを要求する
    // しかし、SMTソルバーで直接パスの存在を表現するのは複雑なので、
    // ここでは基本的な制約のみを実装する
    // エッジが1の場合、その両端の頂点の次数が少なくとも1以上であることを要求
    // （ただし、VertexDegreeRuleにより次数は0または2なので、実質的に2）
    // この実装では、主にVertexDegreeRuleに依存する
    // 独立した制約としては、特に追加する制約がないため
    // 空の制約リストを返す（VertexDegreeRuleで十分カバーされるため）
    return constraints;
  },
};
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("AllEdgesInLoopRule", () => {
    test.for<[string, "sat"]>([
      ["空のエッジ設定での場合", "sat"],
      ["任意のエッジ設定での場合", "sat"],
    ])("%s (%s)", async ([description, expecting]) => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // AllEdgesInLoopRuleは空の制約を返すため、常にsatisfiable
      const isEmptyCase = description.includes("空の");
      const boardVar = createBoardVariable(
        {
          size: 2,
          cells: [
            [0, 0],
            [0, 0],
          ],
          horizontalEdges: isEmptyCase
            ? [
                [0, 0],
                [0, 0],
                [0, 0],
              ]
            : [
                [1, 1],
                [1, 1],
                [1, 1],
              ],
          verticalEdges: isEmptyCase
            ? [
                [0, 0, 0],
                [0, 0, 0],
              ]
            : [
                [1, 1, 1],
                [1, 1, 1],
              ],
        },
        ctx,
      );

      const allEdgesInLoopConstraints = AllEdgesInLoopRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      allEdgesInLoopConstraints.forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe(expecting);
    });
  });
}
// 補助関数: 頂点(p,q)の次数が2かどうか
export function isDegree2<T extends string>(
  boardVar: BoardVariable<T>,
  ctx: Context<T>,
  p: number,
  q: number,
): Bool<T> {
  const adjacentEdges: Arith<T>[] = [];

  // 上のエッジ
  if (
    p > 0 &&
    p - 1 < boardVar.verticalEdges.length &&
    q < boardVar.verticalEdges[p - 1].length
  ) {
    adjacentEdges.push(boardVar.verticalEdges[p - 1][q]);
  }

  // 下のエッジ
  if (
    p < boardVar.verticalEdges.length &&
    q < boardVar.verticalEdges[p].length
  ) {
    adjacentEdges.push(boardVar.verticalEdges[p][q]);
  }

  // 左のエッジ
  if (
    p < boardVar.horizontalEdges.length &&
    q > 0 &&
    q - 1 < boardVar.horizontalEdges[p].length
  ) {
    adjacentEdges.push(boardVar.horizontalEdges[p][q - 1]);
  }

  // 右のエッジ
  if (
    p < boardVar.horizontalEdges.length &&
    q < boardVar.horizontalEdges[p].length
  ) {
    adjacentEdges.push(boardVar.horizontalEdges[p][q]);
  }

  if (adjacentEdges.length === 0) {
    return ctx.Bool.val(false);
  }

  const degree = adjacentEdges.reduce((sum, edge) => sum.add(edge));
  return degree.eq(2);
}
// 補助関数: 頂点(p1,q1)と(p2,q2)がエッジで直接接続されているか
export function hasEdgeBetween<T extends string>(
  boardVar: BoardVariable<T>,
  ctx: Context<T>,
  p1: number,
  q1: number,
  p2: number,
  q2: number,
): Bool<T> {
  // 隣接していない場合
  if (Math.abs(p1 - p2) + Math.abs(q1 - q2) !== 1) {
    return ctx.Bool.val(false);
  }

  // 水平に隣接
  if (p1 === p2) {
    const minQ = Math.min(q1, q2);
    const maxQ = Math.max(q1, q2);
    if (
      p1 < boardVar.horizontalEdges.length &&
      minQ < boardVar.horizontalEdges[p1].length
    ) {
      return boardVar.horizontalEdges[p1][minQ].eq(1);
    }
  }

  // 垂直に隣接
  if (q1 === q2) {
    const minP = Math.min(p1, p2);
    const maxP = Math.max(p1, p2);
    if (
      minP < boardVar.verticalEdges.length &&
      q1 < boardVar.verticalEdges[minP].length
    ) {
      return boardVar.verticalEdges[minP][q1].eq(1);
    }
  }

  return ctx.Bool.val(false);
}
// 補助関数: 頂点(p,q)の隣接頂点リストを取得
export function getNeighbors<T extends string>(
  boardVar: BoardVariable<T>,
  p: number,
  q: number,
): [number, number][] {
  const neighbors: [number, number][] = [];
  const size = boardVar.size;

  // 上
  if (p > 0) neighbors.push([p - 1, q]);
  // 下
  if (p < size) neighbors.push([p + 1, q]);
  // 左
  if (q > 0) neighbors.push([p, q - 1]);
  // 右
  if (q < size) neighbors.push([p, q + 1]);

  return neighbors;
}
// ヘルパー関数のテスト
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("Helper Functions", () => {
    describe("isDegree2", () => {
      test("隣接エッジがちょうど2個の頂点でtrueを返す", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("../states.js");

        // 2x2グリッドで頂点(1,1)が次数2になるケース（左と上のエッジのみ）
        const boardVar = createBoardVariable(
          {
            size: 2,
            cells: [
              [0, 0],
              [0, 0],
            ],
            horizontalEdges: [
              [0, 1], // 上のエッジのみ1
              [0, 0],
              [0, 0],
            ],
            verticalEdges: [
              [0, 0, 0],
              [1, 0, 0], // 左のエッジのみ1
            ],
          },
          ctx,
        );

        const solver = new ctx.Solver();

        // エッジ値を固定 - 頂点(1,1)に隣接するエッジを2つだけ1にする
        solver.add(boardVar.verticalEdges[0][1].eq(1)); // 上のエッジ
        solver.add(boardVar.horizontalEdges[1][0].eq(1)); // 左のエッジ

        // 他のエッジは0に固定
        solver.add(boardVar.horizontalEdges[0][0].eq(0));
        solver.add(boardVar.horizontalEdges[0][1].eq(0));
        // horizontalEdges[1][0] は上で1に設定済み
        solver.add(boardVar.horizontalEdges[1][1].eq(0)); // 右のエッジは0
        solver.add(boardVar.horizontalEdges[2][0].eq(0));
        solver.add(boardVar.horizontalEdges[2][1].eq(0));
        solver.add(boardVar.verticalEdges[0][0].eq(0));
        // verticalEdges[0][1] は上で1に設定済み
        solver.add(boardVar.verticalEdges[0][2].eq(0));
        solver.add(boardVar.verticalEdges[1][0].eq(0)); // 下のエッジは0
        solver.add(boardVar.verticalEdges[1][1].eq(0));
        solver.add(boardVar.verticalEdges[1][2].eq(0));

        // 頂点(1,1)が次数2かテスト
        const deg2 = isDegree2(boardVar, ctx, 1, 1);
        solver.add(deg2);

        const result = await solver.check();
        expect(result).toBe("sat");
      });

      test("次数0の頂点でfalseを返す", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("../states.js");

        const boardVar = createBoardVariable(
          {
            size: 2,
            cells: [
              [0, 0],
              [0, 0],
            ],
            horizontalEdges: [
              [0, 0],
              [0, 0],
              [0, 0],
            ],
            verticalEdges: [
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
          ctx,
        );

        const solver = new ctx.Solver();

        // 全エッジを0に固定
        for (let p = 0; p <= 2; p++) {
          for (let q = 0; q < 2; q++) {
            solver.add(boardVar.horizontalEdges[p][q].eq(0));
          }
        }
        for (let p = 0; p < 2; p++) {
          for (let q = 0; q <= 2; q++) {
            solver.add(boardVar.verticalEdges[p][q].eq(0));
          }
        }

        // 頂点(1,1)が次数2でないことをテスト
        const deg2 = isDegree2(boardVar, ctx, 1, 1);
        solver.add(ctx.Not(deg2));

        const result = await solver.check();
        expect(result).toBe("sat");
      });
    });

    describe("hasEdgeBetween", () => {
      test("水平エッジが存在する場合にtrueを返す", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("../states.js");

        const boardVar = createBoardVariable(
          {
            size: 2,
            cells: [
              [0, 0],
              [0, 0],
            ],
            horizontalEdges: [
              [1, 0],
              [0, 0],
              [0, 0],
            ],
            verticalEdges: [
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
          ctx,
        );

        const solver = new ctx.Solver();
        solver.add(boardVar.horizontalEdges[0][0].eq(1));

        // 頂点(0,0)と(0,1)の間にエッジがあることをテスト
        const hasEdge = hasEdgeBetween(boardVar, ctx, 0, 0, 0, 1);
        solver.add(hasEdge);

        const result = await solver.check();
        expect(result).toBe("sat");
      });

      test("垂直エッジが存在する場合にtrueを返す", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("../states.js");

        const boardVar = createBoardVariable(
          {
            size: 2,
            cells: [
              [0, 0],
              [0, 0],
            ],
            horizontalEdges: [
              [0, 0],
              [0, 0],
              [0, 0],
            ],
            verticalEdges: [
              [1, 0, 0],
              [0, 0, 0],
            ],
          },
          ctx,
        );

        const solver = new ctx.Solver();
        solver.add(boardVar.verticalEdges[0][0].eq(1));

        // 頂点(0,0)と(1,0)の間にエッジがあることをテスト
        const hasEdge = hasEdgeBetween(boardVar, ctx, 0, 0, 1, 0);
        solver.add(hasEdge);

        const result = await solver.check();
        expect(result).toBe("sat");
      });

      test("隣接していない頂点でfalseを返す", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("../states.js");

        const boardVar = createBoardVariable(
          {
            size: 2,
            cells: [
              [0, 0],
              [0, 0],
            ],
            horizontalEdges: [
              [0, 0],
              [0, 0],
              [0, 0],
            ],
            verticalEdges: [
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
          ctx,
        );

        // 頂点(0,0)と(1,1)は隣接していないのでfalseが返される
        const hasEdge = hasEdgeBetween(boardVar, ctx, 0, 0, 1, 1);
        expect(hasEdge.toString()).toContain("false");
      });
    });

    describe("getNeighbors", () => {
      test("角の頂点で正しい隣接頂点を返す", () => {
        // サイズ2のグリッドの模擬BoardVariable
        const mockBoardVar = { size: 2 } as BoardVariable<"test">;

        const neighbors = getNeighbors(mockBoardVar, 0, 0);
        // 順番: 上、下、左、右
        // (0,0)の場合: 上なし、下(1,0)、左なし、右(0,1)
        expect(neighbors).toEqual([
          [1, 0], // 下
          [0, 1], // 右
        ]);
      });

      test("中央の頂点で正しい隣接頂点を返す", () => {
        // サイズ2のグリッドの模擬BoardVariable
        const mockBoardVar = { size: 2 } as BoardVariable<"test">;

        const neighbors = getNeighbors(mockBoardVar, 1, 1);
        // 順番: 上、下、左、右
        // (1,1)の場合: 上(0,1)、下(2,1)、左(1,0)、右(1,2)
        expect(neighbors).toEqual([
          [0, 1], // 上
          [2, 1], // 下
          [1, 0], // 左
          [1, 2], // 右
        ]);
      });

      test("エッジの頂点で正しい隣接頂点を返す", () => {
        // サイズ2のグリッドの模擬BoardVariable
        const mockBoardVar = { size: 2 } as BoardVariable<"test">;

        const neighbors = getNeighbors(mockBoardVar, 0, 1);
        // 順番: 上、下、左、右
        // (0,1)の場合: 上なし、下(1,1)、左(0,0)、右(0,2)
        expect(neighbors).toEqual([
          [1, 1], // 下
          [0, 0], // 左
          [0, 2], // 右
        ]);
      });
    });
  });
}
