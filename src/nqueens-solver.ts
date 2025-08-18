import { Context, Bool, Solver, Model, CheckSatResult } from 'z3-solver';
import { Z3BaseSolver, Puzzle, Solution } from './interfaces';

// N-Queensパズルの型定義
export interface NQueensPuzzle {
  n: number; // ボードのサイズ（n x n）
}

export interface NQueensSolution {
  positions: number[]; // 各行のクイーンの列位置（0-indexed）
  n: number;
}

// N-Queensソルバー
export class NQueensSolver extends Z3BaseSolver<NQueensPuzzle, NQueensSolution> {
  public readonly solverType = 'nqueens';

  public async solve(puzzle: Puzzle<NQueensPuzzle>): Promise<Solution<NQueensSolution>> {
    const n = puzzle.data.n;
    
    if (n <= 0) {
      return this.createSolution({ positions: [], n }, false, {
        error: 'Invalid board size'
      });
    }

    // 各行のクイーンの列位置を表すブール変数を作成
    // queen[i][j] = true なら、行iの列jにクイーンがある
    const queen: Bool[][] = [];
    for (let i = 0; i < n; i++) {
      queen[i] = [];
      for (let j = 0; j < n; j++) {
        queen[i][j] = this.ctx.Bool.const(`queen_${i}_${j}`);
      }
    }

    const solver = new this.ctx.Solver();

    // 制約1: 各行にはちょうど1つのクイーンがある
    for (let i = 0; i < n; i++) {
      // 各行で少なくとも1つのクイーンがある
      solver.add(this.ctx.Or(...queen[i]));
      
      // 各行で最大1つのクイーンがある
      for (let j = 0; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          solver.add(this.ctx.Or(queen[i][j].not(), queen[i][k].not()));
        }
      }
    }

    // 制約2: 各列にはちょうど1つのクイーンがある
    for (let j = 0; j < n; j++) {
      // 各列で少なくとも1つのクイーンがある
      const colQueens: Bool[] = [];
      for (let i = 0; i < n; i++) {
        colQueens.push(queen[i][j]);
      }
      solver.add(this.ctx.Or(...colQueens));
      
      // 各列で最大1つのクイーンがある
      for (let i = 0; i < n; i++) {
        for (let k = i + 1; k < n; k++) {
          solver.add(this.ctx.Or(queen[i][j].not(), queen[k][j].not()));
        }
      }
    }

    // 制約3: 対角線上にクイーンが複数ないこと
    // 左上から右下への対角線
    for (let d = -(n-1); d <= (n-1); d++) {
      const diagQueens: Bool[] = [];
      for (let i = 0; i < n; i++) {
        const j = i + d;
        if (j >= 0 && j < n) {
          diagQueens.push(queen[i][j]);
        }
      }
      if (diagQueens.length > 1) {
        for (let p = 0; p < diagQueens.length; p++) {
          for (let q = p + 1; q < diagQueens.length; q++) {
            solver.add(this.ctx.Or(diagQueens[p].not(), diagQueens[q].not()));
          }
        }
      }
    }

    // 右上から左下への対角線
    for (let d = 0; d <= 2*(n-1); d++) {
      const diagQueens: Bool[] = [];
      for (let i = 0; i < n; i++) {
        const j = d - i;
        if (j >= 0 && j < n) {
          diagQueens.push(queen[i][j]);
        }
      }
      if (diagQueens.length > 1) {
        for (let p = 0; p < diagQueens.length; p++) {
          for (let q = p + 1; q < diagQueens.length; q++) {
            solver.add(this.ctx.Or(diagQueens[p].not(), diagQueens[q].not()));
          }
        }
      }
    }

    // 解を探す
    const result: CheckSatResult = await solver.check();

