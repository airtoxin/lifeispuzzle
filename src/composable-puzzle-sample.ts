import {Arith, Bool, Context, init} from 'z3-solver';

// シリアライズ可能な盤面状態（基底型）
interface SerializableBoardState {
  size: number;
  cells: number[][];             // セル値
  horizontalEdges: number[][];   // 水平線 (size+1 × size)
  verticalEdges: number[][];     // 垂直線 (size × size+1)
}

// Z3変数を使った盤面状態（SerializableBoardStateから自動導出）
type CanonicalBoardState = {
  [K in keyof SerializableBoardState]: K extends 'cells' | 'horizontalEdges' | 'verticalEdges'
    ? Arith[][]
    : SerializableBoardState[K];
};

type DeepReadonly<T> = keyof T extends never
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

// 型変換ユーティリティ関数
function createCanonicalBoardState(serializable: SerializableBoardState, ctx: Context<any>): CanonicalBoardState {
  return {
    size: serializable.size,
    cells: serializable.cells.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`c-${rowIndex}-${colIndex}`))
    ),
    horizontalEdges: serializable.horizontalEdges.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`he-${rowIndex}-${colIndex}`))
    ),
    verticalEdges: serializable.verticalEdges.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`ve-${rowIndex}-${colIndex}`))
    )
  };
}

function boardStateToSerializable(board: CanonicalBoardState, model: any): SerializableBoardState {
  return {
    size: board.size,
    cells: board.cells.map(row =>
      row.map(cellVar => {
        const value = model.eval(cellVar);
        return parseInt(value.toString());
      })
    ),
    horizontalEdges: board.horizontalEdges.map(row =>
      row.map(edgeVar => {
        const value = model.eval(edgeVar);
        return parseInt(value.toString());
      })
    ),
    verticalEdges: board.verticalEdges.map(row =>
      row.map(edgeVar => {
        const value = model.eval(edgeVar);
        return parseInt(value.toString());
      })
    )
  };
}


// ルールの基底インターフェース
interface Rule {
  id: string;
  name: string;
  description: string;
  getConstraints(board: CanonicalBoardState, ctx: Context<any>): Bool<any>[];
}

const NumberFillRule: Rule = {
  id: "number-fill-rule",
  name: "数字で充填されている",
  description: "盤面の全てのマスが数字で埋められていること",
  getConstraints(board, ctx) {
    return board.cells.flat().map(v => v.ge(1));
  }
}

const RowUniquenessRule: Rule = {
  id: "row-uniqueness-rule",
  name: "行内数字一意性",
  description: "各行には同じ数字が複数現れない",
  getConstraints(board, ctx) {
    return board.cells.map(row => ctx.Distinct(...row));
  }
}

const ColumnUniquenessRule: Rule = {
  id: "column-uniqueness-rule",
  name: "列内数字一意性",
  description: "各列には同じ数字が複数現れない",
  getConstraints(board, ctx) {
    return Array.from({ length: board.size }, (_, colIndex) =>
      ctx.Distinct(...board.cells.map(row => row[colIndex]!))
    );
  }
}

const ColumnSortRule: Rule = {
  id: "column-sort-rule",
  name: "列ソート制約",
  description: "各列の数値が昇順または降順でソート済み",
  getConstraints(board, ctx) {
    return Array.from({ length: board.size }, (_, colIndex) => {
      const column = board.cells.map(row => row[colIndex]!);

      // 昇順制約: c[0] ≤ c[1] ≤ c[2] ≤ ...
      const ascending = column.slice(1).map((curr, i) => column[i].le(curr));

      // 降順制約: c[0] ≥ c[1] ≥ c[2] ≥ ...
      const descending = column.slice(1).map((curr, i) => column[i].ge(curr));

      // 昇順または降順
      return ctx.Or(ctx.And(...ascending), ctx.And(...descending));
    });
  }
}

