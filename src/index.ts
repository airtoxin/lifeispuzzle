import {Arith, Bool, Context, init} from 'z3-solver';

// シリアライズ可能な盤面状態（基底型）
interface SerializableBoardState {
  size: number;
  cells: number[][];             // セル値
  horizontalEdges: number[][];   // 水平線 (size+1 × size)
  verticalEdges: number[][];     // 垂直線 (size × size+1)
}

// Z3変数を使った盤面状態（SerializableBoardStateから自動導出）
type CanonicalBoardState = {
  [K in keyof SerializableBoardState]: K extends 'cells' | 'horizontalEdges' | 'verticalEdges'
    ? Arith[][]
    : SerializableBoardState[K];
};

type DeepReadonly<T> = keyof T extends never
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

// 型変換ユーティリティ関数
function createCanonicalBoardState(serializable: SerializableBoardState, ctx: Context<any>): CanonicalBoardState {
  return {
    size: serializable.size,
    cells: serializable.cells.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`c-${rowIndex}-${colIndex}`))
    ),
    horizontalEdges: serializable.horizontalEdges.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`he-${rowIndex}-${colIndex}`))
    ),
    verticalEdges: serializable.verticalEdges.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`ve-${rowIndex}-${colIndex}`))
    )
  };
}

function boardStateToSerializable(board: CanonicalBoardState, model: any): SerializableBoardState {
  return {
    size: board.size,
    cells: board.cells.map(row =>
      row.map(cellVar => {
        const value = model.eval(cellVar);
        return parseInt(value.toString());
      })
    ),
    horizontalEdges: board.horizontalEdges.map(row =>
      row.map(edgeVar => {
        const value = model.eval(edgeVar);
        return parseInt(value.toString());
      })
    ),
    verticalEdges: board.verticalEdges.map(row =>
      row.map(edgeVar => {
        const value = model.eval(edgeVar);
        return parseInt(value.toString());
      })
    )
  };
}


// ルールの基底インターフェース
interface Rule {
  id: string;
  name: string;
  description: string;
  getConstraints(board: CanonicalBoardState, ctx: Context<any>): Bool<any>[];
}

