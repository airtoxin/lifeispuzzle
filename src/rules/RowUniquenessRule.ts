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
  const { it, expect, describe } = import.meta.vitest;

  describe("RowUniquenessRule", () => {
    it("should be satisfied with unique values in rows", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // ルールに違反しない初期盤面（各行の値が一意）
      const validBoardState: BoardState = {
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
      };

      const boardVar = createBoardVariable(validBoardState, ctx);
      const rowUniquenessConstraints = RowUniquenessRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        validBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...rowUniquenessConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with duplicate values in rows", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // ルールに違反する初期盤面（行内に重複あり）
      const invalidBoardState: BoardState = {
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
      };

      const boardVar = createBoardVariable(invalidBoardState, ctx);
      const rowUniquenessConstraints = RowUniquenessRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...rowUniquenessConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
