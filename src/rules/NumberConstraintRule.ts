import { Bool, Context } from "z3-solver";
import { Rule } from "./types";
import { BoardState, BoardVariable } from "../states";
import { createGivenEdgesRule, createGivenValuesRule } from "./helpers";

export const NumberConstraintRule: Rule = {
  id: "number-constraint-rule",
  name: "数字制約",
  description: "各数字セルの周りのエッジ数が指定数と等しい",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];

    for (let row = 0; row < boardVar.size; row++) {
      for (let col = 0; col < boardVar.size; col++) {
        // セルの値が0でない場合（数字が指定されている場合）
        const cellValue = boardVar.cells[row][col];
        const edges = [];

        // 上のエッジ（垂直エッジ[row-1][col]）
        if (
          row > 0 &&
          row - 1 < boardVar.verticalEdges.length &&
          col < boardVar.verticalEdges[row - 1].length
        ) {
          edges.push(boardVar.verticalEdges[row - 1][col]);
        }

        // 下のエッジ（垂直エッジ[row][col]）
        if (
          row < boardVar.verticalEdges.length &&
          col < boardVar.verticalEdges[row].length
        ) {
          edges.push(boardVar.verticalEdges[row][col]);
        }

        // 左のエッジ（水平エッジ[row][col-1]）
        if (
          row < boardVar.horizontalEdges.length &&
          col > 0 &&
          col - 1 < boardVar.horizontalEdges[row].length
        ) {
          edges.push(boardVar.horizontalEdges[row][col - 1]);
        }

        // 右のエッジ（水平エッジ[row][col]）
        if (
          row < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row].length
        ) {
          edges.push(boardVar.horizontalEdges[row][col]);
        }

        // エッジの合計がセルの値と等しい制約を追加
        if (edges.length > 0) {
          const edgeSum = edges.reduce((sum, edge) => sum.add(edge));
          // セルの値が正の数の場合のみ制約を追加
          constraints.push(ctx.Implies(cellValue.gt(0), edgeSum.eq(cellValue)));
        }
      }
    }

    return constraints;
  },
};

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("NumberConstraintRule", () => {
    test.for<[string, "sat" | "unsat", BoardState]>([
      [
        "数字の周りのエッジ数が正しい場合",
        "sat",
        {
          size: 2,
          cells: [
            [2, 0],
            [0, 1],
          ],
          horizontalEdges: [
            [1, 0],
            [0, 1],
            [0, 0],
          ],
          verticalEdges: [
            [1, 0, 0],
            [0, 0, 0],
          ],
        },
      ],
      [
        "別パターンの有効な盤面",
        "sat",
        {
          size: 2,
          cells: [
            [1, 1],
            [1, 1],
          ],
          horizontalEdges: [
            [1, 0],
            [0, 0],
            [0, 1],
          ],
          verticalEdges: [
            [0, 1],
            [1, 0],
          ],
        },
      ],
      [
        "0のみの盤面",
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
        "数字の周りのエッジ数が異なる場合",
        "unsat",
        {
          size: 2,
          cells: [
            [3, 0],
            [0, 3],
          ],
          horizontalEdges: [
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          verticalEdges: [
            [1, 1, 0],
            [0, 1, 1],
          ],
        },
      ],
    ])("%s (%s)", async ([, expecting, boardState]) => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardVar = createBoardVariable(boardState, ctx);
      const numberConstraints = NumberConstraintRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        boardState,
      ).getConstraints(boardVar, ctx);
      const givenEdgeConstraints = createGivenEdgesRule(
        boardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [
        ...numberConstraints,
        ...givenValueConstraints,
        ...givenEdgeConstraints,
      ].forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe(expecting);
    });
  });
}