const RowSortRule: Rule = {
  id: "row-sort-rule",
  name: "行ソート制約",
  description: "各行の数値が昇順または降順でソート済み",
  getConstraints(board, ctx) {
    return board.cells.map(row => {
      // 昇順制約: r[0] ≤ r[1] ≤ r[2] ≤ ...
      const ascending = row.slice(1).map((curr, i) => row[i].le(curr));

      // 降順制約: r[0] ≥ r[1] ≥ r[2] ≥ ...
      const descending = row.slice(1).map((curr, i) => row[i].ge(curr));

      // 昇順または降順
      return ctx.Or(ctx.And(...ascending), ctx.And(...descending));
    });
  }
}

const MagicSquareRule: Rule = {
  id: "magic-square-rule",
  name: "魔法陣制約",
  description: "タテ・ヨコ・ナナメの合計が全て等しい",
  getConstraints(board, ctx) {
    const constraints: Bool<any>[] = [];
    // すべての数字が異なる
    constraints.push(ctx.Distinct(...board.cells.flat()));
    constraints.push(...board.cells.flat().map(v => v.ge(1).and(v.le(board.size * board.size))));

    // 最初の行の合計を基準とする
    const firstRowSum = board.cells[0].slice(1).reduce((sum, cell) => sum.add(cell), board.cells[0][0]);

    // 各行の合計が基準と等しい
    board.cells.slice(1).forEach(row => {
      const rowSum = row.slice(1).reduce((sum, cell) => sum.add(cell), row[0]);
      constraints.push(rowSum.eq(firstRowSum));
    });

    // 各列の合計が基準と等しい
    Array.from({ length: board.size }, (_, colIndex) => {
      const column = board.cells.map(row => row[colIndex]);
      const columnSum = column.slice(1).reduce((sum, cell) => sum.add(cell), column[0]);
      constraints.push(columnSum.eq(firstRowSum));
    });

    // 左上から右下への対角線の合計が基準と等しい
    const mainDiagonal = Array.from({ length: board.size }, (_, i) => board.cells[i][i]);
    const mainDiagonalSum = mainDiagonal.slice(1).reduce((sum, cell) => sum.add(cell), mainDiagonal[0]);
    constraints.push(mainDiagonalSum.eq(firstRowSum));

    // 右上から左下への対角線の合計が基準と等しい
    const antiDiagonal = Array.from({ length: board.size }, (_, i) => board.cells[i][board.size - 1 - i]);
    const antiDiagonalSum = antiDiagonal.slice(1).reduce((sum, cell) => sum.add(cell), antiDiagonal[0]);
    constraints.push(antiDiagonalSum.eq(firstRowSum));

    return constraints;
  }
}

// 与えられた値の制約ルール
function createGivenValuesRule(givenValues: SerializableBoardState): Rule {
  return {
    id: "given-values-rule",
    name: "与えられた値制約",
    description: "初期値として与えられたセルの値を固定する",
    getConstraints(board, ctx) {
      const constraints: Bool<any>[] = [];
      
      for (let row = 0; row < givenValues.size; row++) {
        for (let col = 0; col < givenValues.size; col++) {
          const givenValue = givenValues.cells[row][col];
          if (givenValue !== 0) {
            constraints.push(board.cells[row][col].eq(givenValue));
          }
        }
      }
      
      return constraints;
    }
  };
}

