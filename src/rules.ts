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
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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
}

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
      const { createBoardVariable } = await import("./states.js");

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
      const { createBoardVariable } = await import("./states.js");

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

export const VertexDegreeRule: Rule = {
  id: "vertex-degree-rule",
  name: "頂点次数制約",
  description: "各頂点の次数が0または2である",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];

    // 格子の頂点は (size+1) x (size+1) 個存在
    for (let row = 0; row <= boardVar.size; row++) {
      for (let col = 0; col <= boardVar.size; col++) {
        const adjacentEdges = [];

        // 上のエッジ（水平エッジ[row-1][col]）
        if (
          row > 0 &&
          row - 1 < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row - 1].length
        ) {
          adjacentEdges.push(boardVar.horizontalEdges[row - 1][col]);
        }

        // 下のエッジ（水平エッジ[row][col]）
        if (
          row < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.horizontalEdges[row][col]);
        }

        // 左のエッジ（垂直エッジ[row][col-1]）
        if (
          row < boardVar.verticalEdges.length &&
          col > 0 &&
          col - 1 < boardVar.verticalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.verticalEdges[row][col - 1]);
        }

        // 右のエッジ（垂直エッジ[row][col]）
        if (
          row < boardVar.verticalEdges.length &&
          col < boardVar.verticalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.verticalEdges[row][col]);
        }

        // 隣接エッジの合計（頂点の次数）が0または2
        if (adjacentEdges.length > 0) {
          const degree = adjacentEdges.reduce((sum, edge) => sum.add(edge));
          constraints.push(degree.eq(0).or(degree.eq(2)));
        }
      }
    }

    return constraints;
  },
};

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("VertexDegreeRule", () => {
    it("should be satisfied with valid vertex degrees (0 or 2)", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      const boardVar = createBoardVariable(
        {
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
        },
        ctx,
      );

      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      vertexDegreeConstraints.forEach((constraint) => solver.add(constraint));

      // 全てのエッジを0に設定（すべての頂点の次数が0）
      boardVar.horizontalEdges.flat().forEach((edge) => solver.add(edge.eq(0)));
      boardVar.verticalEdges.flat().forEach((edge) => solver.add(edge.eq(0)));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with invalid vertex degrees (1 or 3)", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      const boardVar = createBoardVariable(
        {
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
        },
        ctx,
      );

      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      vertexDegreeConstraints.forEach((constraint) => solver.add(constraint));

      // 頂点[0][0]の次数を1にする（無効）
      solver.add(boardVar.horizontalEdges[0][0].eq(1));
      solver.add(boardVar.verticalEdges[0][0].eq(0));

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}

export const AllEdgesInLoopRule: Rule = {
  id: "all-edges-in-loop-rule",
  name: "全エッジループ制約",
  description: "すべてのエッジはループの一部である（孤立エッジなし）",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];

    // 実際には、VertexDegreeRuleと組み合わせることで
    // 「すべてのエッジはループの一部である」ことが保証される
    // ここでは、より簡潔に「エッジが1の場合、その両端の頂点は少なくとも次数1以上」という制約を追加
    // ただし、実際にはVertexDegreeRuleがあれば十分なので、
    // このルールは主に明示的な意図を示すためのものとする

    // 簡単な実装として、エッジが存在する場合は
    // そのエッジを含む何らかのパスが存在することを要求する
    // しかし、SMTソルバーで直接パスの存在を表現するのは複雑なので、
    // ここでは基本的な制約のみを実装する

    // エッジが1の場合、その両端の頂点の次数が少なくとも1以上であることを要求
    // （ただし、VertexDegreeRuleにより次数は0または2なので、実質的に2）

    // この実装では、主にVertexDegreeRuleに依存する
    // 独立した制約としては、特に追加する制約がないため
    // 空の制約リストを返す（VertexDegreeRuleで十分カバーされるため）

    return constraints;
  },
};

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("AllEdgesInLoopRule", () => {
    it("should be satisfied with any valid configuration", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      // AllEdgesInLoopRuleは空の制約を返すため、常にsatisfiable
      const boardVar = createBoardVariable(
        {
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
        },
        ctx,
      );

      const allEdgesInLoopConstraints = AllEdgesInLoopRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      allEdgesInLoopConstraints.forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be satisfied even with arbitrary edge configuration", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      // AllEdgesInLoopRuleは空の制約なので、任意の設定でもsat
      const boardVar = createBoardVariable(
        {
          size: 2,
          cells: [
            [0, 0],
            [0, 0],
          ],
          horizontalEdges: [
            [1, 1],
            [1, 1],
            [1, 1],
          ],
          verticalEdges: [
            [1, 1, 1],
            [1, 1, 1],
          ],
        },
        ctx,
      );

      const allEdgesInLoopConstraints = AllEdgesInLoopRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenEdgeConstraints = createGivenEdgesRule({
        size: 2,
        cells: [
          [0, 0],
          [0, 0],
        ],
        horizontalEdges: [
          [1, 1],
          [1, 1],
          [1, 1],
        ],
        verticalEdges: [
          [1, 1, 1],
          [1, 1, 1],
        ],
      }).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...allEdgesInLoopConstraints, ...givenEdgeConstraints].forEach(
        (constraint) => solver.add(constraint),
      );

      const result = await solver.check();
      expect(result).toBe("sat");
    });
  });
}

