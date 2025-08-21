import { Arith, Bool, Context, init, Model } from "z3-solver";

// シリアライズ可能な盤面状態（基底型）
export interface BoardState {
  size: number;
  cells: number[][]; // セル値
  horizontalEdges: number[][]; // 水平線 (size+1 × size)
  verticalEdges: number[][]; // 垂直線 (size × size+1)
}

// Z3変数を使った盤面状態（BoardStateから自動導出）
export type BoardVariable<T extends string> = {
  [K in keyof BoardState]: K extends
    | "cells"
    | "horizontalEdges"
    | "verticalEdges"
    ? Arith<T>[][]
    : BoardState[K];
};

export type DeepReadonly<T> = keyof T extends never
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

// 型変換ユーティリティ関数
export function createBoardVariable<T extends string>(
  boardState: BoardState,
  ctx: Context<T>,
): BoardVariable<T> {
  return {
    size: boardState.size,
    cells: boardState.cells.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`c-${rowIndex}-${colIndex}`)),
    ),
    horizontalEdges: boardState.horizontalEdges.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`he-${rowIndex}-${colIndex}`)),
    ),
    verticalEdges: boardState.verticalEdges.map((row, rowIndex) =>
      row.map((_, colIndex) => ctx.Int.const(`ve-${rowIndex}-${colIndex}`)),
    ),
  };
}

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("createBoardVariable", () => {
    it("should have proper structure", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");

      const boardState: BoardState = {
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
      };

      const boardVar = createBoardVariable(boardState, ctx);

      expect(boardVar.size).toBe(2);
      expect(boardVar.cells.length).toBe(2);
      expect(boardVar.cells[0].length).toBe(2);
    });
  });
}

export function boardVariableToState<T extends string>(
  boardVar: BoardVariable<T>,
  model: Model<T>,
): BoardState {
  return {
    size: boardVar.size,
    cells: boardVar.cells.map((row) =>
      row.map((cellVar) => {
        const value = model.eval(cellVar);
        return parseInt(value.toString());
      }),
    ),
    horizontalEdges: boardVar.horizontalEdges.map((row) =>
      row.map((edgeVar) => {
        const value = model.eval(edgeVar);
        return parseInt(value.toString());
      }),
    ),
    verticalEdges: boardVar.verticalEdges.map((row) =>
      row.map((edgeVar) => {
        const value = model.eval(edgeVar);
        return parseInt(value.toString());
      }),
    ),
  };
}

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("boardVariableToState", () => {
    it("should have proper structure", () => {
      const boardState: BoardState = {
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

      expect(boardState.size).toBe(2);
      expect(boardState.cells.length).toBe(2);
      expect(boardState.cells[0].length).toBe(2);
    });
  });
}

if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("BoardState", () => {
    it("should be serializable to JSON", () => {
      const boardState: BoardState = {
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

      const json = JSON.stringify(boardState);
      const parsed = JSON.parse(json) as BoardState;

      expect(parsed.size).toBe(2);
      expect(parsed.cells).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });
}
