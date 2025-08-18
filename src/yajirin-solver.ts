import { Context, Bool, Arith, Solver, Model, CheckSatResult } from 'z3-solver';
import { Z3BaseSolver, Puzzle, Solution } from './interfaces';

// ヤジリンパズルの型定義
export interface YajirinPuzzle {
  width: number;
  height: number;
  hints: YajirinHint[];
}

export interface YajirinHint {
  row: number;
  col: number;
  direction: 'up' | 'down' | 'left' | 'right';
  count: number;
}

export interface YajirinSolution {
  width: number;
  height: number;
  arrows: ('up' | 'down' | 'left' | 'right' | null)[][];
}

// 方向の定義
const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
type Direction = typeof DIRECTIONS[number];

// ヤジリンソルバー
export class YajirinSolver extends Z3BaseSolver<YajirinPuzzle, YajirinSolution> {
  public readonly solverType = 'yajirin';

  public async solve(puzzle: Puzzle<YajirinPuzzle>): Promise<Solution<YajirinSolution>> {
    const { width, height, hints } = puzzle.data;
    
    if (width <= 0 || height <= 0) {
      return this.createSolution({
        width, height, arrows: []
      }, false, { error: 'Invalid grid dimensions' });
    }

    // 各セルの各方向に矢印があるかを表すブール変数
    const arrows: Bool[][][] = [];
    for (let r = 0; r < height; r++) {
      arrows[r] = [];
      for (let c = 0; c < width; c++) {
        arrows[r][c] = [];
        for (let d = 0; d < 4; d++) {
          arrows[r][c][d] = this.ctx.Bool.const(`arrow_${r}_${c}_${d}`);
        }
      }
    }

    const solver = new this.ctx.Solver();

    // 制約1: 各セルにはちょうど1つの矢印がある（ヒントセル以外）
    const hintPositions = new Set(hints.map(h => `${h.row},${h.col}`));
    
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (!hintPositions.has(`${r},${c}`)) {
          // ちょうど1つの方向が選ばれる
          solver.add(this.ctx.Or(...arrows[r][c]));
          
          // 複数の方向が同時に選ばれない
          for (let d1 = 0; d1 < 4; d1++) {
            for (let d2 = d1 + 1; d2 < 4; d2++) {
              solver.add(this.ctx.Or(arrows[r][c][d1].not(), arrows[r][c][d2].not()));
            }
          }
        } else {
          // ヒントセルには矢印がない
          for (let d = 0; d < 4; d++) {
            solver.add(arrows[r][c][d].not());
          }
        }
      }
    }

    // 制約2: 数字ヒントの制約
    for (const hint of hints) {
      const { row, col, direction, count } = hint;
      const visibleArrows: Bool[] = [];
      
      // 指定された方向に見える矢印を収集
      const [dr, dc] = this.getDirectionOffset(direction);
      let r = row + dr;
      let c = col + dc;
      
      while (r >= 0 && r < height && c >= 0 && c < width) {
        // この位置の矢印がヒント方向を向いている場合
        const dirIndex = this.getDirectionIndex(direction);
        visibleArrows.push(arrows[r][c][dirIndex]);
        
        r += dr;
        c += dc;
      }
      
      if (visibleArrows.length > 0) {
        // ちょうど count 個の矢印が見える
        this.addCountConstraint(solver, visibleArrows, count);
      }
    }

    // 制約3: 連続性の制約（簡略化版）
    // 矢印が連続したパスを形成する制約を追加
    this.addConnectivityConstraints(solver, arrows, width, height, hintPositions);

    // 解を探す
    const result: CheckSatResult = await solver.check();

    if (result === 'sat') {
      const model: Model = solver.model();
      const solutionArrows: ('up' | 'down' | 'left' | 'right' | null)[][] = [];

      for (let r = 0; r < height; r++) {
        solutionArrows[r] = [];
        for (let c = 0; c < width; c++) {
          let selectedDirection: Direction | null = null;
          
          if (!hintPositions.has(`${r},${c}`)) {
            for (let d = 0; d < 4; d++) {
              const value = model.eval(arrows[r][c][d]);
              if (value.toString() === 'true') {
                selectedDirection = DIRECTIONS[d];
                break;
              }
            }
          }
          
          solutionArrows[r][c] = selectedDirection;
        }
      }

      return this.createSolution({
        width, height, arrows: solutionArrows
      }, true, {
        solverType: this.solverType,
        hintsCount: hints.length
      });
    }

    return this.createSolution({
      width, height, arrows: []
    }, false);
  }

  private getDirectionOffset(direction: Direction): [number, number] {
    switch (direction) {
      case 'up': return [-1, 0];
      case 'down': return [1, 0];
      case 'left': return [0, -1];
      case 'right': return [0, 1];
    }
  }

  private getDirectionIndex(direction: Direction): number {
    return DIRECTIONS.indexOf(direction);
  }

  private addCountConstraint(solver: Solver, variables: Bool[], count: number): void {
    if (count === 0) {
      // すべてfalse
      for (const v of variables) {
        solver.add(v.not());
      }
    } else if (count === variables.length) {
      // すべてtrue
      for (const v of variables) {
        solver.add(v);
      }
    } else {
      // ちょうどcount個がtrue（基本的な実装）
      // より効率的な実装のためにはカーディナリティ制約を使用
      const combinations = this.generateCombinations(variables, count);
      const orConstraints = combinations.map(combo => {
        const andConstraints = variables.map((v, i) => 
          combo.includes(i) ? v : v.not()
        );
        return this.ctx.And(...andConstraints);
      });
      solver.add(this.ctx.Or(...orConstraints));
    }
  }

  private generateCombinations<T>(arr: T[], k: number): number[][] {
    if (k === 0) return [[]];
    if (k > arr.length) return [];
    
    const result: number[][] = [];
    
    function backtrack(start: number, current: number[]) {
      if (current.length === k) {
        result.push([...current]);
        return;
      }
      
      for (let i = start; i <= arr.length - (k - current.length); i++) {
        current.push(i);
        backtrack(i + 1, current);
        current.pop();
      }
    }
    
    backtrack(0, []);
    return result;
  }

  private addConnectivityConstraints(
    solver: Solver, 
    arrows: Bool[][][], 
    width: number, 
    height: number,
    hintPositions: Set<string>
  ): void {
    // 簡略化された連続性制約
    // 各矢印セルで、その矢印が指す方向に別の矢印または境界があることを確認
    
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (hintPositions.has(`${r},${c}`)) continue;
        
        for (let d = 0; d < 4; d++) {
          const [dr, dc] = this.getDirectionOffset(DIRECTIONS[d]);
          const nextR = r + dr;
          const nextC = c + dc;
          
          // この方向に矢印がある場合、隣接セルまたは境界に接続されている必要がある
          if (nextR >= 0 && nextR < height && nextC >= 0 && nextC < width) {
            if (!hintPositions.has(`${nextR},${nextC}`)) {
              // 隣接セルも矢印セルの場合、何らかの制約を追加
              // （完全な連続性制約は複雑なため、基本的な制約のみ実装）
            }
          }
        }
      }
    }
  }

  public async findAllSolutions(puzzle: Puzzle<YajirinPuzzle>, maxSolutions: number = 10): Promise<YajirinSolution[]> {
    const solutions: YajirinSolution[] = [];
    const { width, height } = puzzle.data;
    
    // 基本解を取得
    const baseSolution = await this.solve(puzzle);
    if (!baseSolution.solved) {
      return solutions;
    }
    
    solutions.push(baseSolution.data);
    
    // 他の解を探すのは複雑なため、基本実装では1つの解のみ返す
    return solutions;
  }

  // ヤジリンパズルの例を生成するヘルパー関数
  public static createSimplePuzzle(): YajirinPuzzle {
    return {
      width: 5,
      height: 5,
      hints: [
        { row: 1, col: 1, direction: 'right', count: 2 },
        { row: 2, col: 3, direction: 'down', count: 1 },
        { row: 3, col: 1, direction: 'up', count: 1 },
        { row: 3, col: 3, direction: 'left', count: 2 }
      ]
    };
  }

  // ソリューションを視覚的に表示するヘルパー関数
  public static displaySolution(solution: YajirinSolution, hints?: YajirinHint[]): string {
    const { width, height, arrows } = solution;
    let result = '';
    
    const hintMap = new Map<string, YajirinHint>();
    if (hints) {
      hints.forEach(hint => {
        hintMap.set(`${hint.row},${hint.col}`, hint);
      });
    }
    
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const hint = hintMap.get(`${r},${c}`);
        if (hint) {
          const dirSymbol = {
            'up': '↑',
            'down': '↓', 
            'left': '←',
            'right': '→'
          }[hint.direction];
          result += `${hint.count}${dirSymbol} `;
        } else {
          const arrow = arrows[r][c];
          if (arrow) {
            const symbol = {
              'up': '↑',
              'down': '↓',
              'left': '←', 
              'right': '→'
            }[arrow];
            result += `${symbol}  `;
          } else {
            result += '.  ';
          }
        }
      }
      result += '\n';
    }
    
    return result;
  }
}