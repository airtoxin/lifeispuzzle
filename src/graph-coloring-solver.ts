import { Context, Arith, Solver, Model, CheckSatResult } from 'z3-solver';
import { Z3BaseSolver, Puzzle, Solution } from './interfaces';

// グラフ彩色パズルの型定義
export interface GraphColoringPuzzle {
  vertices: number; // 頂点数
  edges: [number, number][]; // エッジのリスト（頂点のペア）
  colors: number; // 使用可能な色数
}

export interface GraphColoringSolution {
  coloring: number[]; // 各頂点の色（0-indexed）
  vertices: number;
  colors: number;
}

// グラフ彩色ソルバー
export class GraphColoringSolver extends Z3BaseSolver<GraphColoringPuzzle, GraphColoringSolution> {
  public readonly solverType = 'graph-coloring';

  public async solve(puzzle: Puzzle<GraphColoringPuzzle>): Promise<Solution<GraphColoringSolution>> {
    const { vertices, edges, colors } = puzzle.data;
    
    if (vertices <= 0 || colors <= 0) {
      return this.createSolution({ coloring: [], vertices, colors }, false, {
        error: 'Invalid vertices or colors count'
      });
    }

    // 各頂点の色を表す変数を作成
    const vertexColors: Arith[] = [];
    for (let i = 0; i < vertices; i++) {
      vertexColors[i] = this.ctx.Int.const(`vertex_${i}_color`);
    }

    const solver = new this.ctx.Solver();

    // 制約1: 各頂点の色は 0 から colors-1 の範囲内
    for (let i = 0; i < vertices; i++) {
      solver.add(this.ctx.And(
        vertexColors[i].ge(0),
        vertexColors[i].le(colors - 1)
      ));
    }

    // 制約2: 隣接する頂点は異なる色を持つ
    for (const [u, v] of edges) {
      if (u >= 0 && u < vertices && v >= 0 && v < vertices && u !== v) {
        solver.add(vertexColors[u].neq(vertexColors[v]));
      }
    }

    // 解を探す
    const result: CheckSatResult = await solver.check();

    if (result === 'sat') {
      const model: Model = solver.model();
      const coloring: number[] = [];

      for (let i = 0; i < vertices; i++) {
        const value = model.eval(vertexColors[i]);
        coloring[i] = parseInt(value.toString());
      }

      return this.createSolution({ coloring, vertices, colors }, true, {
        solverType: this.solverType,
        edgeCount: edges.length
      });
    }

    return this.createSolution({ coloring: [], vertices, colors }, false);
  }

  public async findAllSolutions(puzzle: Puzzle<GraphColoringPuzzle>, maxSolutions: number = 100): Promise<GraphColoringSolution[]> {
    const { vertices, edges, colors } = puzzle.data;
    const solutions: GraphColoringSolution[] = [];
    
    if (vertices <= 0 || colors <= 0) {
      return solutions;
    }

    // 各頂点の色を表す変数を作成
    const vertexColors: Arith[] = [];
    for (let i = 0; i < vertices; i++) {
      vertexColors[i] = this.ctx.Int.const(`v_${i}_col`);
    }

    const solver = new this.ctx.Solver();

    // グラフ彩色の制約を追加
    this.addGraphColoringConstraints(solver, vertexColors, edges, vertices, colors);

    while (solutions.length < maxSolutions) {
      const result = await solver.check();
      
      if (result !== 'sat') {
        break;
      }

      const model = solver.model();
      const coloring: number[] = [];

      for (let i = 0; i < vertices; i++) {
        const value = model.eval(vertexColors[i]);
        coloring[i] = parseInt(value.toString());
      }

      solutions.push({ coloring, vertices, colors });

      // この解を除外する制約を追加
      const excludeConstraints = [];
      for (let i = 0; i < vertices; i++) {
        excludeConstraints.push(vertexColors[i].neq(coloring[i]));
      }
      solver.add(this.ctx.Or(...excludeConstraints));
    }

    return solutions;
  }

  private addGraphColoringConstraints(
    solver: Solver, 
    vertexColors: Arith[], 
    edges: [number, number][], 
    vertices: number, 
    colors: number
  ): void {
    // 制約1: 各頂点の色は有効な範囲内
    for (let i = 0; i < vertices; i++) {
      solver.add(this.ctx.And(
        vertexColors[i].ge(0),
        vertexColors[i].le(colors - 1)
      ));
    }

    // 制約2: 隣接する頂点は異なる色
    for (const [u, v] of edges) {
      if (u >= 0 && u < vertices && v >= 0 && v < vertices && u !== v) {
        solver.add(vertexColors[u].neq(vertexColors[v]));
      }
    }
  }

  // 最小彩色数を求める関数
  public async findMinimalColoring(puzzle: Puzzle<GraphColoringPuzzle>): Promise<Solution<GraphColoringSolution & { minimalColors: number }>> {
    const { vertices, edges } = puzzle.data;
    
    // バイナリサーチで最小彩色数を見つける
    let left = 1;
    let right = vertices;
    let bestSolution: GraphColoringSolution | null = null;
    let minColors = vertices;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const testPuzzle: Puzzle<GraphColoringPuzzle> = {
        ...puzzle,
        data: { vertices, edges, colors: mid }
      };

      const result = await this.solve(testPuzzle);
      
      if (result.solved) {
        bestSolution = result.data;
        minColors = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    if (bestSolution) {
      return this.createSolution({
        ...bestSolution,
        minimalColors: minColors
      }, true, {
        solverType: this.solverType,
        minimalColors: minColors
      });
    }

    return this.createSolution({
      coloring: [],
      vertices,
      colors: 0,
      minimalColors: 0
    }, false);
  }

  // ソリューションを表示するヘルパー関数
  public static displaySolution(solution: GraphColoringSolution): string {
    let result = `Graph Coloring (${solution.vertices} vertices, ${solution.colors} colors):\n`;
    
    for (let i = 0; i < solution.vertices; i++) {
      result += `Vertex ${i}: Color ${solution.coloring[i]}\n`;
    }
    
    return result;
  }

  // よく知られたグラフのファクトリー関数
  public static createCompleteGraph(n: number): GraphColoringPuzzle {
    const edges: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        edges.push([i, j]);
      }
    }
    return { vertices: n, edges, colors: n };
  }

  public static createCycleGraph(n: number): GraphColoringPuzzle {
    const edges: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      edges.push([i, (i + 1) % n]);
    }
    return { vertices: n, edges, colors: 3 };
  }
}