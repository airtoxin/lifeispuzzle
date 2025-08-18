import { Context, Arith, Bool, Solver, Model, CheckSatResult } from 'z3-solver';
import { Z3BaseSolver, Puzzle, Solution } from './interfaces';

// 数独パズルの型定義
export interface SudokuGrid {
  grid: number[][];
}

// 数独ソルバー
export class SudokuSolver extends Z3BaseSolver<SudokuGrid, SudokuGrid> {
  public readonly solverType = 'sudoku';

  public async solve(puzzle: Puzzle<SudokuGrid>): Promise<Solution<SudokuGrid>> {
    const solution = await this.findSolution(puzzle.data);
    if (!solution.solved) {
      return solution;
    }

    // 複数解があるかチェック
    const uniqueCheck = await this.checkUniqueness(puzzle, solution.data);
    return {
      ...solution,
      isUnique: uniqueCheck.isUnique,
      alternativeSolutions: uniqueCheck.alternatives
    };
  }

  private async findSolution(puzzleData: SudokuGrid): Promise<Solution<SudokuGrid>> {
    // 9x9のグリッドに対応する変数を作成
    const vars: Arith[][] = [];
    for (let i = 0; i < 9; i++) {
      vars[i] = [];
      for (let j = 0; j < 9; j++) {
        vars[i][j] = this.ctx.Int.const(`x_${i}_${j}`);
      }
    }

    const solver = new this.ctx.Solver();

    // 基本的な数独制約を追加
    this.addSudokuConstraints(solver, vars);

    // 既知の値を制約として追加
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (puzzleData.grid[i][j] !== 0) {
          solver.add(vars[i][j].eq(puzzleData.grid[i][j]));
        }
      }
    }

    // 制約を満たす解を探す
    const result: CheckSatResult = await solver.check();

    if (result === 'sat') {
      const model: Model = solver.model();
      const solution: number[][] = [];

      for (let i = 0; i < 9; i++) {
        solution[i] = [];
        for (let j = 0; j < 9; j++) {
          const value = model.eval(vars[i][j]);
          solution[i][j] = parseInt(value.toString());
        }
      }

      return this.createSolution({ grid: solution }, true, {
        solverType: this.solverType,
        solutionTime: Date.now()
      });
    }

    return this.createSolution({ grid: [] }, false);
  }

  public async checkUniqueness(puzzle: Puzzle<SudokuGrid>, currentSolution: SudokuGrid): Promise<{ isUnique: boolean; alternatives: SudokuGrid[] }> {
    // 現在の解を除外する制約を追加して、他の解があるかチェック
    const vars: Arith[][] = [];
    for (let i = 0; i < 9; i++) {
      vars[i] = [];
      for (let j = 0; j < 9; j++) {
        vars[i][j] = this.ctx.Int.const(`y_${i}_${j}`);
      }
    }

    const solver = new this.ctx.Solver();

    // 基本的な数独制約を追加
    this.addSudokuConstraints(solver, vars);

    // 既知の値を制約として追加
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (puzzle.data.grid[i][j] !== 0) {
          solver.add(vars[i][j].eq(puzzle.data.grid[i][j]));
        }
      }
    }

    // 現在の解とは異なる解を探すための制約を追加
    const differentConstraints: Bool[] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        differentConstraints.push(vars[i][j].neq(currentSolution.grid[i][j]));
      }
    }
    solver.add(this.ctx.Or(...differentConstraints));

    const alternatives: SudokuGrid[] = [];
    let solutionCount = 0;
    const maxAlternatives = 10; // 最大10個の代替解を探す

    while (solutionCount < maxAlternatives) {
      const result = await solver.check();
      
      if (result !== 'sat') {
        break;
      }

      const model = solver.model();
      const alternativeSolution: number[][] = [];

      for (let i = 0; i < 9; i++) {
        alternativeSolution[i] = [];
        for (let j = 0; j < 9; j++) {
          const value = model.eval(vars[i][j]);
          alternativeSolution[i][j] = parseInt(value.toString());
        }
      }

      alternatives.push({ grid: alternativeSolution });
      solutionCount++;

      // この解を除外する制約を追加
      const excludeConstraints: Bool[] = [];
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          excludeConstraints.push(vars[i][j].neq(alternativeSolution[i][j]));
        }
      }
      solver.add(this.ctx.Or(...excludeConstraints));
    }

    return {
      isUnique: alternatives.length === 0,
      alternatives
    };
  }

  public async findAllSolutions(puzzle: Puzzle<SudokuGrid>, maxSolutions: number = 100): Promise<SudokuGrid[]> {
    const solutions: SudokuGrid[] = [];
    const vars: Arith[][] = [];
    
    for (let i = 0; i < 9; i++) {
      vars[i] = [];
      for (let j = 0; j < 9; j++) {
        vars[i][j] = this.ctx.Int.const(`z_${i}_${j}`);
      }
    }

    const solver = new this.ctx.Solver();

    // 基本的な数独制約を追加
    this.addSudokuConstraints(solver, vars);

    // 既知の値を制約として追加
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (puzzle.data.grid[i][j] !== 0) {
          solver.add(vars[i][j].eq(puzzle.data.grid[i][j]));
        }
      }
    }

    while (solutions.length < maxSolutions) {
      const result = await solver.check();
      
      if (result !== 'sat') {
        break;
      }

      const model = solver.model();
      const solution: number[][] = [];

      for (let i = 0; i < 9; i++) {
        solution[i] = [];
        for (let j = 0; j < 9; j++) {
          const value = model.eval(vars[i][j]);
          solution[i][j] = parseInt(value.toString());
        }
      }

      solutions.push({ grid: solution });

      // この解を除外する制約を追加
      const excludeConstraints: Bool[] = [];
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          excludeConstraints.push(vars[i][j].neq(solution[i][j]));
        }
      }
      solver.add(this.ctx.Or(...excludeConstraints));
    }

    return solutions;
  }

  private addSudokuConstraints(solver: Solver, vars: Arith[][]): void {
    // 制約1: 各セルには1-9の値が入る
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        solver.add(this.ctx.And(
          vars[i][j].ge(1),
          vars[i][j].le(9)
        ));
      }
    }

    // 制約2: 各行には1-9が一度ずつ現れる
    for (let i = 0; i < 9; i++) {
      solver.add(this.ctx.Distinct(...vars[i]));
    }

    // 制約3: 各列には1-9が一度ずつ現れる
    for (let j = 0; j < 9; j++) {
      const col: Arith[] = [];
      for (let i = 0; i < 9; i++) {
        col.push(vars[i][j]);
      }
      solver.add(this.ctx.Distinct(...col));
    }

    // 制約4: 各3x3ブロックには1-9が一度ずつ現れる
    for (let blockRow = 0; blockRow < 3; blockRow++) {
      for (let blockCol = 0; blockCol < 3; blockCol++) {
        const block: Arith[] = [];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            block.push(vars[blockRow * 3 + i][blockCol * 3 + j]);
          }
        }
        solver.add(this.ctx.Distinct(...block));
      }
    }
  }
}