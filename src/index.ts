import { init, Context, Arith, Bool, Solver, Model, CheckSatResult } from 'z3-solver';

interface SudokuPuzzle {
  grid: number[][];
}

interface SudokuSolution {
  grid: number[][];
  solved: boolean;
  isUnique?: boolean;
  alternativeSolutions?: number[][][];
}

class SudokuSolver {
  private ctx: Context;

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  public async solve(puzzle: SudokuPuzzle): Promise<SudokuSolution> {
    const solution = await this.findSolution(puzzle);
    if (!solution.solved) {
      return solution;
    }

    // 複数解があるかチェック
    const uniqueCheck = await this.checkUniqueness(puzzle, solution.grid);
    return {
      ...solution,
      isUnique: uniqueCheck.isUnique,
      alternativeSolutions: uniqueCheck.alternatives
    };
  }

  private async findSolution(puzzle: SudokuPuzzle): Promise<SudokuSolution> {
    // 9x9のグリッドに対応する変数を作成
    const vars: Arith[][] = [];
    for (let i = 0; i < 9; i++) {
      vars[i] = [];
      for (let j = 0; j < 9; j++) {
        vars[i][j] = this.ctx.Int.const(`x_${i}_${j}`);
      }
    }

    const solver = new this.ctx.Solver();

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

    // 既知の値を制約として追加
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (puzzle.grid[i][j] !== 0) {
          solver.add(vars[i][j].eq(puzzle.grid[i][j]));
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

      return { grid: solution, solved: true };
    }

    return { grid: [], solved: false };
  }

  public async checkUniqueness(puzzle: SudokuPuzzle, currentSolution: number[][]): Promise<{ isUnique: boolean; alternatives: number[][][] }> {
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
        if (puzzle.grid[i][j] !== 0) {
          solver.add(vars[i][j].eq(puzzle.grid[i][j]));
        }
      }
    }

    // 現在の解とは異なる解を探すための制約を追加
    const differentConstraints: Bool[] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        differentConstraints.push(vars[i][j].neq(currentSolution[i][j]));
      }
    }
    solver.add(this.ctx.Or(...differentConstraints));

    const alternatives: number[][][] = [];
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

      alternatives.push(alternativeSolution);
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

  public async findAllSolutions(puzzle: SudokuPuzzle, maxSolutions: number = 100): Promise<number[][][]> {
    const solutions: number[][][] = [];
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
        if (puzzle.grid[i][j] !== 0) {
          solver.add(vars[i][j].eq(puzzle.grid[i][j]));
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

      solutions.push(solution);

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

async function main(): Promise<void> {
  try {
    const { Context } = await init();
    const ctx = new Context('main');
    const solver = new SudokuSolver(ctx);

    // 数独パズル（xlur1hvtjx861.webp）（0は空のセルを表す）
    const puzzle: SudokuPuzzle = {
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
    };

    console.log('数独パズルを解いています...');
    const solution = await solver.solve(puzzle);

    if (solution.solved) {
      console.log('解が見つかりました:');
      solution.grid.forEach(row => {
        console.log(row.join(' '));
      });

      console.log(`\n解の一意性: ${solution.isUnique ? '一意解' : '複数解あり'}`);
      
      if (!solution.isUnique && solution.alternativeSolutions && solution.alternativeSolutions.length > 0) {
        console.log(`\n他の解の数: ${solution.alternativeSolutions.length}個`);
        solution.alternativeSolutions.forEach((alt, index) => {
          console.log(`\n代替解 ${index + 1}:`);
          alt.forEach(row => {
            console.log(row.join(' '));
          });
        });
      }
    } else {
      console.log('解が見つかりませんでした。');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

if (require.main === module) {
  main();
}

export { SudokuSolver, SudokuPuzzle, SudokuSolution };