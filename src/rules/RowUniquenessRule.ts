import { createGivenValuesRule } from "./helpers";
import { Rule } from "./types";
import { BoardState } from "../states";

export const RowUniquenessRule: Rule = {
  id: "row-uniqueness-rule",
  name: "行内数字一意性",
  description: "各行には同じ数字が複数現れない",
  getConstraints(boardVar, ctx) {
    return boardVar.cells.map((row) => ctx.Distinct(...row));
  },
};
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("RowUniquenessRule", () => {
    test.for<[string, "sat" | "unsat", BoardState]>([
      [
        "各行の値が一意な場合",
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
        "行内に重複値がある場合",
        "unsat",
        {
          size: 2,
          cells: [
            [1, 1],
            [2, 3],
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
        "複数行に重複がある場合",
        "unsat",
        {
          size: 2,
          cells: [
            [1, 1],
            [2, 2],
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
      const rowUniquenessConstraints = RowUniquenessRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        boardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...rowUniquenessConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe(expecting);
    });
  });
}
