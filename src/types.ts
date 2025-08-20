import {Arith, Bool, Context} from 'z3-solver';

// シリアライズ可能な盤面状態（基底型）
export interface SerializableBoardState {
  size: number;
  cells: number[][];             // セル値
  horizontalEdges: number[][];   // 水平線 (size+1 × size)
  verticalEdges: number[][];     // 垂直線 (size × size+1)
}

// Z3変数を使った盤面状態（SerializableBoardStateから自動導出）
export type CanonicalBoardState = {
  [K in keyof SerializableBoardState]: K extends 'cells' | 'horizontalEdges' | 'verticalEdges'
    ? Arith[][]
    : SerializableBoardState[K];
};

export type DeepReadonly<T> = keyof T extends never
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

// ルールの基底インターフェース
export interface Rule {
  id: string;
  name: string;
  description: string;
  getConstraints(board: CanonicalBoardState, ctx: Context<any>): Bool<any>[];
}

// Solver関連のインターフェース定義
export interface SolverOptions {
  timeout?: number;        // タイムアウト（ms）
  maxSolutions?: number;   // 求解数上限
  contextName?: string;    // Z3コンテキスト名
}

export interface SolverInput {
  initialBoard: SerializableBoardState;  // 初期盤面（0は未入力）
  rules: Rule[];                         // 適用するルール配列
  options?: SolverOptions;               // オプション設定
}

export interface SolverResult {
  status: 'sat' | 'unsat' | 'timeout' | 'error';
  solution?: SerializableBoardState;     // 解（satの場合）
  solutions?: SerializableBoardState[];  // 複数解（複数求解の場合）
  executionTime: number;                 // 実行時間（ms）
  constraintCount: number;               // 制約数
  error?: string;                        // エラーメッセージ
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

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
}