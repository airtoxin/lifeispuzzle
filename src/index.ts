// エクスポート
export * from "./states.js";
export {
  PuzzleSolver,
  SolverOptions,
  SolverInput,
  SolverResult,
} from "./solver.js";

// 便利な再エクスポート
import { PuzzleSolver } from "./solver.js";
import { BoardState } from "./states.js";
import { MagicSquareRule } from "./rules/MagicSquareRule.js";
import { NumberFillRule } from "./rules/NumberFillRule.js";

// サンプル実行
async function runSample() {
  console.log("=== PuzzleSolver を使用したサンプル実行 ===");

  // シリアライズ可能な基底状態を定義（いくつか初期値を設定）
  const initialBoard: BoardState = {
    size: 3,
    cells: [
      [2, 0, 0], // 左上に2を固定
      [0, 5, 0], // 真ん中に5を固定
      [0, 0, 8], // 右下に8を固定
    ],
    horizontalEdges: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    verticalEdges: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  };

  // PuzzleSolverインスタンス作成
  const solver = new PuzzleSolver({
    contextName: "sample",
    timeout: 10000,
  });

  try {
    // 単一解の求解
    console.log("\n--- 単一解の求解 ---");
    const singleResult = await solver.solve({
      initialBoard,
      rules: [NumberFillRule, MagicSquareRule],
    });

    console.log(`ステータス: ${singleResult.status}`);
    console.log(`実行時間: ${singleResult.executionTime}ms`);
    console.log(`制約数: ${singleResult.constraintCount}`);

    if (singleResult.status === "sat" && singleResult.solution) {
      console.log("見つかった解:");
      console.log(JSON.stringify(singleResult.solution, null, 2));
    } else if (singleResult.status === "error") {
      console.error("エラー:", singleResult.error);
    }

    // 複数解の求解（もしあれば）
    console.log("\n--- 複数解の求解（最大3解） ---");
    const multiResult = await solver.solveMultiple(
      {
        initialBoard: {
          size: 2,
          cells: [
            [0, 0],
            [0, 0],
          ], // 全て未設定の簡単な例
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
      },
      3,
    );

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
