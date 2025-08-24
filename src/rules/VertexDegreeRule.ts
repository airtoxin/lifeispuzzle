import { Context, Bool, Arith } from "z3-solver";
import { Rule } from "./types";
import { BoardVariable, BoardState } from "../states";

export const VertexDegreeRule: Rule = {
  id: "vertex-degree-rule",
  name: "頂点次数制約",
  description: "各頂点の次数が0または2である",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];

    // 各頂点の次数を追跡する配列 (size+1) x (size+1)
    const vertexDegrees: Arith<T>[][] = [];
    for (let row = 0; row <= boardVar.size; row++) {
      vertexDegrees[row] = [];
      for (let col = 0; col <= boardVar.size; col++) {
        vertexDegrees[row][col] = ctx.Int.val(0);
      }
    }

    // 水平エッジをすべて走査して、両端の頂点の次数に加算
    boardVar.horizontalEdges.forEach((row, rowIndex) => {
      row.forEach((edge, colIndex) => {
        // この水平エッジは頂点(rowIndex, colIndex)と(rowIndex, colIndex+1)を接続
        vertexDegrees[rowIndex][colIndex] = vertexDegrees[rowIndex][colIndex].add(edge);
        if (colIndex + 1 <= boardVar.size) {
          vertexDegrees[rowIndex][colIndex + 1] = vertexDegrees[rowIndex][colIndex + 1].add(edge);
        }
      });
    });

    // 垂直エッジをすべて走査して、両端の頂点の次数に加算
    boardVar.verticalEdges.forEach((row, rowIndex) => {
      row.forEach((edge, colIndex) => {
        // この垂直エッジは頂点(rowIndex, colIndex)と(rowIndex+1, colIndex)を接続
        vertexDegrees[rowIndex][colIndex] = vertexDegrees[rowIndex][colIndex].add(edge);
        if (rowIndex + 1 <= boardVar.size) {
          vertexDegrees[rowIndex + 1][colIndex] = vertexDegrees[rowIndex + 1][colIndex].add(edge);
        }
      });
    });

    // 各頂点の次数制約（0または2）を追加
    vertexDegrees.forEach((row) => {
      row.forEach((degree) => {
        constraints.push(degree.eq(0).or(degree.eq(2)));
      });
    });

    return constraints;
  },
};
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("VertexDegreeRule", () => {
    test.for<[string, "sat" | "unsat", BoardState]>([
      [
        "全頂点の次数が0の場合",
        "sat",
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
      ],
      [
        "2x2グリッドで左上1x1セルの完全な四角ループ",
        "sat",
        {
          size: 2,
          cells: [
            [0, 0],
            [0, 0],
          ],
          horizontalEdges: [
            [1, 0],
            [1, 0],
            [0, 0],
          ],
          verticalEdges: [
            [1, 1, 0],
            [0, 0, 0],
          ],
        },
      ],
      [
        "2x2グリッド外周ループ",
        "sat",
        {
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
        },
      ],
      [
        "一部の頂点が次数1になる不正な配置",
        "unsat",
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
            [0, 0],
            [0, 0],
          ],
        },
      ],
      [
        "頂点の次数が1の場合",
        "unsat",
        {
          size: 2,
          cells: [
            [0, 0],
            [0, 0],
          ],
          horizontalEdges: [
            [1, 0], // 左上の頂点の次数が1
            [0, 0],
            [0, 0],
          ],
          verticalEdges: [
            [0, 0, 0],
            [0, 0, 0],
          ],
        },
      ],
      [
        "頂点の次数が3の場合",
        "unsat",
        {
          size: 2,
          cells: [
            [0, 0],
            [0, 0],
          ],
          horizontalEdges: [
            [0, 1],
            [1, 1],
            [0, 0],
          ],
          verticalEdges: [
            [0, 1],
            [0, 0],
          ],
        },
      ],
    ])("%s (%s)", async ([, expecting, boardState]) => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardVar = createBoardVariable(boardState, ctx);

      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      vertexDegreeConstraints.forEach((constraint) => solver.add(constraint));

      // エッジの値を固定
      boardState.horizontalEdges.forEach((row, i) => {
        row.forEach((val, j) => {
          solver.add(boardVar.horizontalEdges[i][j].eq(val));
        });
      });
      boardState.verticalEdges.forEach((row, i) => {
        row.forEach((val, j) => {
          solver.add(boardVar.verticalEdges[i][j].eq(val));
        });
      });

      const result = await solver.check();
      if (result !== expecting) {
        console.log(`Expected: ${expecting}, Got: ${result}`);
        console.log('Board configuration:');
        console.log('horizontalEdges:', JSON.stringify(boardState.horizontalEdges));
        console.log('verticalEdges:', JSON.stringify(boardState.verticalEdges));
        
        // 各頂点の次数を手動計算して表示
        console.log('\n頂点の次数:');
        for (let p = 0; p <= boardVar.size; p++) {
          for (let q = 0; q <= boardVar.size; q++) {
            let degree = 0;
            // 上のエッジ (horizontalEdges[p-1][q])
            if (p > 0 && q < boardState.horizontalEdges[p-1].length) {
              degree += boardState.horizontalEdges[p-1][q];
            }
            // 下のエッジ (horizontalEdges[p][q])
            if (p < boardState.horizontalEdges.length && q < boardState.horizontalEdges[p].length) {
              degree += boardState.horizontalEdges[p][q];
            }
            // 左のエッジ (verticalEdges[p][q-1])
            if (p < boardState.verticalEdges.length && q > 0 && q-1 < boardState.verticalEdges[p].length) {
              degree += boardState.verticalEdges[p][q-1];
            }
            // 右のエッジ (verticalEdges[p][q])
            if (p < boardState.verticalEdges.length && q < boardState.verticalEdges[p].length) {
              degree += boardState.verticalEdges[p][q];
            }
            console.log(`Vertex (${p},${q}): degree=${degree} ${degree === 0 || degree === 2 ? '✓' : '❌'}`);
          }
        }
      }
      expect(result).toBe(expecting);
    });
  });
}
