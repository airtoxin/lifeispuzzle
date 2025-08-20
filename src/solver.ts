import { Context, init } from 'z3-solver';
import { SolverOptions, SolverInput, SolverResult, SerializableBoardState, Rule } from './types.js';
import { createCanonicalBoardState, boardStateToSerializable } from './utils.js';
import { createGivenValuesRule } from './rules.js';

// PuzzleSolver クラス
export class PuzzleSolver {
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
      const constraints: any[] = [];
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
      
      const constraints: any[] = [];
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

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe, beforeEach, afterEach } = import.meta.vitest;
  
  async function loadRules() {
    const { NumberFillRule, RowUniquenessRule, ColumnUniquenessRule } = await import('./rules.js');
    return { NumberFillRule, RowUniquenessRule, ColumnUniquenessRule };
  }

  describe('PuzzleSolver', () => {
    let solver: PuzzleSolver;

    beforeEach(() => {
      solver = new PuzzleSolver();
    });

    afterEach(() => {
      solver.dispose();
    });

    it('should solve a simple puzzle', async () => {
      const { NumberFillRule } = await loadRules();
      
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
      const { RowUniquenessRule, ColumnUniquenessRule } = await loadRules();
      
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
      const { NumberFillRule } = await loadRules();
      
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