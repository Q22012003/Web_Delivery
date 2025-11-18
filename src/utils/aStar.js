// src/utils/aStar.js – PHIÊN BẢN HOÀN HẢO, ĐỒNG BỘ VỚI smartPathfinding.js
const validCells = new Set([
  "1,1", "1,2", "1,3", "1,4", "1,5",
  "2,1", "3,1", "4,1", "5,1",
  "2,5", "3,5", "4,5", "5,5",
  "5,1", "5,2", "5,3", "5,4", "5,5",
  "2,3",  // THẦN THÁNH
  "4,3"   // THẦN THÁNH
]);

export function isValidCell(r, c) {
  return r >= 1 && r <= 5 && c >= 1 && c <= 5 && validCells.has(`${r},${c}`);
}

function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function getNeighbors(pos) {
  const [r, c] = pos;
  const neighbors = [];
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];

  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (isValidCell(nr, nc)) {
      // QUY TẮC CHUẨN CHỮ U – CHO PHÉP ĐI XUỐNG TỪ DÒNG 1 Ở GIỮA
      if (c !== 1 && c !== 5) {
        if ((r === 1 || r === 5) && dr !== 0) continue;
      }
      if (r !== 1 && r !== 5) {
        if ((c === 1 || c === 5) && dc !== 0) continue;
      }
      neighbors.push([nr, nc]);
    }
  }
  return neighbors;
}

export function aStarSearch(start, goal, returnToStart = true) {
  if (!isValidCell(start[0], start[1]) || !isValidCell(goal[0], goal[1])) {
    return [];
  }

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  const key = pos => `${pos[0]},${pos[1]}`;

  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start, goal));
  openSet.push({ pos: start, f: fScore.get(key(start)) });

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const { pos: current } = openSet.shift();
    const currentKey = key(current);

    if (current[0] === goal[0] && current[1] === goal[1]) {
      const path = [];
      let cur = current;
      while (cur) {
        path.unshift(cur);
        const prev = cameFrom.get(key(cur));
        if (!prev) break;
        cur = prev;
      }

      if (returnToStart && (start[0] !== goal[0] || start[1] !== goal[1])) {
        const returnPath = aStarSearch(goal, start, false);
        return returnPath.length > 1 ? path.concat(returnPath.slice(1)) : path;
      }
      return path;
    }

    for (const neighbor of getNeighbors(current)) {
      const nKey = key(neighbor);
      const tentativeG = (gScore.get(currentKey) || 0) + 1;

      if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(neighbor, goal));

        if (!openSet.some(n => key(n.pos) === nKey)) {
          openSet.push({ pos: neighbor, f: fScore.get(nKey) });
        }
      }
    }
  }
  return [];
}