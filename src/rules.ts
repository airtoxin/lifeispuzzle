import { BoardState, BoardVariable } from "./states.js";
import { Context, Bool, Arith } from "z3-solver";

// ルールの基底インターフェース
export interface Rule {
  id: string;
  name: string;
  description: string;
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ): Bool<T>[];
}

export const NumberFillRule: Rule = {
  id: "number-fill-rule",
  name: "数字で充填されている",
  description: "盤面の全てのマスが数字で埋められていること",
  getConstraints(boardVar, ctx) {
    return boardVar.cells.flat().map((v) => v.ge(1));
  },
};

export const RowUniquenessRule: Rule = {
  id: "row-uniqueness-rule",
  name: "行内数字一意性",
  description: "各行には同じ数字が複数現れない",
  getConstraints(boardVar, ctx) {
    return boardVar.cells.map((row) => ctx.Distinct(...row));
  },
};

export const ColumnUniquenessRule: Rule = {
  id: "column-uniqueness-rule",
  name: "列内数字一意性",
  description: "各列には同じ数字が複数現れない",
  getConstraints(boardVar, ctx) {
    return Array.from({ length: boardVar.size }, (_, colIndex) =>
      ctx.Distinct(...boardVar.cells.map((row) => row[colIndex]!)),
    );
  },
};

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

// 与えられた値の制約ルール
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

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("Rules constraint functionality", () => {
    it("NumberFillRule should enforce positive numbers", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");

      const boardState: BoardState = {
        size: 2,
        cells: [
          [0, 0],
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

      const boardVar = (await import("./states.js")).createBoardVariable(
        boardState,
        ctx,
      );
      const constraints = NumberFillRule.getConstraints(boardVar, ctx);

      // 4つのセル全てが1以上の制約を持つ
      expect(constraints.length).toBe(4);

      // Z3 Solverで実際に解いてみる
      const solver = new ctx.Solver();
      constraints.forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat"); // 解が存在することを確認

      // 解を取得して全て1以上であることを確認
      if (result === "sat") {
        const model = solver.model();
        const solution = (await import("./states.js")).boardVariableToState(
          boardVar,
          model,
        );

        for (const row of solution.cells) {
          for (const cell of row) {
            expect(cell).toBeGreaterThanOrEqual(1);
          }
        }
      }
    });

    it("RowUniquenessRule should enforce unique values in rows", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");

      const boardState: BoardState = {
        size: 2,
        cells: [
          [0, 0],
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

      const { createBoardVariable, boardVariableToState } = await import(
        "./states.js"
      );
      const boardVar = createBoardVariable(boardState, ctx);
      const constraints = RowUniquenessRule.getConstraints(boardVar, ctx);

      // 2つの行に対して一意性制約
      expect(constraints.length).toBe(2);

      // Z3 Solverで制約を満たす解があることを確認
      const solver = new ctx.Solver();
      constraints.forEach((constraint) => solver.add(constraint));
      // 値の範囲も制限（1-2の値のみ使用可能）
      boardVar.cells.flat().forEach((cell) => {
        solver.add(cell.ge(1));
        solver.add(cell.le(2));
      });

      const result = await solver.check();
      expect(result).toBe("sat");

      if (result === "sat") {
        const model = solver.model();
        const solution = (await import("./states.js")).boardVariableToState(
          boardVar,
          model,
        );

        // 各行で値が重複していないことを確認
        for (const row of solution.cells) {
          const uniqueValues = new Set(row);
          expect(uniqueValues.size).toBe(row.length);
        }
      }
    });

    it("MagicSquareRule should create valid magic square", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");

      const boardState: BoardState = {
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

      const boardVar = (await import("./states.js")).createBoardVariable(
        boardState,
        ctx,
      );
      const constraints = MagicSquareRule.getConstraints(boardVar, ctx);

      // 期待される制約数: distinct(1) + range(9) + rows(2) + cols(3) + diags(2) = 17
      expect(constraints.length).toBe(17);

      // Z3 Solverで実際に魔法陣を解く
      const solver = new ctx.Solver();
      constraints.forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");

      if (result === "sat") {
        const model = solver.model();
        const solution = (await import("./states.js")).boardVariableToState(
          boardVar,
          model,
        );

        // 魔法陣の性質を検証
        const cells = solution.cells;

        // 全ての数字が1-9で異なる
        const allNumbers = cells.flat();
        const uniqueNumbers = new Set(allNumbers);
        expect(uniqueNumbers.size).toBe(9);
        expect(Math.min(...allNumbers)).toBe(1);
        expect(Math.max(...allNumbers)).toBe(9);

        // 行の合計が全て等しい
        const rowSums = cells.map((row) =>
          row.reduce((sum, cell) => sum + cell, 0),
        );
        const magicSum = rowSums[0];
        expect(rowSums.every((sum) => sum === magicSum)).toBe(true);

        // 列の合計が等しい
        for (let col = 0; col < 3; col++) {
          const colSum = cells.reduce((sum, row) => sum + row[col], 0);
          expect(colSum).toBe(magicSum);
        }

        // 対角線の合計が等しい
        const mainDiagSum = cells[0][0] + cells[1][1] + cells[2][2];
        const antiDiagSum = cells[0][2] + cells[1][1] + cells[2][0];
        expect(mainDiagSum).toBe(magicSum);
        expect(antiDiagSum).toBe(magicSum);
      }
    });

    it("createGivenValuesRule should fix specified values", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");

      const initialBoardState: BoardState = {
        size: 2,
        cells: [
          [1, 0],
          [0, 4],
        ], // 1と4を固定
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

      const boardVar = (await import("./states.js")).createBoardVariable(
        initialBoardState,
        ctx,
      );
      const rule = createGivenValuesRule(initialBoardState);
      const constraints = rule.getConstraints(boardVar, ctx);

      // 2つの固定値制約（セル[0,0]=1, セル[1,1]=4）
      expect(constraints.length).toBe(2);

      // Z3 Solverで解く
      const solver = new ctx.Solver();
      constraints.forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");

      if (result === "sat") {
        const model = solver.model();
        const solution = (await import("./states.js")).boardVariableToState(
          boardVar,
          model,
        );

        // 指定された値が固定されていることを確認
        expect(solution.cells[0][0]).toBe(1);
        expect(solution.cells[1][1]).toBe(4);
      }
    });
  });
}
