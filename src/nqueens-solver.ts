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

    /**
     * N-Queensの制約充足問題としての定式化：
     * 
     * 【変数定義】
     * - queen[i][j]: 行i、列jにクイーンが配置されるかを表すブール変数
     * - n×n = n²個のブール変数を定義
     * 
     * チェス盤上のクイーンは「縦・横・斜め」の全方向に攻撃できるため、
     * 互いに攻撃し合わない配置を見つける必要がある。
     */
    const queen: Bool[][] = [];
    for (let i = 0; i < n; i++) {
      queen[i] = [];
      for (let j = 0; j < n; j++) {
        queen[i][j] = this.ctx.Bool.const(`queen_${i}_${j}`);
      }
    }

    const solver = new this.ctx.Solver();

    /**
     * 【制約システム】
     * N-Queensの4つの基本制約を論理式として表現：
     * 1. 各行にちょうど1個のクイーン配置制約
     * 2. 各列にちょうど1個のクイーン配置制約
     * 3. 左上-右下対角線の非攻撃制約
     * 4. 右上-左下対角線の非攻撃制約
     */
    
    /**
     * 【制約1: 行の一意性制約】
     * 各行にはちょうど1つのクイーンが配置される
     * 論理式: ∀i ∈ [0,n-1] : (∃!j ∈ [0,n-1] : queen[i][j] = true)
     * 
     * 実装：
     * - 存在制約: ∨(j=0 to n-1) queen[i][j] (各行に少なくとも1個)
     * - 一意制約: ∀j₁,j₂ ∈ [0,n-1], j₁≠j₂ : ¬(queen[i][j₁] ∧ queen[i][j₂])
     */
    for (let i = 0; i < n; i++) {
      // 各行で少なくとも1つのクイーンがある
      solver.add(this.ctx.Or(...queen[i]));
      
      // 各行で最大1つのクイーンがある（互いに排他的）
      for (let j = 0; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          solver.add(this.ctx.Or(queen[i][j].not(), queen[i][k].not()));
        }
      }
    }

    /**
     * 【制約2: 列の一意性制約】
     * 各列にはちょうど1つのクイーンが配置される
     * 論理式: ∀j ∈ [0,n-1] : (∃!i ∈ [0,n-1] : queen[i][j] = true)
     * 
     * 行制約と対称的な制約で、縦方向の攻撃を防ぐ
     * この制約により、n個のクイーンがn×n盤面に1行1列ずつ配置される
     */
    for (let j = 0; j < n; j++) {
      // 各列で少なくとも1つのクイーンがある
      const colQueens: Bool[] = [];
      for (let i = 0; i < n; i++) {
        colQueens.push(queen[i][j]);
      }
      solver.add(this.ctx.Or(...colQueens));
      
      // 各列で最大1つのクイーンがある（互いに排他的）
      for (let i = 0; i < n; i++) {
        for (let k = i + 1; k < n; k++) {
          solver.add(this.ctx.Or(queen[i][j].not(), queen[k][j].not()));
        }
      }
    }

    /**
     * 【制約3: 対角線制約】
     * 対角線上で互いに攻撃し合わないための制約
     * 
     * 【左上-右下対角線】
     * 対角線は式 j = i + d で表現される（dは対角線定数）
     * - d = 0: 主対角線 (0,0)→(n-1,n-1)
     * - d > 0: 主対角線より右上の対角線
     * - d < 0: 主対角線より左下の対角線
     * 
     * 範囲: d ∈ [-(n-1), (n-1)] で2n-1本の対角線が存在
     * 
     * 論理式: ∀d, ∀(i₁,j₁),(i₂,j₂) ∈ diagonal_d, (i₁,j₁)≠(i₂,j₂) :
     *         ¬(queen[i₁][j₁] ∧ queen[i₂][j₂])
     */
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

    /**
     * 【右上-左下対角線】
     * 対角線は式 j = d - i で表現される（dは対角線定数）
     * - d = 0: 左下角から始まる対角線 (n-1,0)→(0,n-1)
     * - d = n-1: 中央の対角線 (n-1,0)→(0,n-1)
     * - d = 2(n-1): 右上角で終わる対角線
     * 
     * 範囲: d ∈ [0, 2(n-1)] で2n-1本の対角線が存在
     * 
     * 座標変換の例（n=4の場合）:
     * d=0: (0,0) のみ
     * d=1: (0,1), (1,0)
     * d=2: (0,2), (1,1), (2,0)
     * d=3: (0,3), (1,2), (2,1), (3,0)
     * d=4: (1,3), (2,2), (3,1)
     * d=5: (2,3), (3,2)
     * d=6: (3,3) のみ
     */
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
    /**
     * N-Queens制約の統合実装
     * このメソッドは solve() メソッドと同じ制約ロジックを共有し、
     * findAllSolutions() などの他のメソッドでも使用される
     */
    
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

    // 制約3: 対角線制約（左上-右下）
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

    // 制約4: 対角線制約（右上-左下）
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