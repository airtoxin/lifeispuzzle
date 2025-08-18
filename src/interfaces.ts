import { Context } from 'z3-solver';

// 汎用パズルのインターフェース
export interface Puzzle<T = unknown> {
  data: T;
  type: string;
}

// 汎用解のインターフェース
export interface Solution<T = unknown> {
  data: T;
  solved: boolean;
  isUnique?: boolean;
  alternativeSolutions?: T[];
  metadata?: Record<string, unknown>;
}

// パズルソルバーのインターフェース
export interface PuzzleSolver<P, S> {
  readonly solverType: string;
  solve(puzzle: Puzzle<P>): Promise<Solution<S>>;
  checkUniqueness?(puzzle: Puzzle<P>, currentSolution: S): Promise<{ isUnique: boolean; alternatives: S[] }>;
  findAllSolutions?(puzzle: Puzzle<P>, maxSolutions?: number): Promise<S[]>;
}

// Z3ベースソルバーの抽象基底クラス
export abstract class Z3BaseSolver<P, S> implements PuzzleSolver<P, S> {
  protected ctx: Context;
  public abstract readonly solverType: string;

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  abstract solve(puzzle: Puzzle<P>): Promise<Solution<S>>;

  // デフォルトの一意性チェック実装（必要に応じてオーバーライド）
  async checkUniqueness(puzzle: Puzzle<P>, currentSolution: S): Promise<{ isUnique: boolean; alternatives: S[] }> {
    throw new Error(`Uniqueness check not implemented for ${this.solverType}`);
  }

  // デフォルトの全解探索実装（必要に応じてオーバーライド）
  async findAllSolutions(puzzle: Puzzle<P>, maxSolutions: number = 100): Promise<S[]> {
    throw new Error(`Find all solutions not implemented for ${this.solverType}`);
  }

  // 共通のヘルパーメソッド
  protected createSolution<T>(data: T, solved: boolean, metadata?: Record<string, unknown>): Solution<T> {
    return {
      data,
      solved,
      metadata
    };
  }
}

// パズルファクトリーのインターフェース
export interface PuzzleFactory {
  createSolver<P, S>(puzzleType: string, ctx: Context): PuzzleSolver<P, S>;
  getSupportedTypes(): string[];
}