// 補助関数: 頂点(p,q)の次数が2かどうか
function isDegree2<T extends string>(
  boardVar: BoardVariable<T>,
  ctx: Context<T>,
  p: number,
  q: number,
): Bool<T> {
  const adjacentEdges: Arith<T>[] = [];

  // 上のエッジ
  if (
    p > 0 &&
    p - 1 < boardVar.horizontalEdges.length &&
    q < boardVar.horizontalEdges[p - 1].length
  ) {
    adjacentEdges.push(boardVar.horizontalEdges[p - 1][q]);
  }

  // 下のエッジ
  if (
    p < boardVar.horizontalEdges.length &&
    q < boardVar.horizontalEdges[p].length
  ) {
    adjacentEdges.push(boardVar.horizontalEdges[p][q]);
  }

  // 左のエッジ
  if (
    p < boardVar.verticalEdges.length &&
    q > 0 &&
    q - 1 < boardVar.verticalEdges[p].length
  ) {
    adjacentEdges.push(boardVar.verticalEdges[p][q - 1]);
  }

  // 右のエッジ
  if (
    p < boardVar.verticalEdges.length &&
    q < boardVar.verticalEdges[p].length
  ) {
    adjacentEdges.push(boardVar.verticalEdges[p][q]);
  }

  if (adjacentEdges.length === 0) {
    return ctx.Bool.val(false);
  }

  const degree = adjacentEdges.reduce((sum, edge) => sum.add(edge));
  return degree.eq(2);
}

// 補助関数: 頂点(p1,q1)と(p2,q2)がエッジで直接接続されているか
function hasEdgeBetween<T extends string>(
  boardVar: BoardVariable<T>,
  ctx: Context<T>,
  p1: number,
  q1: number,
  p2: number,
  q2: number,
): Bool<T> {
  // 隣接していない場合
  if (Math.abs(p1 - p2) + Math.abs(q1 - q2) !== 1) {
    return ctx.Bool.val(false);
  }

  // 水平に隣接
  if (p1 === p2) {
    const minQ = Math.min(q1, q2);
    const maxQ = Math.max(q1, q2);
    if (
      p1 < boardVar.verticalEdges.length &&
      maxQ < boardVar.verticalEdges[p1].length
    ) {
      return boardVar.verticalEdges[p1][maxQ].eq(1);
    }
  }

  // 垂直に隣接
  if (q1 === q2) {
    const minP = Math.min(p1, p2);
    const maxP = Math.max(p1, p2);
    if (
      maxP < boardVar.horizontalEdges.length &&
      q1 < boardVar.horizontalEdges[maxP].length
    ) {
      return boardVar.horizontalEdges[maxP][q1].eq(1);
    }
  }

  return ctx.Bool.val(false);
}

// 補助関数: 頂点(p,q)の隣接頂点リストを取得
function getNeighbors<T extends string>(
  boardVar: BoardVariable<T>,
  p: number,
  q: number,
): [number, number][] {
  const neighbors: [number, number][] = [];
  const size = boardVar.size;

  // 上
  if (p > 0) neighbors.push([p - 1, q]);
  // 下
  if (p < size) neighbors.push([p + 1, q]);
  // 左
  if (q > 0) neighbors.push([p, q - 1]);
  // 右
  if (q < size) neighbors.push([p, q + 1]);

  return neighbors;
}

