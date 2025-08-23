import { createGivenValuesRule } from "./helpers";
import { Rule } from "./types";
import { BoardState } from "../states";

export const RowSortRule: Rule = {
  id: "row-sort-rule",
  name: "行ソート制約",
  description: "各行の数値が昇順または降順でソート済み",
  getConstraints(boardVar, ctx) {
    return boardVar.cells.map((row) => {
      // 昇順制約: r[0] ≤ r[1] ≤ r[2] ≤ ...
      const ascending = row.slice(1).map((curr, i) => row[i].le(curr));

      // 降順制約: r[0] ≥ r[1] ≥ r[2] ≥ ...
      const descending = row.slice(1).map((curr, i) => row[i].ge(curr));

      // 昇順または降順
      return ctx.Or(ctx.And(...ascending), ctx.And(...descending));
    });
  },
};
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("RowSortRule", () => {
    it("should be satisfied with sorted rows", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // ルールに違反しない初期盤面（行が昇順にソート済み）
      const validBoardState: BoardState = {
        size: 3,
        cells: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
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
      };

      const boardVar = createBoardVariable(validBoardState, ctx);
      const rowSortConstraints = RowSortRule.getConstraints(boardVar, ctx);
      const givenValueConstraints = createGivenValuesRule(
        validBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...rowSortConstraints, ...givenValueConstraints].forEach((constraint) =>
        solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with unsorted rows", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // ルールに違反する初期盤面（行がソートされていない）
      const invalidBoardState: BoardState = {
        size: 3,
        cells: [
          [3, 1, 2],
          [0, 0, 0],
          [0, 0, 0],
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
      };

      const boardVar = createBoardVariable(invalidBoardState, ctx);
      const rowSortConstraints = RowSortRule.getConstraints(boardVar, ctx);
      const givenValueConstraints = createGivenValuesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...rowSortConstraints, ...givenValueConstraints].forEach((constraint) =>
        solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
