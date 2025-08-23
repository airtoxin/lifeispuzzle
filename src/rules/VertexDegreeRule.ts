import { Context, Bool } from "z3-solver";
import { Rule } from "./types";
import { BoardVariable } from "../states";

export const VertexDegreeRule: Rule = {
  id: "vertex-degree-rule",
  name: "頂点次数制約",
  description: "各頂点の次数が0または2である",
  getConstraints<T extends string>(
    boardVar: BoardVariable<T>,
    ctx: Context<T>,
  ) {
    const constraints: Bool<T>[] = [];

    // 格子の頂点は (size+1) x (size+1) 個存在
    for (let row = 0; row <= boardVar.size; row++) {
      for (let col = 0; col <= boardVar.size; col++) {
        const adjacentEdges = [];

        // 上のエッジ（水平エッジ[row-1][col]）
        if (
          row > 0 &&
          row - 1 < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row - 1].length
        ) {
          adjacentEdges.push(boardVar.horizontalEdges[row - 1][col]);
        }

        // 下のエッジ（水平エッジ[row][col]）
        if (
          row < boardVar.horizontalEdges.length &&
          col < boardVar.horizontalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.horizontalEdges[row][col]);
        }

        // 左のエッジ（垂直エッジ[row][col-1]）
        if (
          row < boardVar.verticalEdges.length &&
          col > 0 &&
          col - 1 < boardVar.verticalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.verticalEdges[row][col - 1]);
        }

        // 右のエッジ（垂直エッジ[row][col]）
        if (
          row < boardVar.verticalEdges.length &&
          col < boardVar.verticalEdges[row].length
        ) {
          adjacentEdges.push(boardVar.verticalEdges[row][col]);
        }

        // 隣接エッジの合計（頂点の次数）が0または2
        if (adjacentEdges.length > 0) {
          const degree = adjacentEdges.reduce((sum, edge) => sum.add(edge));
          constraints.push(degree.eq(0).or(degree.eq(2)));
        }
      }
    }

    return constraints;
  },
};
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("VertexDegreeRule", () => {
    it("should be satisfied with valid vertex degrees (0 or 2)", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardVar = createBoardVariable(
        {
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
        ctx,
      );

      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      vertexDegreeConstraints.forEach((constraint) => solver.add(constraint));

      // 全てのエッジを0に設定（すべての頂点の次数が0）
      boardVar.horizontalEdges.flat().forEach((edge) => solver.add(edge.eq(0)));
      boardVar.verticalEdges.flat().forEach((edge) => solver.add(edge.eq(0)));

      const result = await solver.check();
      expect(result).toBe("sat");
    });

    it("should be violated with invalid vertex degrees (1 or 3)", async () => {
      const z3 = await import("z3-solver");
      const { Context } = await z3.init();
      const ctx = Context("test");
      const { createBoardVariable } = await import("../states.js");

      const boardVar = createBoardVariable(
        {
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
        ctx,
      );

      const vertexDegreeConstraints = VertexDegreeRule.getConstraints(
        boardVar,
        ctx,
      );

      const solver = new ctx.Solver();
      vertexDegreeConstraints.forEach((constraint) => solver.add(constraint));

      // 頂点[0][0]の次数を1にする（無効）
      solver.add(boardVar.horizontalEdges[0][0].eq(1));
      solver.add(boardVar.verticalEdges[0][0].eq(0));

      const result = await solver.check();
      expect(result).toBe("unsat");
    });
  });
}
