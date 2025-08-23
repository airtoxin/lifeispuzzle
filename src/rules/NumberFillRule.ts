import { createGivenValuesRule } from "./helpers";
import { Rule } from "./types";
import { BoardState } from "../states";

export const NumberFillRule: Rule = {
  id: "number-fill-rule",
  name: "数字で充填されている",
  description: "盤面の全てのマスが数字で埋められていること",
  getConstraints(boardVar, ctx) {
    return boardVar.cells.flat().map((v) => v.ge(1));
  },
};
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("NumberFillRule", () => {
    it("should be satisfied with positive numbers", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // ルールに違反しない初期盤面（全て正の数）
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
      const numberFillConstraints = NumberFillRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        validBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...numberFillConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with non-positive numbers", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // ルールに違反する初期盤面（負の数を強制設定）
      const invalidBoardState: BoardState = {
        size: 2,
        cells: [
          [-1, 2],
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

      const boardVar = createBoardVariable(invalidBoardState, ctx);
      const numberFillConstraints = NumberFillRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...numberFillConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
