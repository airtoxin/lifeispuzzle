import { Context, Bool } from "z3-solver";
import { Rule } from "./rules/types";
import { BoardState, BoardVariable, createBoardVariable, boardVariableToState } from "./states";

// スリザーリンクのセルの数字制約ルール
export const SlitherlinkNumberConstraintRule: Rule = {
  id: "slitherlink-number-constraint-rule",
  name: "スリザーリンクの数字制約",
  description: "各セルの数字はその周りのエッジの数を示す",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];
    const size = boardVar.size;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cellValue = boardVar.cells[row][col];
        
        // セルの周りのエッジを収集
        const edges: Array<typeof boardVar.horizontalEdges[0][0]> = [];
        
        // 上のエッジ (水平)
        edges.push(boardVar.horizontalEdges[row][col]);
        // 下のエッジ (水平)
        edges.push(boardVar.horizontalEdges[row + 1][col]);
        // 左のエッジ (垂直)
        edges.push(boardVar.verticalEdges[row][col]);
        // 右のエッジ (垂直)
        edges.push(boardVar.verticalEdges[row][col + 1]);

        // セルの値が0でない場合、エッジの合計がセルの値と等しい
        const edgeSum = edges.reduce((sum, edge) => sum.add(edge));
        
        // セルの値が0の場合は制約なし、0でない場合はエッジの合計と等しい
        constraints.push(
          cellValue.eq(0).implies(ctx.Bool.val(true)).and(
            cellValue.neq(0).implies(edgeSum.eq(cellValue))
          )
        );
      }
    }

    return constraints;
  },
};

// 頂点次数制約ルール（既存のものを再エクスポート）
import { VertexDegreeRule } from "./rules/VertexDegreeRule";
export { VertexDegreeRule };

// エッジバイナリルール（既存のものを再エクスポート）
import { EdgeBinaryRule } from "./rules/EdgeBinaryRule";
export { EdgeBinaryRule };

// スリザーリンク単一ループルール（既存のものを再エクスポート）
import { SingleLoopRule } from "./rules/SingleLoopRule";
export { SingleLoopRule };

// スリザーリンクの全ルール
export const SlitherlinkRules = [
  EdgeBinaryRule,
  SlitherlinkNumberConstraintRule,
  VertexDegreeRule,
  SingleLoopRule,
];

// スリザーリンクソルバー
export interface SlitherlinkPuzzle {
  size: number;
  clues: (number | null)[][]; // nullは空セル
}

export function createSlitherlinkBoardState(puzzle: SlitherlinkPuzzle): BoardState {
  const size = puzzle.size;
  return {
    size,
    cells: puzzle.clues.map(row => 
      row.map(clue => clue === null ? 0 : clue)
    ),
    horizontalEdges: Array(size + 1).fill(null).map(() => Array(size).fill(0)),
    verticalEdges: Array(size).fill(null).map(() => Array(size + 1).fill(0)),
  };
}

export async function solveSlitherlink(puzzle: SlitherlinkPuzzle): Promise<BoardState | null> {
  const z3 = await import("z3-solver");
  const { Context } = await z3.init();
  const ctx = Context("slitherlink");

  const boardState = createSlitherlinkBoardState(puzzle);
  const boardVar = createBoardVariable(boardState, ctx);

  const solver = new ctx.Solver();

  // 与えられたクリューの制約を追加
  const { createGivenValuesRule } = await import("./rules/helpers");
  const givenValuesRule = createGivenValuesRule(boardState);
  const givenConstraints = givenValuesRule.getConstraints(boardVar, ctx);
  givenConstraints.forEach(constraint => solver.add(constraint));

  // スリザーリンクのルールを追加
  SlitherlinkRules.forEach(rule => {
    const constraints = rule.getConstraints(boardVar, ctx);
    constraints.forEach(constraint => solver.add(constraint));
  });

  const result = await solver.check();
  if (result === "sat") {
    const model = solver.model();
    return boardVariableToState(boardVar, model);
  } else {
    return null;
  }
}

