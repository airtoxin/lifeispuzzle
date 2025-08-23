import { Context, Bool, Arith } from "z3-solver";
import { isDegree2, getNeighbors, hasEdgeBetween } from "./AllEdgesInLoopRule";
import { Rule } from "./types";
import { BoardVariable } from "../states";
import { createGivenEdgesRule } from "./helpers";
import { VertexDegreeRule } from "./VertexDegreeRule";

export const SingleLoopRule: Rule = {
  id: "single-loop-rule",
  name: "単一ループ制約（到達可能性ベース）",
  description: "距離変数を使用して単一のループのみを許可",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];
    const size = boardVar.size;

    // 距離変数ベースの単一ループ制約
    // 各頂点の距離変数（ルートからの距離、-1はループに含まれない頂点）
    const dist: Arith<T>[][] = [];
    for (let p = 0; p <= size; p++) {
      dist[p] = [];
      for (let q = 0; q <= size; q++) {
        dist[p][q] = ctx.Int.const(`dist_${p}_${q}`);
        // 距離は-1以上、最大でもループサイズ以下
        constraints.push(dist[p][q].ge(-1));
        constraints.push(dist[p][q].le((size + 1) * 2)); // 最大ループサイズ
      }
    }

    // 制約1: ループに含まれない頂点（次数が2でない）の距離は-1
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q <= size; q++) {
        const deg2 = isDegree2(boardVar, ctx, p, q);
        constraints.push(ctx.Implies(ctx.Not(deg2), dist[p][q].eq(-1)));
      }
    }

    // 制約2: ルートの一意性（距離0の頂点は最大1個）
    let rootCount: Arith<T> = ctx.Int.val(0);
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q <= size; q++) {
        const deg2 = isDegree2(boardVar, ctx, p, q);
        const isRoot = ctx.And(deg2, dist[p][q].eq(0));
        rootCount = rootCount.add(
          ctx.If(isRoot, ctx.Int.val(1), ctx.Int.val(0)),
        );
      }
    }

    // 次数2の頂点が存在するかチェック
    let hasDeg2Vertex: Bool<T> = ctx.Bool.val(false);
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q <= size; q++) {
        const deg2 = isDegree2(boardVar, ctx, p, q);
        hasDeg2Vertex = ctx.Or(hasDeg2Vertex, deg2);
      }
    }

    // ループが存在する場合はルートが1個、存在しない場合はルートが0個
    constraints.push(ctx.Implies(hasDeg2Vertex, rootCount.eq(1)));
    constraints.push(ctx.Implies(ctx.Not(hasDeg2Vertex), rootCount.eq(0)));

    // 制約3: 親子関係制約（ループを考慮）
    // 次数2の各頂点について、隣接する次数2の頂点の中でちょうど1つが親（距離が1小さい）または子（距離が1大きい）である
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q <= size; q++) {
        const deg2 = isDegree2(boardVar, ctx, p, q);

        // 隣接する次数2の頂点の中で、親または子を探す
        const neighbors = getNeighbors(boardVar, p, q);
        const hasParentOrChild: Bool<T>[] = [];

        for (const neighbor of neighbors) {
          const [np, nq] = neighbor;
          if (np >= 0 && np <= size && nq >= 0 && nq <= size) {
            const hasEdge = hasEdgeBetween(boardVar, ctx, p, q, np, nq);
            const neighborDeg2 = isDegree2(boardVar, ctx, np, nq);

            // 親の場合: 隣接頂点の距離 = 自分の距離 - 1
            const isParent = dist[np][nq].eq(dist[p][q].sub(1));
            // 子の場合: 隣接頂点の距離 = 自分の距離 + 1
            const isChild = dist[np][nq].eq(dist[p][q].add(1));
            // ループの特殊ケース: ルート（距離0）と最大距離の頂点の関係
            const isLoopConnection = ctx.And(
              ctx.Or(
                ctx.And(dist[p][q].eq(0), dist[np][nq].gt(0)),
                ctx.And(dist[np][nq].eq(0), dist[p][q].gt(0)),
              ),
            );

            // エッジが存在し、隣接頂点が次数2で、親子関係またはループ接続がある
            hasParentOrChild.push(
              ctx.And(
                hasEdge,
                neighborDeg2,
                ctx.Or(isParent, isChild, isLoopConnection),
              ),
            );
          }
        }

        if (hasParentOrChild.length > 0) {
          // 次数2の頂点は必ず隣接する次数2の頂点と適切な距離関係を持つ
          constraints.push(ctx.Implies(deg2, ctx.Or(...hasParentOrChild)));
        }
      }
    }

    // シンプルな制約: ループが存在する場合、最低4エッジ必要
    let totalEdges: Arith<T> = ctx.Int.val(0);

    // 水平エッジを数える
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q < size; q++) {
        totalEdges = totalEdges.add(boardVar.horizontalEdges[p][q]);
      }
    }

    // 垂直エッジを数える
    for (let p = 0; p < size; p++) {
      for (let q = 0; q <= size; q++) {
        totalEdges = totalEdges.add(boardVar.verticalEdges[p][q]);
      }
    }

    // ループが存在する場合、最低4エッジ必要
    constraints.push(ctx.Implies(hasDeg2Vertex, totalEdges.ge(4)));

    return constraints;
  },
};
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("SingleLoopRule (Reachability-based)", () => {
    it("should be satisfied with no edges", async () => {
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

      const singleLoopConstraints = SingleLoopRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      singleLoopConstraints.forEach((constraint) => solver.add(constraint));

      // 全エッジを0に固定（エッジなし）
      boardVar.horizontalEdges.flat().forEach((edge) => solver.add(edge.eq(0)));
      boardVar.verticalEdges.flat().forEach((edge) => solver.add(edge.eq(0)));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be satisfied with a valid single loop", async () => {
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
            [1, 1], // 上の行
            [0, 0], // 真ん中の行
            [1, 1], // 下の行
          ],
          verticalEdges: [
            [1, 0, 1], // 左と右の境界
            [1, 0, 1],
          ],
        },
        ctx,
      );

      const singleLoopConstraints = SingleLoopRule.getConstraints(
        boardVar,
        ctx,
      );
      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenEdgeConstraints = createGivenEdgesRule({
        size: 2,
        cells: [
          [0, 0],
          [0, 0],
        ],
        horizontalEdges: [
          [1, 1],
          [0, 0],
          [1, 1],
        ],
        verticalEdges: [
          [1, 0, 1],
          [1, 0, 1],
        ],
      }).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [
        ...singleLoopConstraints,
        ...vertexDegreeConstraints,
        ...givenEdgeConstraints,
      ].forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with multiple disconnected loops", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardVar = createBoardVariable(
        {
          size: 3,
          cells: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
          horizontalEdges: [
            [1, 1, 0],
            [0, 0, 0],
            [0, 0, 1],
            [0, 0, 1],
          ],
          verticalEdges: [
            [1, 1, 0, 0],
            [1, 1, 0, 0],
            [0, 0, 1, 1],
          ],
        },
        ctx,
      );

      const singleLoopConstraints = SingleLoopRule.getConstraints(
        boardVar,
        ctx,
      );
      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );

      // 2つの独立した小さなループを作る設定
      const givenEdgeConstraints = createGivenEdgesRule({
        size: 3,
        cells: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        horizontalEdges: [
          [1, 1, 0], // 左上のループ
          [0, 0, 0],
          [0, 0, 1], // 右下のループ
          [0, 0, 1],
        ],
        verticalEdges: [
          [1, 1, 0, 0],
          [1, 1, 0, 0],
          [0, 0, 1, 1],
        ],
      }).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [
        ...singleLoopConstraints,
        ...vertexDegreeConstraints,
        ...givenEdgeConstraints,
      ].forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
