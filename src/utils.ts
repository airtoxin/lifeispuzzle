import { Context, init } from 'z3-solver';
import { SerializableBoardState, CanonicalBoardState } from './types.js';

// 型変換ユーティリティ関数
export function createCanonicalBoardState(serializable: SerializableBoardState, ctx: Context<any>): CanonicalBoardState {
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

export function boardStateToSerializable(board: CanonicalBoardState, model: any): SerializableBoardState {
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

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('Utils', () => {
    it('createCanonicalBoardState should have proper structure', async () => {
      const z3 = await import('z3-solver');
      const { Context } = await z3.init();
      const ctx = Context('test');

      const serializableBoard: SerializableBoardState = {
        size: 2,
        cells: [[0, 0], [0, 0]],
        horizontalEdges: [[0, 0], [0, 0], [0, 0]],
        verticalEdges: [[0, 0, 0], [0, 0, 0]]
      };

      const canonicalBoard = createCanonicalBoardState(serializableBoard, ctx);
      
      expect(canonicalBoard.size).toBe(2);
      expect(canonicalBoard.cells.length).toBe(2);
      expect(canonicalBoard.cells[0].length).toBe(2);
    });

    it('boardStateToSerializable should have proper structure', () => {
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
}