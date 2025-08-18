import { Context } from 'z3-solver';
import { PuzzleFactory, PuzzleSolver } from './interfaces';
import { SudokuSolver } from './sudoku-solver';
import { NQueensSolver } from './nqueens-solver';
import { GraphColoringSolver } from './graph-coloring-solver';

export class Z3PuzzleFactory implements PuzzleFactory {
  private static instance: Z3PuzzleFactory;
  private solverRegistry: Map<string, new (ctx: Context) => PuzzleSolver<any, any>>;

  private constructor() {
    this.solverRegistry = new Map();
    this.registerDefaultSolvers();
  }

  public static getInstance(): Z3PuzzleFactory {
    if (!Z3PuzzleFactory.instance) {
      Z3PuzzleFactory.instance = new Z3PuzzleFactory();
    }
    return Z3PuzzleFactory.instance;
  }

  private registerDefaultSolvers(): void {
    this.solverRegistry.set('sudoku', SudokuSolver);
    this.solverRegistry.set('nqueens', NQueensSolver);
    this.solverRegistry.set('n-queens', NQueensSolver);
    this.solverRegistry.set('graph-coloring', GraphColoringSolver);
    this.solverRegistry.set('graph_coloring', GraphColoringSolver);
  }

  public createSolver<P, S>(puzzleType: string, ctx: Context): PuzzleSolver<P, S> {
    const normalizedType = puzzleType.toLowerCase().trim();
    const SolverClass = this.solverRegistry.get(normalizedType);
    
    if (!SolverClass) {
      throw new Error(`Unknown puzzle type: ${puzzleType}. Supported types: ${this.getSupportedTypes().join(', ')}`);
    }

    return new SolverClass(ctx) as PuzzleSolver<P, S>;
  }

  public getSupportedTypes(): string[] {
    return Array.from(this.solverRegistry.keys());
  }

  // 新しいソルバーを動的に登録する機能
  public registerSolver(
    puzzleType: string, 
    solverClass: new (ctx: Context) => PuzzleSolver<any, any>
  ): void {
    const normalizedType = puzzleType.toLowerCase().trim();
    this.solverRegistry.set(normalizedType, solverClass);
  }

  // ソルバーの登録を解除する機能
  public unregisterSolver(puzzleType: string): boolean {
    const normalizedType = puzzleType.toLowerCase().trim();
    return this.solverRegistry.delete(normalizedType);
  }

  // ソルバーが登録されているかチェック
  public isSupported(puzzleType: string): boolean {
    const normalizedType = puzzleType.toLowerCase().trim();
    return this.solverRegistry.has(normalizedType);
  }
}

// 便利な関数を提供するユーティリティクラス
export class PuzzleUtils {
  // パズルタイプの自動検出（簡単な推測）
  public static inferPuzzleType(data: any): string {
    if (data && typeof data === 'object') {
      // 数独の検出
      if (data.grid && Array.isArray(data.grid) && data.grid.length === 9) {
        return 'sudoku';
      }
      
      // N-Queensの検出
      if (typeof data.n === 'number' && data.n > 0 && !data.edges) {
        return 'nqueens';
      }
      
      // グラフ彩色の検出
      if (typeof data.vertices === 'number' && Array.isArray(data.edges)) {
        return 'graph-coloring';
      }
    }
    
    throw new Error('Could not infer puzzle type from data');
  }

  // パズルデータの検証
  public static validatePuzzleData(puzzleType: string, data: any): boolean {
    const normalizedType = puzzleType.toLowerCase().trim();
    
    switch (normalizedType) {
      case 'sudoku':
        return this.validateSudokuData(data);
      case 'nqueens':
      case 'n-queens':
        return this.validateNQueensData(data);
      case 'graph-coloring':
      case 'graph_coloring':
        return this.validateGraphColoringData(data);
      default:
        return false;
    }
  }

  private static validateSudokuData(data: any): boolean {
    if (!data || !data.grid || !Array.isArray(data.grid)) {
      return false;
    }
    
    if (data.grid.length !== 9) {
      return false;
    }
    
    for (const row of data.grid) {
      if (!Array.isArray(row) || row.length !== 9) {
        return false;
      }
      
      for (const cell of row) {
        if (typeof cell !== 'number' || cell < 0 || cell > 9) {
          return false;
        }
      }
    }
    
    return true;
  }

  private static validateNQueensData(data: any): boolean {
    return data && typeof data.n === 'number' && data.n > 0;
  }

  private static validateGraphColoringData(data: any): boolean {
    if (!data || typeof data.vertices !== 'number' || data.vertices <= 0) {
      return false;
    }
    
    if (!Array.isArray(data.edges)) {
      return false;
    }
    
    if (typeof data.colors !== 'number' || data.colors <= 0) {
      return false;
    }
    
    for (const edge of data.edges) {
      if (!Array.isArray(edge) || edge.length !== 2) {
        return false;
      }
      
      const [u, v] = edge;
      if (typeof u !== 'number' || typeof v !== 'number' || 
          u < 0 || u >= data.vertices || v < 0 || v >= data.vertices) {
        return false;
      }
    }
    
    return true;
  }
}

// 型安全なファクトリー関数
export function createPuzzleSolver<P, S>(
  puzzleType: string, 
  ctx: Context
): PuzzleSolver<P, S> {
  const factory = Z3PuzzleFactory.getInstance();
  return factory.createSolver<P, S>(puzzleType, ctx);
}