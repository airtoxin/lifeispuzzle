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
  const { test, expect, describe } = import.meta.vitest;

  describe("NumberFillRule", () => {
    test.for<[string, "sat" | "unsat", BoardState]>([
      [
        "盤面のすべてのマスが正の数字で埋まっている場合",
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
        "負の数字が混じっている場合",
        "unsat",
        {
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
        },
      ],
      [
        "0が混じっている場合",
        "unsat",
        {
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
        },
      ],
      [
        "0よりも大きい少数が混じっている場合",
        "unsat",
        {
          size: 2,
          cells: [
            [1.5, 2],
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
    ])("%s(%s)", async ([, expecting, boardState]) => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardVar = createBoardVariable(boardState, ctx);
      const numberFillConstraints = NumberFillRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        boardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...numberFillConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe(expecting);
    });
  });
}
