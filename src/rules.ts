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

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("NumberFillRule", () => {
    it("should be satisfied with positive numbers", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("ColumnUniquenessRule", () => {
    it("should be satisfied with unique values in columns", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      // ルールに違反しない初期盤面（各列の値が一意）
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
      const columnUniquenessConstraints = ColumnUniquenessRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        validBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...columnUniquenessConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with duplicate values in columns", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      // ルールに違反する初期盤面（列内に重複あり）
      const invalidBoardState: BoardState = {
        size: 2,
        cells: [
          [1, 2],
          [1, 3],
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
      const columnUniquenessConstraints = ColumnUniquenessRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...columnUniquenessConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}

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
  const { it, expect, describe } = import.meta.vitest;

  describe("ColumnSortRule", () => {
    it("should be satisfied with sorted columns", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      // ルールに違反しない初期盤面（列が昇順にソート済み）
      const validBoardState: BoardState = {
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
      };

      const boardVar = createBoardVariable(validBoardState, ctx);
      const columnSortConstraints = ColumnSortRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        validBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...columnSortConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with unsorted columns", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      // ルールに違反する初期盤面（列がソートされていない）
      const invalidBoardState: BoardState = {
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
      };

      const boardVar = createBoardVariable(invalidBoardState, ctx);
      const columnSortConstraints = ColumnSortRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenValueConstraints = createGivenValuesRule(
        invalidBoardState,
      ).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...columnSortConstraints, ...givenValueConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}

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
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("createGivenValuesRule", () => {
    it("should be satisfied when given values are consistent", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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
