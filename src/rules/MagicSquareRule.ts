import { Context, Bool } from "z3-solver";
import { Rule } from "./types";
import { BoardState, BoardVariable } from "../states";
import { createGivenValuesRule } from "./helpers";

export const MagicSquareRule: Rule = {
  id: "magic-square-rule",
  name: "魔法陣制約",
  description: "タテ・ヨコ・ナナメの合計が全て等しい",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];
    // すべての数字が異なる
    constraints.push(ctx.Distinct(...boardVar.cells.flat()));
    constraints.push(
      ...boardVar.cells
        .flat()
        .map((v) => v.ge(1).and(v.le(boardVar.size * boardVar.size))),
    );

    // 最初の行の合計を基準とする
    const firstRowSum = boardVar.cells[0]
      .slice(1)
      .reduce((sum, cell) => sum.add(cell), boardVar.cells[0][0]);

    // 各行の合計が基準と等しい
    boardVar.cells.slice(1).forEach((row) => {
      const rowSum = row.slice(1).reduce((sum, cell) => sum.add(cell), row[0]);
      constraints.push(rowSum.eq(firstRowSum));
    });

    // 各列の合計が基準と等しい
    Array.from({ length: boardVar.size }, (_, colIndex) => {
      const column = boardVar.cells.map((row) => row[colIndex]);
      const columnSum = column
        .slice(1)
        .reduce((sum, cell) => sum.add(cell), column[0]);
      constraints.push(columnSum.eq(firstRowSum));
    });

    // 左上から右下への対角線の合計が基準と等しい
    const mainDiagonal = Array.from(
      { length: boardVar.size },
      (_, i) => boardVar.cells[i][i],
    );
    const mainDiagonalSum = mainDiagonal
      .slice(1)
      .reduce((sum, cell) => sum.add(cell), mainDiagonal[0]);
    constraints.push(mainDiagonalSum.eq(firstRowSum));

    // 右上から左下への対角線の合計が基準と等しい
    const antiDiagonal = Array.from(
      { length: boardVar.size },
      (_, i) => boardVar.cells[i][boardVar.size - 1 - i],
    );
    const antiDiagonalSum = antiDiagonal
      .slice(1)
      .reduce((sum, cell) => sum.add(cell), antiDiagonal[0]);
    constraints.push(antiDiagonalSum.eq(firstRowSum));

    return constraints;
  },
};
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("MagicSquareRule", () => {
    it("should be satisfied with valid magic square configuration", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // 空の盤面で魔法陣の制約を満たす解が存在するか確認
      const emptyBoardState: BoardState = {
        size: 3,
        cells: [
          [0, 0, 0],
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

      const boardVar = createBoardVariable(emptyBoardState, ctx);
      const constraints = MagicSquareRule.getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      constraints.forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with invalid magic square configuration", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      // 魔法陣の制約に違反する初期盤面（同じ数字を複数配置）
      const invalidBoardState: BoardState = {
        size: 3,
        cells: [
          [1, 1, 0],
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
      const magicSquareConstraints = MagicSquareRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...magicSquareConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
