import { Context, init, Bool } from "z3-solver";
import {
  BoardState,
  createBoardVariable,
  boardVariableToState,
} from "./states.js";
import { createGivenValuesRule } from "./rules/helpers.js";
import { Rule } from "./rules/types.js";

// Solver関連のインターフェース定義
export interface SolverOptions {
  timeout?: number; // タイムアウト（ms）
  maxSolutions?: number; // 求解数上限
  contextName?: string; // Z3コンテキスト名
}

export interface SolverInput {
  initialBoard: BoardState; // 初期盤面（0は未入力）
  rules: Rule[]; // 適用するルール配列
  options?: SolverOptions; // オプション設定
}

export interface SolverResult {
  status: "sat" | "unsat" | "timeout" | "error";
  solution?: BoardState; // 解（satの場合）
  solutions?: BoardState[]; // 複数解（複数求解の場合）
  executionTime: number; // 実行時間（ms）
  constraintCount: number; // 制約数
  error?: string; // エラーメッセージ
}

// PuzzleSolver クラス
export class PuzzleSolver {
  private ctx?: Context<string>;
  private isInitialized = false;
  private options: Required<SolverOptions>;

  constructor(options: SolverOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000, // デフォルト30秒
      maxSolutions: options.maxSolutions ?? 1,
      contextName: options.contextName ?? "puzzle-solver",
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
      if (!this.ctx) throw new Error("Z3 context not initialized");

      // BoardState → BoardVariable変換
      const boardVar = createBoardVariable(input.initialBoard, this.ctx);

      // Given値制約を自動追加
      const givenValuesRule = createGivenValuesRule(input.initialBoard);
      const allRules = [...input.rules, givenValuesRule];

      // 制約を収集
      const constraints: Bool<string>[] = [];
      for (const rule of allRules) {
        constraints.push(...rule.getConstraints(boardVar, this.ctx));
      }

      // Z3 Solverで求解
      const solver = new this.ctx.Solver();
      constraints.forEach((constraint) => solver.add(constraint));

      const checkResult = await solver.check();
      const executionTime = Date.now() - startTime;

      if (checkResult === "sat") {
        const model = solver.model();
        const solution = boardVariableToState(boardVar, model);

        return {
          status: "sat",
          solution,
          executionTime,
          constraintCount: constraints.length,
        };
      } else if (checkResult === "unsat") {
        return {
          status: "unsat",
          executionTime,
          constraintCount: constraints.length,
        };
      } else {
        return {
          status: "timeout",
          executionTime,
          constraintCount: constraints.length,
        };
      }
    } catch (error) {
      return {
        status: "error",
        executionTime: Date.now() - startTime,
        constraintCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async solveMultiple(
    input: SolverInput,
    maxSolutions?: number,
  ): Promise<SolverResult> {
    const limit = maxSolutions ?? this.options.maxSolutions;
    const startTime = Date.now();

    try {
      await this.ensureInitialized();
      if (!this.ctx) throw new Error("Z3 context not initialized");

      const boardVar = createBoardVariable(input.initialBoard, this.ctx);
      const givenValuesRule = createGivenValuesRule(input.initialBoard);
      const allRules = [...input.rules, givenValuesRule];

      const constraints: Bool<string>[] = [];
      for (const rule of allRules) {
        constraints.push(...rule.getConstraints(boardVar, this.ctx));
      }

      const solver = new this.ctx.Solver();
      constraints.forEach((constraint) => solver.add(constraint));

      const solutions: BoardState[] = [];

      for (let i = 0; i < limit; i++) {
        const checkResult = await solver.check();

        if (checkResult !== "sat") break;

        const model = solver.model();
        const solution = boardVariableToState(boardVar, model);
        solutions.push(solution);

        // 同じ解を除外する制約を追加
        const exclusionConstraints = boardVar.cells
          .flat()
          .map((cell, index) => {
            const row = Math.floor(index / boardVar.size);
            const col = index % boardVar.size;
            return cell.neq(solution.cells[row][col]);
          });
        solver.add(this.ctx.Or(...exclusionConstraints));
      }

      const executionTime = Date.now() - startTime;

      if (solutions.length > 0) {
        return {
          status: "sat",
          solution: solutions[0],
          solutions,
          executionTime,
          constraintCount: constraints.length,
        };
      } else {
        return {
          status: "unsat",
          executionTime,
          constraintCount: constraints.length,
        };
      }
    } catch (error) {
      return {
        status: "error",
        executionTime: Date.now() - startTime,
        constraintCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  validateSolution(boardState: BoardState, rules: Rule[]): boolean {
    try {
      // 簡易検証: 各ルールの基本条件をチェック
      // ここでは数値範囲とサイズの検証のみ実装
      if (boardState.cells.length !== boardState.size) return false;
      if (!boardState.cells.every((row) => row.length === boardState.size))
        return false;

      // 0でない値は1以上でなければならない
      for (const row of boardState.cells) {
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

if (import.meta.vitest) {
  const { it, expect, describe, beforeEach, afterEach } = import.meta.vitest;

  describe("PuzzleSolver constructor", () => {
    it("should handle solver options", () => {
      const customSolver = new PuzzleSolver({
        timeout: 5000,
        maxSolutions: 3,
        contextName: "test-solver",
      });

      expect(customSolver).toBeDefined();
      customSolver.dispose();
    });
  });

  async function loadRules() {
    const { NumberFillRule } = await import("./rules/NumberFillRule.js");
    const { RowUniquenessRule } = await import("./rules/RowUniquenessRule.js");
    const { ColumnUniquenessRule } = await import(
      "./rules/ColumnUniquenessRule.js"
    );
    return { NumberFillRule, RowUniquenessRule, ColumnUniquenessRule };
  }

  describe("PuzzleSolver.solve", () => {
    let solver: PuzzleSolver;

    beforeEach(() => {
      solver = new PuzzleSolver();
    });

    afterEach(() => {
      solver.dispose();
    });

    it("should solve a simple puzzle", async () => {
      const { NumberFillRule } = await loadRules();

      const input: SolverInput = {
        initialBoard: {
          size: 2,
          cells: [
            [1, 0],
            [0, 4],
          ],
          horizontalEdges: [
            [0, 0],
            [0, 0],
            [0, 0],
          ],
          verticalEdges: [
            [0, 0, 0],
            [0, 0, 0],
          ],
        },
        rules: [NumberFillRule],
      };

      const result = await solver.solve(input);

      expect(result.status).toBe("sat");
      expect(result.solution).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.constraintCount).toBeGreaterThan(0);

      if (result.solution) {
        expect(result.solution.cells[0][0]).toBe(1);
        expect(result.solution.cells[1][1]).toBe(4);
        expect(result.solution.size).toBe(2);
      }
    });

    it("should handle unsatisfiable puzzle", async () => {
      const { RowUniquenessRule, ColumnUniquenessRule } = await loadRules();

      const input: SolverInput = {
        initialBoard: {
          size: 2,
          cells: [
            [1, 1],
            [1, 1],
          ],
          horizontalEdges: [
            [0, 0],
            [0, 0],
            [0, 0],
          ],
          verticalEdges: [
            [0, 0, 0],
            [0, 0, 0],
          ],
        },
        rules: [RowUniquenessRule, ColumnUniquenessRule],
      };

      const result = await solver.solve(input);

      expect(result.status).toBe("unsat");
      expect(result.solution).toBeUndefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe("PuzzleSolver.solveMultiple", () => {
    let solver: PuzzleSolver;

    beforeEach(() => {
      solver = new PuzzleSolver();
    });

    afterEach(() => {
      solver.dispose();
    });

    it("should find multiple solutions when they exist", async () => {
      const { NumberFillRule } = await loadRules();

      const input: SolverInput = {
        initialBoard: {
          size: 2,
          cells: [
            [0, 0],
            [0, 0],
          ],
          horizontalEdges: [
            [0, 0],
            [0, 0],
            [0, 0],
          ],
          verticalEdges: [
            [0, 0, 0],
            [0, 0, 0],
          ],
        },
        rules: [NumberFillRule],
      };

      const result = await solver.solveMultiple(input, 2);

      expect(result.status).toBe("sat");
      expect(result.solutions).toBeDefined();
      expect(result.solutions!.length).toBeGreaterThan(0);
      expect(result.solutions!.length).toBeLessThanOrEqual(2);
    });
  });

  describe("PuzzleSolver.validateSolution", () => {
    it("should validate solution correctly", () => {
      const solver = new PuzzleSolver();

      const validBoardState = {
        size: 2,
        cells: [
          [1, 2],
          [3, 4],
        ],
        horizontalEdges: [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
        verticalEdges: [
          [0, 0, 0],
          [0, 0, 0],
        ],
      };

      const invalidBoardState = {
        size: 2,
        cells: [[1, 2], [3]],
        horizontalEdges: [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
        verticalEdges: [
          [0, 0, 0],
          [0, 0, 0],
        ],
      };

      expect(solver.validateSolution(validBoardState, [])).toBe(true);
      expect(solver.validateSolution(invalidBoardState, [])).toBe(false);

      solver.dispose();
    });
  });
}