    if (result === 'sat') {
      const model: Model = solver.model();
      const positions: number[] = [];

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const value = model.eval(queen[i][j]);
          if (value.toString() === 'true') {
            positions[i] = j;
            break;
          }
        }
      }

      return this.createSolution({ positions, n }, true, {
        solverType: this.solverType,
        boardSize: n
      });
    }

    return this.createSolution({ positions: [], n }, false);
  }

  public async findAllSolutions(puzzle: Puzzle<NQueensPuzzle>, maxSolutions: number = 100): Promise<NQueensSolution[]> {
    const n = puzzle.data.n;
    const solutions: NQueensSolution[] = [];
    
    if (n <= 0) {
      return solutions;
    }

    // 各行のクイーンの列位置を表すブール変数を作成
    const queen: Bool[][] = [];
    for (let i = 0; i < n; i++) {
      queen[i] = [];
      for (let j = 0; j < n; j++) {
        queen[i][j] = this.ctx.Bool.const(`q_${i}_${j}`);
      }
    }

    const solver = new this.ctx.Solver();

    // N-Queensの制約を追加
    this.addNQueensConstraints(solver, queen, n);

    while (solutions.length < maxSolutions) {
      const result = await solver.check();
      
      if (result !== 'sat') {
        break;
      }

      const model = solver.model();
      const positions: number[] = [];

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const value = model.eval(queen[i][j]);
          if (value.toString() === 'true') {
            positions[i] = j;
            break;
          }
        }
      }

      solutions.push({ positions, n });

      // この解を除外する制約を追加
      const excludeConstraints: Bool[] = [];
      for (let i = 0; i < n; i++) {
        excludeConstraints.push(queen[i][positions[i]].not());
      }
      solver.add(this.ctx.Or(...excludeConstraints));
    }

    return solutions;
  }

  private addNQueensConstraints(solver: Solver, queen: Bool[][], n: number): void {
    // 制約1: 各行にはちょうど1つのクイーンがある
    for (let i = 0; i < n; i++) {
      solver.add(this.ctx.Or(...queen[i]));
      for (let j = 0; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          solver.add(this.ctx.Or(queen[i][j].not(), queen[i][k].not()));
        }
      }
    }

    // 制約2: 各列にはちょうど1つのクイーンがある
    for (let j = 0; j < n; j++) {
      const colQueens: Bool[] = [];
      for (let i = 0; i < n; i++) {
        colQueens.push(queen[i][j]);
      }
      solver.add(this.ctx.Or(...colQueens));
      
      for (let i = 0; i < n; i++) {
        for (let k = i + 1; k < n; k++) {
          solver.add(this.ctx.Or(queen[i][j].not(), queen[k][j].not()));
        }
      }
    }

    // 制約3: 対角線制約
    for (let d = -(n-1); d <= (n-1); d++) {
      const diagQueens: Bool[] = [];
      for (let i = 0; i < n; i++) {
        const j = i + d;
        if (j >= 0 && j < n) {
          diagQueens.push(queen[i][j]);
        }
      }
      if (diagQueens.length > 1) {
        for (let p = 0; p < diagQueens.length; p++) {
          for (let q = p + 1; q < diagQueens.length; q++) {
            solver.add(this.ctx.Or(diagQueens[p].not(), diagQueens[q].not()));
          }
        }
      }
    }

    for (let d = 0; d <= 2*(n-1); d++) {
      const diagQueens: Bool[] = [];
      for (let i = 0; i < n; i++) {
        const j = d - i;
        if (j >= 0 && j < n) {
          diagQueens.push(queen[i][j]);
        }
      }
      if (diagQueens.length > 1) {
        for (let p = 0; p < diagQueens.length; p++) {
          for (let q = p + 1; q < diagQueens.length; q++) {
            solver.add(this.ctx.Or(diagQueens[p].not(), diagQueens[q].not()));
          }
        }
      }
    }
  }

  // ソリューションを視覚的に表示するヘルパー関数
  public static displaySolution(solution: NQueensSolution): string {
    const n = solution.n;
    const positions = solution.positions;
    let result = '';
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (positions[i] === j) {
          result += 'Q ';
        } else {
          result += '. ';
        }
      }
      result += '\n';
    }
    
    return result;
  }
}