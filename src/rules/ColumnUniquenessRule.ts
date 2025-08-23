import { createGivenValuesRule } from "./helpers";
import { Rule } from "./types";
import { BoardState } from "../states";

export const ColumnUniquenessRule: Rule = {
  id: "column-uniqueness-rule",
  name: "列内数字一意性",
  description: "各列には同じ数字が複数現れない",
  getConstraints(boardVar, ctx) {
    return Array.from({ length: boardVar.size }, (_, colIndex) =>
      ctx.Distinct(...boardVar.cells.map((row) => row[colIndex]!)),
    );
  },
};
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("ColumnUniquenessRule", () => {
    test.for<[string, "sat" | "unsat", BoardState]>([
      [
        "各列の値が一意な場合",
        "sat",
        {
          size: 2,
          cells: [
            [1, 2],
            [3, 4],
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
        "列内に重複値がある場合",
        "unsat",
        {
          size: 2,
          cells: [
            [1, 2],
            [1, 3],
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
        "複数列に重複がある場合",
        "unsat",
        {
          size: 2,
          cells: [
            [1, 2],
            [1, 2],
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
    ])("%s (%s)", async ([, expecting, boardState]) => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardVar = createBoardVariable(boardState, ctx);
      const columnUniquenessConstraints = ColumnUniquenessRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        boardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...columnUniquenessConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe(expecting);
    });
  });
}