// ヘルパー関数のテスト
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("Helper Functions", () => {
    describe("isDegree2", () => {
      it("should return true for vertex with exactly 2 adjacent edges", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("./states.js");

        // 2x2グリッドで頂点(1,1)が次数2になるケース（左と上のエッジのみ）
        const boardVar = createBoardVariable(
          {
            size: 2,
            cells: [
              [0, 0],
              [0, 0],
            ],
            horizontalEdges: [
              [0, 1], // 上のエッジのみ1
              [0, 0],
              [0, 0],
            ],
            verticalEdges: [
              [0, 0, 0],
              [1, 0, 0], // 左のエッジのみ1
            ],
          },
          ctx,
        );

        const solver = new ctx.Solver();

        // エッジ値を固定 - 頂点(1,1)に隣接するエッジを2つだけ1にする
        solver.add(boardVar.horizontalEdges[0][1].eq(1)); // 上のエッジ
        solver.add(boardVar.verticalEdges[1][0].eq(1)); // 左のエッジ

        // 他のエッジは0に固定
        solver.add(boardVar.horizontalEdges[0][0].eq(0));
        // horizontalEdges[0][1] は上で1に設定済み
        solver.add(boardVar.horizontalEdges[1][0].eq(0));
        solver.add(boardVar.horizontalEdges[1][1].eq(0)); // 下のエッジは0
        solver.add(boardVar.horizontalEdges[2][0].eq(0));
        solver.add(boardVar.horizontalEdges[2][1].eq(0));
        solver.add(boardVar.verticalEdges[0][0].eq(0));
        solver.add(boardVar.verticalEdges[0][1].eq(0));
        solver.add(boardVar.verticalEdges[0][2].eq(0));
        // verticalEdges[1][0] は上で1に設定済み
        solver.add(boardVar.verticalEdges[1][1].eq(0)); // 右のエッジは0
        solver.add(boardVar.verticalEdges[1][2].eq(0));

        // 頂点(1,1)が次数2かテスト
        const deg2 = isDegree2(boardVar, ctx, 1, 1);
        solver.add(deg2);

        const result = await solver.check();
        expect(result).toBe("sat");
      });

      it("should return false for vertex with degree 0", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("./states.js");

        const boardVar = createBoardVariable(
          {
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
          },
          ctx,
        );

        const solver = new ctx.Solver();

        // 全エッジを0に固定
        for (let p = 0; p <= 2; p++) {
          for (let q = 0; q < 2; q++) {
            solver.add(boardVar.horizontalEdges[p][q].eq(0));
          }
        }
        for (let p = 0; p < 2; p++) {
          for (let q = 0; q <= 2; q++) {
            solver.add(boardVar.verticalEdges[p][q].eq(0));
          }
        }

        // 頂点(1,1)が次数2でないことをテスト
        const deg2 = isDegree2(boardVar, ctx, 1, 1);
        solver.add(ctx.Not(deg2));

        const result = await solver.check();
        expect(result).toBe("sat");
      });
    });

    describe("hasEdgeBetween", () => {
      it("should return true when horizontal edge exists", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("./states.js");

        const boardVar = createBoardVariable(
          {
            size: 2,
            cells: [
              [0, 0],
              [0, 0],
            ],
            horizontalEdges: [
              [1, 0],
              [0, 0],
              [0, 0],
            ],
            verticalEdges: [
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
          ctx,
        );

        const solver = new ctx.Solver();
        solver.add(boardVar.horizontalEdges[0][0].eq(1));

        // 頂点(0,0)と(0,1)の間にエッジがあることをテスト
        const hasEdge = hasEdgeBetween(boardVar, ctx, 0, 0, 0, 1);
        solver.add(hasEdge);

        const result = await solver.check();
        expect(result).toBe("sat");
      });

      it("should return true when vertical edge exists", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("./states.js");

        const boardVar = createBoardVariable(
          {
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
              [1, 0, 0],
              [0, 0, 0],
            ],
          },
          ctx,
        );

        const solver = new ctx.Solver();
        solver.add(boardVar.verticalEdges[0][0].eq(1));

        // 頂点(0,0)と(1,0)の間にエッジがあることをテスト
        const hasEdge = hasEdgeBetween(boardVar, ctx, 0, 0, 1, 0);
        solver.add(hasEdge);

        const result = await solver.check();
        expect(result).toBe("sat");
      });

      it("should return false for non-adjacent vertices", async () => {
        const z3 = await import("z3-solver");
        const { Context } = await z3.init();
        const ctx = Context("test");
        const { createBoardVariable } = await import("./states.js");

        const boardVar = createBoardVariable(
          {
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
          },
          ctx,
        );

        // 頂点(0,0)と(1,1)は隣接していないのでfalseが返される
        const hasEdge = hasEdgeBetween(boardVar, ctx, 0, 0, 1, 1);
        expect(hasEdge.toString()).toContain("false");
      });
    });

    describe("getNeighbors", () => {
      it("should return correct neighbors for corner vertex", () => {
        // サイズ2のグリッドの模擬BoardVariable
        const mockBoardVar = { size: 2 } as BoardVariable<"test">;

        const neighbors = getNeighbors(mockBoardVar, 0, 0);
        // 順番: 上、下、左、右
        // (0,0)の場合: 上なし、下(1,0)、左なし、右(0,1)
        expect(neighbors).toEqual([
          [1, 0], // 下
          [0, 1], // 右
        ]);
      });

      it("should return correct neighbors for center vertex", () => {
        // サイズ2のグリッドの模擬BoardVariable
        const mockBoardVar = { size: 2 } as BoardVariable<"test">;

        const neighbors = getNeighbors(mockBoardVar, 1, 1);
        // 順番: 上、下、左、右
        // (1,1)の場合: 上(0,1)、下(2,1)、左(1,0)、右(1,2)
        expect(neighbors).toEqual([
          [0, 1], // 上
          [2, 1], // 下
          [1, 0], // 左
          [1, 2], // 右
        ]);
      });

      it("should return correct neighbors for edge vertex", () => {
        // サイズ2のグリッドの模擬BoardVariable
        const mockBoardVar = { size: 2 } as BoardVariable<"test">;

        const neighbors = getNeighbors(mockBoardVar, 0, 1);
        // 順番: 上、下、左、右
        // (0,1)の場合: 上なし、下(1,1)、左(0,0)、右(0,2)
        expect(neighbors).toEqual([
          [1, 1], // 下
          [0, 0], // 左
          [0, 2], // 右
        ]);
      });
    });
  });
}

