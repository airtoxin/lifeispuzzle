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
    return board.cells.flat().map(v => v.ge(1).and(v.le(9)));
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
    return Array.from(Array(board.size)).map((_, i) => ctx.Distinct(...board.cells.map(row => row[i]!)));
  }
}

// サンプル実行
async function runSample() {
  const { Context } = await init();
  const ctx = Context('main');

  const fixedBoard: CanonicalBoardState = {
    size: 2,
    cells: [
      [ctx.Int.const("c-0-0"), ctx.Int.const("c-0-1")],
      [ctx.Int.const("c-1-0"), ctx.Int.const("c-1-1")]
    ],
    horizontalEdges: [
      [ctx.Int.const("he-0-0"), ctx.Int.const("he-0-1")],
      [ctx.Int.const("he-1-0"), ctx.Int.const("he-1-1")],
      [ctx.Int.const("he-2-0"), ctx.Int.const("he-2-1")]
    ],
    verticalEdges: [
      [ctx.Int.const("ve-0-0"), ctx.Int.const("ve-0-1"), ctx.Int.const("ve-0-2")],
      [ctx.Int.const("ve-1-0"), ctx.Int.const("ve-1-1"), ctx.Int.const("ve-1-2")],
    ]
  };

  const fixedConstraints: readonly Bool[] = [
    ...NumberFillRule.getConstraints(fixedBoard, ctx),
    ...RowUniquenessRule.getConstraints(fixedBoard, ctx),
    ...ColumnUniquenessRule.getConstraints(fixedBoard, ctx),
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
