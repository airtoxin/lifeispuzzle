import { Context, Bool } from "z3-solver";
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

        // 上のエッジ（水平エッジ[row][col]）
        if (
          row >= 0 &&
          row < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row].length
        ) {
          edges.push(boardVar.horizontalEdges[row][col]);
        }

        // 下のエッジ（水平エッジ[row+1][col]）
        if (
          row + 1 < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row + 1].length
        ) {
          edges.push(boardVar.horizontalEdges[row + 1][col]);
        }

        // 左のエッジ（垂直エッジ[row][col]）
        if (
          row < boardVar.verticalEdges.length &&
          col >= 0 &&
          col < boardVar.verticalEdges[row].length
        ) {
          edges.push(boardVar.verticalEdges[row][col]);
        }

        // 右のエッジ（垂直エッジ[row][col+1]）
        if (
          row < boardVar.verticalEdges.length &&
          col + 1 < boardVar.verticalEdges[row].length
        ) {
          edges.push(boardVar.verticalEdges[row][col + 1]);
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
  const { it, expect, describe } = import.meta.vitest;

  describe("NumberConstraintRule", () => {
    it("should be satisfied with correct edge counts around numbers", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // 数字の周りのエッジ数が正しい盤面
      const validBoardState: BoardState = {
        size: 2,
        cells: [
          [2, 0],
          [0, 1],
        ],
        horizontalEdges: [
          [1, 0], // セル[0][0]の上のエッジ
          [1, 1], // セル[0][0]の下とセル[1][0]の上
          [0, 0], // セル[1][0]の下
        ],
        verticalEdges: [
          [1, 0, 0], // セル[0][0]の左、セル[0][0]とセル[0][1]の間、セル[0][1]の右
          [0, 1, 0], // セル[1][0]の左、セル[1][0]とセル[1][1]の間、セル[1][1]の右
        ],
      };

      const boardVar = createBoardVariable(validBoardState, ctx);
      const numberConstraints = NumberConstraintRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        validBoardState,
      ).getConstraints(boardVar, ctx);
      const givenEdgeConstraints = createGivenEdgesRule(
        validBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [
        ...numberConstraints,
        ...givenValueConstraints,
        ...givenEdgeConstraints,
      ].forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with incorrect edge counts around numbers", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // 数字の周りのエッジ数が間違っている盤面
      // セル[0][0]に3があり、周りに2つのエッジしかない（3 ≠ 2）
      const invalidBoardState: BoardState = {
        size: 2,
        cells: [
          [3, 0],
          [0, 0],
        ],
        horizontalEdges: [
          [1, 0], // セル[0][0]の上のエッジ
          [1, 0], // セル[0][0]の下のエッジ
          [0, 0],
        ],
        verticalEdges: [
          [0, 0, 0], // セル[0][0]の左と右のエッジは両方0
          [0, 0, 0],
        ],
      };

      const boardVar = createBoardVariable(invalidBoardState, ctx);
      const numberConstraints = NumberConstraintRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);
      const givenEdgeConstraints = createGivenEdgesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();

      // 数字制約のみを追加してテスト
      numberConstraints.forEach((constraint) => solver.add(constraint));

      // セル[0][0]を3に固定
      solver.add(boardVar.cells[0][0].eq(3));

      // エッジを固定
      solver.add(boardVar.horizontalEdges[0][0].eq(1));
      solver.add(boardVar.horizontalEdges[1][0].eq(1));
      solver.add(boardVar.verticalEdges[0][0].eq(0));
      solver.add(boardVar.verticalEdges[0][1].eq(0));

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