// 結果をビジュアライズする関数
export function visualizeSlitherlinkSolution(solution: BoardState): string {
  const size = solution.size;
  let result = "";

  for (let row = 0; row <= size; row++) {
    // 頂点と水平エッジの行
    let line = "";
    for (let col = 0; col <= size; col++) {
      // 頂点
      line += "+";
      
      // 水平エッジ（最後の列でない場合）
      if (col < size && row < size + 1) {
        const hasEdge = solution.horizontalEdges[row][col] === 1;
        line += hasEdge ? "---" : "   ";
      }
    }
    result += line + "\n";

    // セルと垂直エッジの行（最後の行でない場合）
    if (row < size) {
      line = "";
      for (let col = 0; col <= size; col++) {
        // 垂直エッジ
        const hasEdge = solution.verticalEdges[row][col] === 1;
        line += hasEdge ? "|" : " ";
        
        // セル（最後の列でない場合）
        if (col < size) {
          const cellValue = solution.cells[row][col];
          const cellDisplay = cellValue === 0 ? " " : cellValue.toString();
          line += ` ${cellDisplay} `;
        }
      }
      result += line + "\n";
    }
  }

  return result;
}

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("SlitherlinkNumberConstraintRule", () => {
    it("should enforce number constraints correctly", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");

      // 2x2の例：数字3がある場合、周りの4つのエッジのうち3つが1である必要がある
      const boardState: BoardState = {
        size: 2,
        cells: [
          [3, 0],
          [0, 0],
        ],
        horizontalEdges: [
          [1, 0], // 上の行
          [1, 0], // 真ん中の行
          [1, 0], // 下の行
        ],
        verticalEdges: [
          [1, 0, 0], // 左の列、真ん中の列、右の列
          [0, 0, 0],
        ],
      };

      const boardVar = createBoardVariable(boardState, ctx);
      const constraints = SlitherlinkNumberConstraintRule.getConstraints(boardVar, ctx);
      
      const { createGivenValuesRule } = await import("./rules/helpers");
      const givenConstraints = createGivenValuesRule(boardState).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...constraints, ...givenConstraints].forEach(constraint => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should reject invalid number constraints", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");

      // 2x2の例：数字3があるが、すべてのエッジを0に固定（矛盾）
      const boardState: BoardState = {
        size: 2,
        cells: [
          [3, 0],
          [0, 0],
        ],
        horizontalEdges: [
          [0, 0], // 上の行 - すべて0に固定
          [0, 0], // 真ん中の行  
          [0, 0], // 下の行
        ],
        verticalEdges: [
          [0, 0, 0], // 左の列、真ん中の列、右の列 - すべて0に固定
          [0, 0, 0],
        ],
      };

      const boardVar = createBoardVariable(boardState, ctx);
      const constraints = SlitherlinkNumberConstraintRule.getConstraints(boardVar, ctx);
      
      const { createGivenValuesRule, createGivenEdgesRule } = await import("./rules/helpers");
      const givenConstraints = createGivenValuesRule(boardState).getConstraints(boardVar, ctx);
      const edgeConstraints = createGivenEdgesRule(boardState).getConstraints(boardVar, ctx);

      const solver = new ctx.Solver();
      [...constraints, ...givenConstraints, ...edgeConstraints].forEach(constraint => solver.add(constraint));

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });


  describe("solveSlitherlink", () => {
    it("should solve the 3x3 puzzle correctly", async () => {
      const puzzle: SlitherlinkPuzzle = {
        size: 3,
        clues: [
          [null, 3, null],
          [3, null, 3],
          [null, 3, null],
        ],
      };

      const solution = await solveSlitherlink(puzzle);
      expect(solution).not.toBeNull();
      
      if (solution) {
        // 解が見つかった場合、ビジュアライズを確認
        const visualization = visualizeSlitherlinkSolution(solution);
        console.log("3x3 Slitherlink Solution:");
        console.log(visualization);
        
        // クリューが正しく解決されているか確認
        expect(solution.cells[0][1]).toBe(3); // クリュー: 3
        expect(solution.cells[1][0]).toBe(3); // クリュー: 3
        expect(solution.cells[1][2]).toBe(3); // クリュー: 3
        expect(solution.cells[2][1]).toBe(3); // クリュー: 3
      }
    });

    it("should visualize solution correctly", async () => {
      // 簡単な2x2の解をテスト
      const solution: BoardState = {
        size: 2,
        cells: [
          [2, 2],
          [2, 2],
        ],
        horizontalEdges: [
          [1, 1], // 上の行
          [0, 0], // 真ん中の行
          [1, 1], // 下の行
        ],
        verticalEdges: [
          [1, 0, 1], // 左の列、真ん中の列、右の列
          [1, 0, 1],
        ],
      };

      const visualization = visualizeSlitherlinkSolution(solution);
      expect(visualization).toMatchSnapshot();
    });
  });
}