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
    /**
     * 数独の制約充足問題としての定式化：
     * 
     * 【変数定義】
     * - vars[i][j]: セル(i,j)に入る数字（1～9の整数）
     * - 9×9 = 81個の整数変数を定義
     */
    const vars: Arith[][] = [];
    for (let i = 0; i < 9; i++) {
      vars[i] = [];
      for (let j = 0; j < 9; j++) {
        vars[i][j] = this.ctx.Int.const(`x_${i}_${j}`);
      }
    }

    const solver = new this.ctx.Solver();

    /**
     * 【制約システム】
     * 数独の4つの基本制約を論理式として表現：
     * 1. 各セルの値の範囲制約
     * 2. 行の一意性制約  
     * 3. 列の一意性制約
     * 4. 3×3ブロックの一意性制約
     */
    this.addSudokuConstraints(solver, vars);

    /**
     * 【既知値制約】
     * パズルの初期状態（ヒント数字）を制約として追加
     * - 0でないセルは、その値に固定
     * - これにより解空間が大幅に削減される
     */
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
    /**
     * 【制約1: 定義域制約】
     * 各セルの値は1～9の範囲内でなければならない
     * 論理式: ∀i,j ∈ [0,8] : 1 ≤ vars[i][j] ≤ 9
     * 
     * これにより無効な値（0, 10以上, 負数）が排除される
     */
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        solver.add(this.ctx.And(
          vars[i][j].ge(1),
          vars[i][j].le(9)
        ));
      }
    }

    /**
     * 【制約2: 行の一意性制約】 
     * 各行には1～9の数字がちょうど一度ずつ現れなければならない
     * 論理式: ∀i ∈ [0,8] : Distinct(vars[i][0], vars[i][1], ..., vars[i][8])
     * 
     * Z3のDistinct関数は「すべて異なる値」を保証する
     * - 9個の変数がすべて異なる値を持つ
     * - 定義域が1～9なので、必然的に{1,2,3,4,5,6,7,8,9}の順列となる
     */
    for (let i = 0; i < 9; i++) {
      solver.add(this.ctx.Distinct(...vars[i]));
    }

    /**
     * 【制約3: 列の一意性制約】
     * 各列には1～9の数字がちょうど一度ずつ現れなければならない  
     * 論理式: ∀j ∈ [0,8] : Distinct(vars[0][j], vars[1][j], ..., vars[8][j])
     * 
     * 行制約と同様、各列も{1,2,3,4,5,6,7,8,9}の順列となる
     */
    for (let j = 0; j < 9; j++) {
      const col: Arith[] = [];
      for (let i = 0; i < 9; i++) {
        col.push(vars[i][j]);
      }
      solver.add(this.ctx.Distinct(...col));
    }

    /**
     * 【制約4: 3×3ブロックの一意性制約】
     * 各3×3ブロックには1～9の数字がちょうど一度ずつ現れなければならない
     * 論理式: ∀blockRow,blockCol ∈ [0,2] : 
     *         Distinct(vars[3*blockRow+i][3*blockCol+j]) for i,j ∈ [0,2]
     * 
     * 数独の最も特徴的な制約：
     * - 9×9グリッドを3×3の9個のブロックに分割
     * - 各ブロック内でも1～9がちょうど一度ずつ現れる
     * - この制約により、行・列制約だけでは得られない複雑なパターンが生まれる
     * 
     * ブロック座標の計算:
     * - ブロック(blockRow, blockCol)の実際の座標範囲は
     *   [3*blockRow, 3*blockRow+2] × [3*blockCol, 3*blockCol+2]
     */
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