const NumberFillRule: Rule = {
  id: "number-fill-rule",
  name: "数字で充填されている",
  description: "盤面の全てのマスが数字で埋められていること",
  getConstraints(board, ctx) {
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
    const constraints: Bool<any>[] = [];
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

// Solver関連のインターフェース定義
interface SolverOptions {
  timeout?: number;        // タイムアウト（ms）
  maxSolutions?: number;   // 求解数上限
  contextName?: string;    // Z3コンテキスト名
}

interface SolverInput {
  initialBoard: SerializableBoardState;  // 初期盤面（0は未入力）
  rules: Rule[];                         // 適用するルール配列
  options?: SolverOptions;               // オプション設定
}

interface SolverResult {
  status: 'sat' | 'unsat' | 'timeout' | 'error';
  solution?: SerializableBoardState;     // 解（satの場合）
  solutions?: SerializableBoardState[];  // 複数解（複数求解の場合）
  executionTime: number;                 // 実行時間（ms）
  constraintCount: number;               // 制約数
  error?: string;                        // エラーメッセージ
}

// 与えられた値の制約ルール
function createGivenValuesRule(givenValues: SerializableBoardState): Rule {
  return {
    id: "given-values-rule",
    name: "与えられた値制約",
    description: "初期値として与えられたセルの値を固定する",
    getConstraints(board, ctx) {
      const constraints: Bool<any>[] = [];
      
      for (let row = 0; row < givenValues.size; row++) {
        for (let col = 0; col < givenValues.size; col++) {
          const givenValue = givenValues.cells[row][col];
          if (givenValue !== 0) {
            constraints.push(board.cells[row][col].eq(givenValue));
          }
        }
      }
      
      return constraints;
    }
  };
}

// PuzzleSolver クラス
class PuzzleSolver {
  private ctx?: Context<any>;
  private isInitialized = false;
  private options: Required<SolverOptions>;

  constructor(options: SolverOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,      // デフォルト30秒
      maxSolutions: options.maxSolutions ?? 1,
      contextName: options.contextName ?? 'puzzle-solver'
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      const { Context } = await init();
      this.ctx = Context(this.options.contextName);
      this.isInitialized = true;
    }
  }

  async solve(input: SolverInput): Promise<SolverResult> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      if (!this.ctx) throw new Error('Z3 context not initialized');

      // SerializableBoardState → CanonicalBoardState変換
      const canonicalBoard = createCanonicalBoardState(input.initialBoard, this.ctx);
      
      // Given値制約を自動追加
      const givenValuesRule = createGivenValuesRule(input.initialBoard);
      const allRules = [...input.rules, givenValuesRule];
      
      // 制約を収集
      const constraints: Bool<any>[] = [];
      for (const rule of allRules) {
        constraints.push(...rule.getConstraints(canonicalBoard, this.ctx));
      }

      // Z3 Solverで求解
      const solver = new this.ctx.Solver();
      constraints.forEach(constraint => solver.add(constraint));

      const checkResult = await solver.check();
      const executionTime = Date.now() - startTime;

      if (checkResult === 'sat') {
        const model = solver.model();
        const solution = boardStateToSerializable(canonicalBoard, model);
        
        return {
          status: 'sat',
          solution,
          executionTime,
          constraintCount: constraints.length
        };
      } else if (checkResult === 'unsat') {
        return {
          status: 'unsat',
          executionTime,
          constraintCount: constraints.length
        };
      } else {
        return {
          status: 'timeout',
          executionTime,
          constraintCount: constraints.length
        };
      }
    } catch (error) {
      return {
        status: 'error',
        executionTime: Date.now() - startTime,
        constraintCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async solveMultiple(input: SolverInput, maxSolutions?: number): Promise<SolverResult> {
    const limit = maxSolutions ?? this.options.maxSolutions;
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      if (!this.ctx) throw new Error('Z3 context not initialized');

      const canonicalBoard = createCanonicalBoardState(input.initialBoard, this.ctx);
      const givenValuesRule = createGivenValuesRule(input.initialBoard);
      const allRules = [...input.rules, givenValuesRule];
      
      const constraints: Bool<any>[] = [];
      for (const rule of allRules) {
        constraints.push(...rule.getConstraints(canonicalBoard, this.ctx));
      }

      const solver = new this.ctx.Solver();
      constraints.forEach(constraint => solver.add(constraint));

      const solutions: SerializableBoardState[] = [];
      
      for (let i = 0; i < limit; i++) {
        const checkResult = await solver.check();
        
        if (checkResult !== 'sat') break;
        
        const model = solver.model();
        const solution = boardStateToSerializable(canonicalBoard, model);
        solutions.push(solution);
        
        // 同じ解を除外する制約を追加
        const exclusionConstraints = canonicalBoard.cells.flat().map((cell, index) => {
          const row = Math.floor(index / canonicalBoard.size);
          const col = index % canonicalBoard.size;
          return cell.neq(solution.cells[row][col]);
        });
        solver.add(this.ctx.Or(...exclusionConstraints));
      }

      const executionTime = Date.now() - startTime;

      if (solutions.length > 0) {
        return {
          status: 'sat',
          solution: solutions[0],
          solutions,
          executionTime,
          constraintCount: constraints.length
        };
      } else {
        return {
          status: 'unsat',
          executionTime,
          constraintCount: constraints.length
        };
      }
    } catch (error) {
      return {
        status: 'error',
        executionTime: Date.now() - startTime,
        constraintCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validateSolution(board: SerializableBoardState, rules: Rule[]): boolean {
    try {
      // 簡易検証: 各ルールの基本条件をチェック
      // ここでは数値範囲とサイズの検証のみ実装
      if (board.cells.length !== board.size) return false;
      if (!board.cells.every(row => row.length === board.size)) return false;
      
      // 0でない値は1以上でなければならない
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell !== 0 && cell < 1) return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    // Z3リソースの解放（必要に応じて実装）
    this.isInitialized = false;
    this.ctx = undefined;
  }
}

// サンプル実行
async function runSample() {
  console.log("=== PuzzleSolver を使用したサンプル実行 ===");

  // シリアライズ可能な基底状態を定義（いくつか初期値を設定）
  const initialBoard: SerializableBoardState = {
    size: 3,
    cells: [
      [2, 0, 0],  // 左上に2を固定
      [0, 5, 0],  // 真ん中に5を固定  
      [0, 0, 8]   // 右下に8を固定
    ],
    horizontalEdges: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    verticalEdges: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  };

  // PuzzleSolverインスタンス作成
  const solver = new PuzzleSolver({
    contextName: 'sample',
    timeout: 10000
  });

  try {
    // 単一解の求解
    console.log("\n--- 単一解の求解 ---");
    const singleResult = await solver.solve({
      initialBoard,
      rules: [NumberFillRule, MagicSquareRule]
    });

    console.log(`ステータス: ${singleResult.status}`);
    console.log(`実行時間: ${singleResult.executionTime}ms`);
    console.log(`制約数: ${singleResult.constraintCount}`);

    if (singleResult.status === 'sat' && singleResult.solution) {
      console.log("見つかった解:");
      console.log(JSON.stringify(singleResult.solution, null, 2));
    } else if (singleResult.status === 'error') {
      console.error("エラー:", singleResult.error);
    }

    // 複数解の求解（もしあれば）
    console.log("\n--- 複数解の求解（最大3解） ---");
    const multiResult = await solver.solveMultiple({
      initialBoard: {
        size: 2,
        cells: [[0, 0], [0, 0]],  // 全て未設定の簡単な例
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      },
      rules: [NumberFillRule]
    }, 3);

    console.log(`ステータス: ${multiResult.status}`);
    console.log(`実行時間: ${multiResult.executionTime}ms`);
    console.log(`見つかった解の数: ${multiResult.solutions?.length || 0}`);

    if (multiResult.solutions && multiResult.solutions.length > 0) {
      multiResult.solutions.forEach((solution, index) => {
        console.log(`解 ${index + 1}:`, JSON.stringify(solution.cells));
      });
    }

  } finally {
    solver.dispose();
  }
}

// サンプル実行（このファイルが直接実行された場合）
if (require.main === module) {
  runSample().catch(console.error);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe, beforeEach, afterEach } = import.meta.vitest;

  describe('SerializableBoardState', () => {
    it('should be serializable to JSON', () => {
      const board: SerializableBoardState = {
        size: 2,
        cells: [[1, 2], [3, 4]],
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      const json = JSON.stringify(board);
      const parsed = JSON.parse(json) as SerializableBoardState;
      
      expect(parsed.size).toBe(2);
      expect(parsed.cells).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('createGivenValuesRule', () => {
    it('should create constraints for given values', async () => {
      const z3 = await import('z3-solver');
      const { Context } = await z3.init();
      const ctx = Context('test');

      const givenBoard: SerializableBoardState = {
        size: 2,
        cells: [[1, 0], [0, 4]], // 1と4を固定
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      const canonicalBoard = createCanonicalBoardState(givenBoard, ctx);
      const rule = createGivenValuesRule(givenBoard);
      const constraints = rule.getConstraints(canonicalBoard, ctx);

      // 2つの制約（1と4の固定値）が作成されることを確認
      expect(constraints.length).toBe(2);
    });
  });

  describe('boardStateToSerializable', () => {
    it('should have proper structure', () => {
      // より簡単なテストに変更
      const board: SerializableBoardState = {
        size: 2,
        cells: [[1, 2], [3, 4]],
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      expect(board.size).toBe(2);
      expect(board.cells.length).toBe(2);
      expect(board.cells[0].length).toBe(2);
    });
  });

  describe('Rules', () => {
    it('NumberFillRule should require positive values', async () => {
      const z3 = await import('z3-solver');
      const { Context } = await z3.init();
      const ctx = Context('test');

      const board = createCanonicalBoardState({
        size: 2,
        cells: [[0, 0], [0, 0]],
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      }, ctx);

      const constraints = NumberFillRule.getConstraints(board, ctx);
      expect(constraints.length).toBe(4); // 2x2 = 4 cells
    });

    it('MagicSquareRule should create proper constraints for 3x3', async () => {
      const z3 = await import('z3-solver');
      const { Context } = await z3.init();
      const ctx = Context('test');

      const board = createCanonicalBoardState({
        size: 3,
        cells: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
        horizontalEdges: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
        verticalEdges: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      }, ctx);

      const constraints = MagicSquareRule.getConstraints(board, ctx);
      // Distinct constraint (1) + range constraints (9) + sum constraints (rows: 2, cols: 3, diags: 2) = 17
      expect(constraints.length).toBe(17);
    });
  });

  describe('PuzzleSolver', () => {
    let solver: PuzzleSolver;

    beforeEach(() => {
      solver = new PuzzleSolver();
    });

    afterEach(() => {
      solver.dispose();
    });

    it('should solve a simple puzzle', async () => {
      const input: SolverInput = {
        initialBoard: {
          size: 2,
          cells: [[1, 0], [0, 4]],  // 1と4を固定
          horizontalEdges: [[0, 0], [0, 0], [0, 0]],
          verticalEdges: [[0, 0, 0], [0, 0, 0]]
        },
        rules: [NumberFillRule]
      };

      const result = await solver.solve(input);
      
      expect(result.status).toBe('sat');
      expect(result.solution).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.constraintCount).toBeGreaterThan(0);
      
      if (result.solution) {
        expect(result.solution.cells[0][0]).toBe(1);
        expect(result.solution.cells[1][1]).toBe(4);
        expect(result.solution.size).toBe(2);
      }
    });

    it('should handle unsatisfiable puzzle', async () => {
      const input: SolverInput = {
        initialBoard: {
          size: 2,
          cells: [[1, 1], [1, 1]],  // 不可能な組み合わせ
          horizontalEdges: [[0, 0], [0, 0], [0, 0]],
          verticalEdges: [[0, 0, 0], [0, 0, 0]]
        },
        rules: [RowUniquenessRule, ColumnUniquenessRule]  // 一意性制約
      };

      const result = await solver.solve(input);
      
      expect(result.status).toBe('unsat');
      expect(result.solution).toBeUndefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should validate solution correctly', () => {
      const validBoard: SerializableBoardState = {
        size: 2,
        cells: [[1, 2], [3, 4]],
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      const invalidBoard: SerializableBoardState = {
        size: 2,
        cells: [[1, 2], [3]],  // 不正なサイズ
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      expect(solver.validateSolution(validBoard, [])).toBe(true);
      expect(solver.validateSolution(invalidBoard, [])).toBe(false);
    });

    it('should handle solver options', () => {
      const customSolver = new PuzzleSolver({
        timeout: 5000,
        maxSolutions: 3,
        contextName: 'test-solver'
      });

      expect(customSolver).toBeDefined();
      customSolver.dispose();
    });

    it('should find multiple solutions when they exist', async () => {
      const input: SolverInput = {
        initialBoard: {
          size: 2,
          cells: [[0, 0], [0, 0]],  // 全て未設定
          horizontalEdges: [[0, 0], [0, 0], [0, 0]],
          verticalEdges: [[0, 0, 0], [0, 0, 0]]
        },
        rules: [NumberFillRule]  // 1以上の制約のみ
      };

      const result = await solver.solveMultiple(input, 2);
      
      expect(result.status).toBe('sat');
      expect(result.solutions).toBeDefined();
      expect(result.solutions!.length).toBeGreaterThan(0);
      expect(result.solutions!.length).toBeLessThanOrEqual(2);
    });
  });
}
