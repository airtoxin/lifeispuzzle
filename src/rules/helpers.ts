import { Context, Bool } from "z3-solver";
import { Rule } from "./types";
import { BoardState, BoardVariable } from "../states";

// 与えられたエッジ値の制約ルール

export function createGivenEdgesRule(initialState: BoardState): Rule {
  return {
    id: "given-edges-rule",
    name: "与えられたエッジ制約",
    description: "初期値として与えられたエッジの値を固定する",
    getConstraints<T extends string>(
      boardVar: BoardVariable<T>,
      ctx: Context<T>,
    ) {
      const constraints: Bool<T>[] = [];

      // 水平エッジの制約
      for (let row = 0; row < initialState.horizontalEdges.length; row++) {
        for (
          let col = 0;
          col < initialState.horizontalEdges[row].length;
          col++
        ) {
          const givenValue = initialState.horizontalEdges[row][col];
          if (givenValue !== 0) {
            constraints.push(boardVar.horizontalEdges[row][col].eq(givenValue));
          }
        }
      }

      // 垂直エッジの制約
      for (let row = 0; row < initialState.verticalEdges.length; row++) {
        for (let col = 0; col < initialState.verticalEdges[row].length; col++) {
          const givenValue = initialState.verticalEdges[row][col];
          if (givenValue !== 0) {
            constraints.push(boardVar.verticalEdges[row][col].eq(givenValue));
          }
        }
      }

      return constraints;
    },
  };
} // 与えられた値の制約ルール

export function createGivenValuesRule(initialState: BoardState): Rule {
  return {
    id: "given-values-rule",
    name: "与えられた値制約",
    description: "初期値として与えられたセルの値を固定する",
    getConstraints<T extends string>(
      boardVar: BoardVariable<T>,
      ctx: Context<T>,
    ) {
      const constraints: Bool<T>[] = [];

      for (let row = 0; row < initialState.size; row++) {
        for (let col = 0; col < initialState.size; col++) {
          const givenValue = initialState.cells[row][col];
          if (givenValue !== 0) {
            constraints.push(boardVar.cells[row][col].eq(givenValue));
          }
        }
      }

      return constraints;
    },
  };
}

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("createGivenValuesRule", () => {
    it("should be satisfied when given values are consistent", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

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
      const rule = createGivenValuesRule(validBoardState);
      const constraints = rule.getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      constraints.forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated when conflicting values are given", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardState: BoardState = {
        size: 2,
        cells: [
          [1, 0],
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
      };

      const boardVar = createBoardVariable(boardState, ctx);
      const givenValueConstraints = createGivenValuesRule(
        boardState,
      ).getConstraints(boardVar, ctx);

      // 矛盾した制約を追加（同じセルに異なる値を設定）
      const conflictingConstraint = boardVar.cells[0][0].eq(5);

      const solver = new ctx.Solver();
      [...givenValueConstraints, conflictingConstraint].forEach((constraint) =>
        solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