export const SingleLoopRule: Rule = {
  id: "single-loop-rule",
  name: "単一ループ制約（到達可能性ベース）",
  description: "距離変数を使用して単一のループのみを許可",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];
    const size = boardVar.size;

    // 距離変数ベースの単一ループ制約
    // 各頂点の距離変数（ルートからの距離、-1はループに含まれない頂点）
    const dist: Arith<T>[][] = [];
    for (let p = 0; p <= size; p++) {
      dist[p] = [];
      for (let q = 0; q <= size; q++) {
        dist[p][q] = ctx.Int.const(`dist_${p}_${q}`);
        // 距離は-1以上、最大でもループサイズ以下
        constraints.push(dist[p][q].ge(-1));
        constraints.push(dist[p][q].le((size + 1) * 2)); // 最大ループサイズ
      }
    }

    // 制約1: ループに含まれない頂点（次数が2でない）の距離は-1
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q <= size; q++) {
        const deg2 = isDegree2(boardVar, ctx, p, q);
        constraints.push(ctx.Implies(ctx.Not(deg2), dist[p][q].eq(-1)));
      }
    }

    // 制約2: ルートの一意性（距離0の頂点は最大1個）
    let rootCount: Arith<T> = ctx.Int.val(0);
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q <= size; q++) {
        const deg2 = isDegree2(boardVar, ctx, p, q);
        const isRoot = ctx.And(deg2, dist[p][q].eq(0));
        rootCount = rootCount.add(
          ctx.If(isRoot, ctx.Int.val(1), ctx.Int.val(0)),
        );
      }
    }

    // 次数2の頂点が存在するかチェック
    let hasDeg2Vertex: Bool<T> = ctx.Bool.val(false);
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q <= size; q++) {
        const deg2 = isDegree2(boardVar, ctx, p, q);
        hasDeg2Vertex = ctx.Or(hasDeg2Vertex, deg2);
      }
    }

    // ループが存在する場合はルートが1個、存在しない場合はルートが0個
    constraints.push(ctx.Implies(hasDeg2Vertex, rootCount.eq(1)));
    constraints.push(ctx.Implies(ctx.Not(hasDeg2Vertex), rootCount.eq(0)));

    // 制約3: 親子関係制約（ループを考慮）
    // 次数2の各頂点について、隣接する次数2の頂点の中でちょうど1つが親（距離が1小さい）または子（距離が1大きい）である
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q <= size; q++) {
        const deg2 = isDegree2(boardVar, ctx, p, q);

        // 隣接する次数2の頂点の中で、親または子を探す
        const neighbors = getNeighbors(boardVar, p, q);
        const hasParentOrChild: Bool<T>[] = [];

        for (const neighbor of neighbors) {
          const [np, nq] = neighbor;
          if (np >= 0 && np <= size && nq >= 0 && nq <= size) {
            const hasEdge = hasEdgeBetween(boardVar, ctx, p, q, np, nq);
            const neighborDeg2 = isDegree2(boardVar, ctx, np, nq);

            // 親の場合: 隣接頂点の距離 = 自分の距離 - 1
            const isParent = dist[np][nq].eq(dist[p][q].sub(1));
            // 子の場合: 隣接頂点の距離 = 自分の距離 + 1
            const isChild = dist[np][nq].eq(dist[p][q].add(1));
            // ループの特殊ケース: ルート（距離0）と最大距離の頂点の関係
            const isLoopConnection = ctx.And(
              ctx.Or(
                ctx.And(dist[p][q].eq(0), dist[np][nq].gt(0)),
                ctx.And(dist[np][nq].eq(0), dist[p][q].gt(0)),
              ),
            );

            // エッジが存在し、隣接頂点が次数2で、親子関係またはループ接続がある
            hasParentOrChild.push(
              ctx.And(
                hasEdge,
                neighborDeg2,
                ctx.Or(isParent, isChild, isLoopConnection),
              ),
            );
          }
        }

        if (hasParentOrChild.length > 0) {
          // 次数2の頂点は必ず隣接する次数2の頂点と適切な距離関係を持つ
          constraints.push(ctx.Implies(deg2, ctx.Or(...hasParentOrChild)));
        }
      }
    }

    // シンプルな制約: ループが存在する場合、最低4エッジ必要
    let totalEdges: Arith<T> = ctx.Int.val(0);

    // 水平エッジを数える
    for (let p = 0; p <= size; p++) {
      for (let q = 0; q < size; q++) {
        totalEdges = totalEdges.add(boardVar.horizontalEdges[p][q]);
      }
    }

    // 垂直エッジを数える
    for (let p = 0; p < size; p++) {
      for (let q = 0; q <= size; q++) {
        totalEdges = totalEdges.add(boardVar.verticalEdges[p][q]);
      }
    }

    // ループが存在する場合、最低4エッジ必要
    constraints.push(ctx.Implies(hasDeg2Vertex, totalEdges.ge(4)));

    return constraints;
  },
};

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("SingleLoopRule (Reachability-based)", () => {
    it("should be satisfied with no edges", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      const boardVar = createBoardVariable(
        {
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
        },
        ctx,
      );

      const singleLoopConstraints = SingleLoopRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      singleLoopConstraints.forEach((constraint) => solver.add(constraint));

      // 全エッジを0に固定（エッジなし）
      boardVar.horizontalEdges.flat().forEach((edge) => solver.add(edge.eq(0)));
      boardVar.verticalEdges.flat().forEach((edge) => solver.add(edge.eq(0)));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be satisfied with a valid single loop", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      const boardVar = createBoardVariable(
        {
          size: 2,
          cells: [
            [0, 0],
            [0, 0],
          ],
          horizontalEdges: [
            [1, 1], // 上の行
            [0, 0], // 真ん中の行
            [1, 1], // 下の行
          ],
          verticalEdges: [
            [1, 0, 1], // 左と右の境界
            [1, 0, 1],
          ],
        },
        ctx,
      );

      const singleLoopConstraints = SingleLoopRule.getConstraints(
        boardVar,
        ctx,
      );
      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );
      const givenEdgeConstraints = createGivenEdgesRule({
        size: 2,
        cells: [
          [0, 0],
          [0, 0],
        ],
        horizontalEdges: [
          [1, 1],
          [0, 0],
          [1, 1],
        ],
        verticalEdges: [
          [1, 0, 1],
          [1, 0, 1],
        ],
      }).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [
        ...singleLoopConstraints,
        ...vertexDegreeConstraints,
        ...givenEdgeConstraints,
      ].forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with multiple disconnected loops", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("./states.js");

      const boardVar = createBoardVariable(
        {
          size: 3,
          cells: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
          horizontalEdges: [
            [1, 1, 0],
            [0, 0, 0],
            [0, 0, 1],
            [0, 0, 1],
          ],
          verticalEdges: [
            [1, 1, 0, 0],
            [1, 1, 0, 0],
            [0, 0, 1, 1],
          ],
        },
        ctx,
      );

      const singleLoopConstraints = SingleLoopRule.getConstraints(
        boardVar,
        ctx,
      );
      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );

      // 2つの独立した小さなループを作る設定
      const givenEdgeConstraints = createGivenEdgesRule({
        size: 3,
        cells: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        horizontalEdges: [
          [1, 1, 0], // 左上のループ
          [0, 0, 0],
          [0, 0, 1], // 右下のループ
          [0, 0, 1],
        ],
        verticalEdges: [
          [1, 1, 0, 0],
          [1, 1, 0, 0],
          [0, 0, 1, 1],
        ],
      }).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [
        ...singleLoopConstraints,
        ...vertexDegreeConstraints,
        ...givenEdgeConstraints,
      ].forEach((constraint) => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
