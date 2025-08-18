import { init, Context } from 'z3-solver';
import { Puzzle } from './interfaces';
import { SudokuGrid } from './sudoku-solver';
import { NQueensPuzzle, NQueensSolution, NQueensSolver } from './nqueens-solver';
import { GraphColoringPuzzle, GraphColoringSolution, GraphColoringSolver } from './graph-coloring-solver';
import { Z3PuzzleFactory, createPuzzleSolver, PuzzleUtils } from './puzzle-factory';

// デモンストレーション用の関数
async function solveSudoku(ctx: Context): Promise<void> {
  console.log('=== 数独パズルの解法 ===');

  const sudokuSolver = createPuzzleSolver<SudokuGrid, SudokuGrid>('sudoku', ctx);

  const sudokuPuzzle: Puzzle<SudokuGrid> = {
    type: 'sudoku',
    data: {
      grid: [
        [0, 0, 6, 5, 0, 0, 0, 0, 0],
        [7, 0, 5, 0, 0, 2, 3, 0, 0],
        [0, 3, 0, 0, 0, 0, 0, 8, 0],
        [0, 5, 0, 0, 9, 6, 0, 7, 0],
        [1, 0, 4, 0, 0, 0, 0, 0, 8],
        [0, 0, 0, 8, 2, 0, 0, 0, 0],
        [0, 2, 0, 0, 0, 0, 0, 9, 0],
        [0, 0, 7, 2, 0, 0, 4, 0, 0],
        [0, 0, 0, 0, 7, 5, 0, 0, 0]
      ]
    }
  };

  const solution = await sudokuSolver.solve(sudokuPuzzle);

  if (solution.solved) {
    console.log('解が見つかりました:');
    solution.data.grid.forEach(row => {
      console.log(row.join(' '));
    });

    console.log(`\n解の一意性: ${solution.isUnique ? '一意解' : '複数解あり'}`);

    if (!solution.isUnique && solution.alternativeSolutions && solution.alternativeSolutions.length > 0) {
      console.log(`他の解の数: ${solution.alternativeSolutions.length}個`);
    }
  } else {
    console.log('解が見つかりませんでした。');
  }
}

async function solveNQueens(ctx: Context): Promise<void> {
  console.log('\n=== N-Queensパズルの解法 (8x8) ===');

  const nqueensSolver = createPuzzleSolver<NQueensPuzzle, NQueensSolution>('nqueens', ctx);

  const nqueensPuzzle: Puzzle<NQueensPuzzle> = {
    type: 'nqueens',
    data: { n: 8 }
  };

  const solution = await nqueensSolver.solve(nqueensPuzzle);

  if (solution.solved) {
    console.log('8-Queens問題の解が見つかりました:');
    console.log('クイーンの位置（行,列）:');
    solution.data.positions.forEach((col, row) => {
      console.log(`行${row}: 列${col}`);
    });

    console.log('\nボード表示:');
    console.log(NQueensSolver.displaySolution(solution.data));

    // 全解を探す（最大5個まで）
    const allSolutions = await nqueensSolver.findAllSolutions?.(nqueensPuzzle, 5);
    if (allSolutions) {
      console.log(`8-Queens問題の解の総数（最大5個表示）: ${allSolutions.length}個`);
    }
  } else {
    console.log('解が見つかりませんでした。');
  }
}

async function solveGraphColoring(ctx: Context): Promise<void> {
  console.log('\n=== グラフ彩色問題の解法 ===');

  const graphSolver = createPuzzleSolver<GraphColoringPuzzle, GraphColoringSolution>('graph-coloring', ctx);

  // 5頂点の完全グラフを作成（最低5色必要）
  const completeGraph = GraphColoringSolver.createCompleteGraph(5);
  const graphPuzzle: Puzzle<GraphColoringPuzzle> = {
    type: 'graph-coloring',
    data: completeGraph
  };

  console.log('5頂点の完全グラフ（K5）を5色で彩色:');
  const solution = await graphSolver.solve(graphPuzzle);

  if (solution.solved) {
    console.log(GraphColoringSolver.displaySolution(solution.data));

    // 最小彩色数を求める
    if (graphSolver instanceof GraphColoringSolver) {
      const minColorSolution = await graphSolver.findMinimalColoring(graphPuzzle);
      if (minColorSolution.solved) {
        console.log(`最小彩色数: ${minColorSolution.data.minimalColors}色`);
      }
    }
  } else {
    console.log('解が見つかりませんでした。');
  }

  // サイクルグラフでもテスト
  console.log('\n6頂点のサイクルグラフ（C6）を3色で彩色:');
  const cycleGraph = GraphColoringSolver.createCycleGraph(6);
  const cyclePuzzle: Puzzle<GraphColoringPuzzle> = {
    type: 'graph-coloring',
    data: cycleGraph
  };

  const cycleSolution = await graphSolver.solve(cyclePuzzle);
  if (cycleSolution.solved) {
    console.log(GraphColoringSolver.displaySolution(cycleSolution.data));
  }
}

async function demonstrateFactory(): Promise<void> {
  console.log('\n=== パズルファクトリーのデモンストレーション ===');

  const factory = Z3PuzzleFactory.getInstance();
  console.log('サポートされているパズルタイプ:', factory.getSupportedTypes().join(', '));

  // データから自動的にパズルタイプを推測
  const sudokuData = {
    grid: [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9]
    ]
  };

  try {
    const inferredType = PuzzleUtils.inferPuzzleType(sudokuData);
    console.log(`データから推測されたパズルタイプ: ${inferredType}`);

    const isValid = PuzzleUtils.validatePuzzleData(inferredType, sudokuData);
    console.log(`データの有効性: ${isValid ? '有効' : '無効'}`);
  } catch (error) {
    console.log('推測に失敗:', error);
  }
}

async function main(): Promise<void> {
  try {
    const { Context } = await init();
    const ctx = Context('main');

    await solveSudoku(ctx);
    await solveNQueens(ctx);
    await solveGraphColoring(ctx);
    await demonstrateFactory();

  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

if (require.main === module) {
  main();
}

// エクスポート
export * from './interfaces';
export * from './sudoku-solver';
export * from './nqueens-solver';
export * from './graph-coloring-solver';
export * from './puzzle-factory';
