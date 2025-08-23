import { createGivenValuesRule } from "./helpers";
import { Rule } from "./types";
import { BoardState } from "../states";

export const ColumnSortRule: Rule = {
  id: "column-sort-rule",
  name: "列ソート制約",
  description: "各列の数値が昇順または降順でソート済み",
  getConstraints(boardVar, ctx) {
    return Array.from({ length: boardVar.size }, (_, colIndex) => {
      const column = boardVar.cells.map((row) => row[colIndex]!);

      // 昇順制約: c[0] ≤ c[1] ≤ c[2] ≤ ...
      const ascending = column.slice(1).map((curr, i) => column[i].le(curr));

      // 降順制約: c[0] ≥ c[1] ≥ c[2] ≥ ...
      const descending = column.slice(1).map((curr, i) => column[i].ge(curr));

      // 昇順または降順
      return ctx.Or(ctx.And(...ascending), ctx.And(...descending));
    });
  },
};
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("ColumnSortRule", () => {
    test.for<[string, "sat" | "unsat", BoardState]>([
      [
        "列が昇順でソートされている場合",
        "sat",
        {
          size: 3,
          cells: [
            [1, 3, 5],
            [2, 4, 6],
            [3, 5, 7],
          ],
          horizontalEdges: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
          verticalEdges: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
        },
      ],
      [
        "列が降順でソートされている場合",
        "sat",
        {
          size: 3,
          cells: [
            [3, 6, 9],
            [2, 5, 8],
            [1, 4, 7],
          ],
          horizontalEdges: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
          verticalEdges: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
        },
      ],
      [
        "列がソートされていない場合",
        "unsat",
        {
          size: 3,
          cells: [
            [3, 0, 0],
            [1, 0, 0],
            [2, 0, 0],
          ],
          horizontalEdges: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
          verticalEdges: [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
        },
      ],
    ])("%s (%s)", async ([, expecting, boardState]) => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardVar = createBoardVariable(boardState, ctx);
      const columnSortConstraints = ColumnSortRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        boardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...columnSortConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe(expecting);
    });
  });
}
