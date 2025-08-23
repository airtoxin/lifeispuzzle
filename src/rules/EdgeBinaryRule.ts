import { Context, Bool } from "z3-solver";
import { Rule } from "./types";
import { BoardState, BoardVariable } from "../states";
import { createGivenEdgesRule } from "./helpers";

// スリザーリンク用ルール

export const EdgeBinaryRule: Rule = {
  id: "edge-binary-rule",
  name: "エッジバイナリ制約",
  description: "エッジが0または1の値のみを持つ",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];

    // 水平エッジの制約
    boardVar.horizontalEdges.forEach((row) => {
      row.forEach((edge) => {
        constraints.push(edge.ge(0).and(edge.le(1)));
      });
    });

    // 垂直エッジの制約
    boardVar.verticalEdges.forEach((row) => {
      row.forEach((edge) => {
        constraints.push(edge.ge(0).and(edge.le(1)));
      });
    });

    return constraints;
  },
};
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("EdgeBinaryRule", () => {
    it("should be satisfied with valid edge values (0 and 1)", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // 有効なエッジ値（0と1のみ）を持つ盤面
      const validBoardState: BoardState = {
        size: 2,
        cells: [
          [0, 0],
          [0, 0],
        ],
        horizontalEdges: [
          [1, 0],
          [0, 1],
          [1, 0],
        ],
        verticalEdges: [
          [0, 1, 0],
          [1, 0, 1],
        ],
      };

      const boardVar = createBoardVariable(validBoardState, ctx);
      const edgeBinaryConstraints = EdgeBinaryRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenEdgeConstraints = createGivenEdgesRule(
        validBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...edgeBinaryConstraints, ...givenEdgeConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with invalid edge values (outside 0-1 range)", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // 無効なエッジ値を含む盤面
      const invalidBoardState: BoardState = {
        size: 2,
        cells: [
          [0, 0],
          [0, 0],
        ],
        horizontalEdges: [
          [2, 0], // 2は無効（0-1の範囲外）
          [0, 0],
          [0, 0],
        ],
        verticalEdges: [
          [0, 0, 0],
          [0, 0, 0],
        ],
      };

      const boardVar = createBoardVariable(invalidBoardState, ctx);
      const edgeBinaryConstraints = EdgeBinaryRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenEdgeConstraints = createGivenEdgesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...edgeBinaryConstraints, ...givenEdgeConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
