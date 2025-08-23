import { Context, Bool } from "z3-solver";
import { Rule } from "./types";
import { BoardVariable } from "../states";

export const VertexDegreeRule: Rule = {
  id: "vertex-degree-rule",
  name: "頂点次数制約",
  description: "各頂点の次数が0または2である",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];

    // 格子の頂点は (size+1) x (size+1) 個存在
    for (let row = 0; row <= boardVar.size; row++) {
      for (let col = 0; col <= boardVar.size; col++) {
        const adjacentEdges = [];

        // 上のエッジ（水平エッジ[row-1][col]）
        if (
          row > 0 &&
          row - 1 < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row - 1].length
        ) {
          adjacentEdges.push(boardVar.horizontalEdges[row - 1][col]);
        }

        // 下のエッジ（水平エッジ[row][col]）
        if (
          row < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.horizontalEdges[row][col]);
        }

        // 左のエッジ（垂直エッジ[row][col-1]）
        if (
          row < boardVar.verticalEdges.length &&
          col > 0 &&
          col - 1 < boardVar.verticalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.verticalEdges[row][col - 1]);
        }

        // 右のエッジ（垂直エッジ[row][col]）
        if (
          row < boardVar.verticalEdges.length &&
          col < boardVar.verticalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.verticalEdges[row][col]);
        }

        // 隣接エッジの合計（頂点の次数）が0または2
        if (adjacentEdges.length > 0) {
          const degree = adjacentEdges.reduce((sum, edge) => sum.add(edge));
          constraints.push(degree.eq(0).or(degree.eq(2)));
        }
      }
    }

    return constraints;
  },
};
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("VertexDegreeRule", () => {
    test.for<
      [
        string,
        "sat" | "unsat",
        { edges: { horizontal: number[][]; vertical: number[][] } },
      ]
    >([
      [
        "全頂点の次数が0の場合",
        "sat",
        {
          edges: {
            horizontal: [
              [0, 0],
              [0, 0],
              [0, 0],
            ],
            vertical: [
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
        },
      ],
      [
        "全頂点の次数が2の場合",
        "sat",
        {
          edges: {
            horizontal: [
              [1, 1],
              [1, 1],
              [1, 1],
            ],
            vertical: [
              [1, 0, 1],
              [1, 0, 1],
            ],
          },
        },
      ],
      [
        "頂点の次数が1の場合",
        "unsat",
        {
          edges: {
            horizontal: [
              [1, 0], // 左上の頂点の次数が1
              [0, 0],
              [0, 0],
            ],
            vertical: [
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
        },
      ],
      [
        "頂点の次数が3の場合",
        "unsat",
        {
          edges: {
            horizontal: [
              [1, 0],
              [1, 0], // 中央の頂点の次数が3
              [0, 0],
            ],
            vertical: [
              [1, 0, 0],
              [0, 0, 0],
            ],
          },
        },
      ],
    ])("%s (%s)", async ([, expecting, { edges }]) => {
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
          horizontalEdges: edges.horizontal,
          verticalEdges: edges.vertical,
        },
        ctx,
      );

      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      vertexDegreeConstraints.forEach((constraint) => solver.add(constraint));

      // エッジの値を固定
      edges.horizontal.forEach((row, i) => {
        row.forEach((val, j) => {
          solver.add(boardVar.horizontalEdges[i][j].eq(val));
        });
      });
      edges.vertical.forEach((row, i) => {
        row.forEach((val, j) => {
          solver.add(boardVar.verticalEdges[i][j].eq(val));
        });
      });

      const result = await solver.check();
      expect(result).toBe(expecting);
    });
  });
}
