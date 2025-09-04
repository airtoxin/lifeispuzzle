const solution = {
  size: 2,
  cells: [
    [2, 2],
    [2, 2],
  ],
  horizontalEdges: [
    [1, 1], // 上の行
    [0, 0], // 真ん中の行
    [1, 1], // 下の行
  ],
  verticalEdges: [
    [1, 0, 1], // 左の列、真ん中の列、右の列
    [1, 0, 1],
  ],
};

function visualizeSlitherlinkSolution(solution) {
  const { size, cells, horizontalEdges, verticalEdges } = solution;
  const result = [];

  for (let row = 0; row <= size; row++) {
    // 水平エッジの行
    let horizLine = '';
    for (let col = 0; col <= size; col++) {
      horizLine += '+';
      if (col < size) {
        horizLine += horizontalEdges[row][col] === 1 ? '---' : '   ';
      }
    }
    result.push(horizLine);

    // セルと垂直エッジの行（最後の行を除く）
    if (row < size) {
      let cellLine = '';
      for (let col = 0; col <= size; col++) {
        cellLine += verticalEdges[row][col] === 1 ? '|' : ' ';
        if (col < size) {
          const cellValue = cells[row][col];
          cellLine += cellValue > 0 ? ` ${cellValue} ` : '   ';
        }
      }
      result.push(cellLine);
    }
  }

  return result.join('\n');
}

console.log("SNAPSHOT OUTPUT:");
console.log(JSON.stringify(visualizeSlitherlinkSolution(solution)));