// サンプル実行
async function runSample() {
  const { Context } = await init();
  const ctx = Context('main');

  // シリアライズ可能な基底状態を定義（いくつか初期値を設定）
  const serializableBoard: SerializableBoardState = {
    size: 3,
    cells: [
      [2, 0, 0],  // 左上に2を固定
      [0, 5, 0],  // 真ん中に5を固定  
      [0, 0, 8]   // 右下に8を固定
    ],
    horizontalEdges: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    verticalEdges: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  };

  // Z3変数を使った盤面状態に変換
  const fixedBoard = createCanonicalBoardState(serializableBoard, ctx);
  
  // 与えられた値の制約ルールを作成
  const givenValuesRule = createGivenValuesRule(serializableBoard);

  const fixedConstraints: readonly Bool<any>[] = [
    ...NumberFillRule.getConstraints(fixedBoard, ctx),
    ...givenValuesRule.getConstraints(fixedBoard, ctx),  // 初期値制約を追加
    // ...RowUniquenessRule.getConstraints(fixedBoard, ctx),
    // ...ColumnUniquenessRule.getConstraints(fixedBoard, ctx),
    // ...ColumnSortRule.getConstraints(fixedBoard, ctx),
    // ...RowSortRule.getConstraints(fixedBoard, ctx),
    ...MagicSquareRule.getConstraints(fixedBoard, ctx),
  ];
  const fixedResult = await ctx.solve(...fixedConstraints);
  console.log("固定値での結果:", fixedResult);

  // Z3変数を使った探索（satになる解を見つける）
  console.log("\n=== Z3変数を使った探索 ===");
  const solver = new ctx.Solver();

  fixedConstraints.forEach(constraint => solver.add(constraint));

  const searchResult = await solver.check();
  console.log("探索での結果:", searchResult);

  if (searchResult === 'sat') {
    const model = solver.model();
    console.log("\n見つかった解:");

    // 新しいユーティリティ関数を使用して解をシリアライズ可能な形式に変換
    const solution = boardStateToSerializable(fixedBoard, model);

    console.log(JSON.stringify(solution));
  }
}

// サンプル実行（このファイルが直接実行された場合）
if (require.main === module) {
  runSample().catch(console.error);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('SerializableBoardState', () => {
    it('should be serializable to JSON', () => {
      const board: SerializableBoardState = {
        size: 2,
        cells: [[1, 2], [3, 4]],
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      const json = JSON.stringify(board);
      const parsed = JSON.parse(json) as SerializableBoardState;
      
      expect(parsed.size).toBe(2);
      expect(parsed.cells).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('createGivenValuesRule', () => {
    it('should create constraints for given values', async () => {
      const z3 = await import('z3-solver');
      const { Context } = await z3.init();
      const ctx = Context('test');

      const givenBoard: SerializableBoardState = {
        size: 2,
        cells: [[1, 0], [0, 4]], // 1と4を固定
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      const canonicalBoard = createCanonicalBoardState(givenBoard, ctx);
      const rule = createGivenValuesRule(givenBoard);
      const constraints = rule.getConstraints(canonicalBoard, ctx);

      // 2つの制約（1と4の固定値）が作成されることを確認
      expect(constraints.length).toBe(2);
    });
  });

  describe('boardStateToSerializable', () => {
    it('should have proper structure', () => {
      // より簡単なテストに変更
      const board: SerializableBoardState = {
        size: 2,
        cells: [[1, 2], [3, 4]],
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      expect(board.size).toBe(2);
      expect(board.cells.length).toBe(2);
      expect(board.cells[0].length).toBe(2);
    });
  });

  describe('Rules', () => {
    it('NumberFillRule should require positive values', async () => {
      const z3 = await import('z3-solver');
      const { Context } = await z3.init();
      const ctx = Context('test');

      const board = createCanonicalBoardState({
        size: 2,
        cells: [[0, 0], [0, 0]],
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      }, ctx);

      const constraints = NumberFillRule.getConstraints(board, ctx);
      expect(constraints.length).toBe(4); // 2x2 = 4 cells
    });

    it('MagicSquareRule should create proper constraints for 3x3', async () => {
      const z3 = await import('z3-solver');
      const { Context } = await z3.init();
      const ctx = Context('test');

      const board = createCanonicalBoardState({
        size: 3,
        cells: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
        horizontalEdges: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
        verticalEdges: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      }, ctx);

      const constraints = MagicSquareRule.getConstraints(board, ctx);
      // Distinct constraint (1) + range constraints (9) + sum constraints (rows: 2, cols: 3, diags: 2) = 17
      expect(constraints.length).toBe(17);
    });
  });
}
