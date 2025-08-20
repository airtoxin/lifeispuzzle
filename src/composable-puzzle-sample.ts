import {Arith, Bool, Context, init} from 'z3-solver';

// 盤面状態の正規表現
interface CanonicalBoardState {
  size: number;
  cells: Arith[][];             // セル値
  horizontalEdges: Arith[][];   // 水平線 (size+1 × size)
  verticalEdges: Arith[][];     // 垂直線 (size × size+1)
}

type DeepReadonly<T> = keyof T extends never
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };


// ルールの基底インターフェース
interface Rule {
  id: string;
  name: string;
  description: string;
  getConstraints(board: CanonicalBoardState, ctx: Context): Bool[];
}

const NumberFillRule: Rule = {
  id: "number-fill-rule",
  name: "数字で充填されている",
  description: "盤面の全てのマスが数字で埋められていること",
  getConstraints(board) {
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
    const constraints: Bool[] = [];
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

// サンプル実行
async function runSample() {
  const { Context } = await init();
  const ctx = Context('main');

  const fixedBoard: CanonicalBoardState = {
    size: 3,
    cells: [
      [ctx.Int.const("c-0-0"), ctx.Int.const("c-0-1"), ctx.Int.const("c-0-2")],
      [ctx.Int.const("c-1-0"), ctx.Int.const("c-1-1"), ctx.Int.const("c-1-2")],
      [ctx.Int.const("c-2-0"), ctx.Int.const("c-2-1"), ctx.Int.const("c-2-2")]
    ],
    horizontalEdges: [
      [ctx.Int.const("he-0-0"), ctx.Int.const("he-0-1"), ctx.Int.const("he-0-2")],
      [ctx.Int.const("he-1-0"), ctx.Int.const("he-1-1"), ctx.Int.const("he-1-2")],
      [ctx.Int.const("he-2-0"), ctx.Int.const("he-2-1"), ctx.Int.const("he-2-2")],
      [ctx.Int.const("he-3-0"), ctx.Int.const("he-3-1"), ctx.Int.const("he-3-2")]
    ],
    verticalEdges: [
      [ctx.Int.const("ve-0-0"), ctx.Int.const("ve-0-1"), ctx.Int.const("ve-0-2"), ctx.Int.const("ve-0-3")],
      [ctx.Int.const("ve-1-0"), ctx.Int.const("ve-1-1"), ctx.Int.const("ve-1-2"), ctx.Int.const("ve-1-3")],
      [ctx.Int.const("ve-2-0"), ctx.Int.const("ve-2-1"), ctx.Int.const("ve-2-2"), ctx.Int.const("ve-2-3")]
    ]
  };

  const fixedConstraints: readonly Bool[] = [
    ...NumberFillRule.getConstraints(fixedBoard, ctx),
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

    // JSON形式で解を表示
    const solution = {
      cells: fixedBoard.cells.map(row =>
        row.map(cellVar => {
          const value = model.eval(cellVar);
          return parseInt(value.toString());
        })
      ),
      horizontalEdges: fixedBoard.horizontalEdges.map(row =>
        row.map(edgeVar => {
          const value = model.eval(edgeVar);
          return parseInt(value.toString());
        })
      ),
      verticalEdges: fixedBoard.verticalEdges.map(row =>
        row.map(edgeVar => {
          const value = model.eval(edgeVar);
          return parseInt(value.toString());
        })
      )
    };

    console.log(JSON.stringify(solution));
  }
}

// サンプル実行（このファイルが直接実行された場合）
if (require.main === module) {
  runSample().catch(console.error);
}
