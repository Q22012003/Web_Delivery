// src/utils/aStar.js – PHIÊN BẢN THÔNG MINH NHẤT (REALISTIC PATHFINDING)
const SIZE = 6;

// Bản đồ chữ U + 2 cột dọc đầy đủ (cột 1 và cột 5) → cho phép đi thẳng cực thông minh
const validCells = new Set([
  // Dòng trên cùng (row 1)
  "1,1",
  "1,2",
  "1,3",
  "1,4",
  "1,5",
  // Cột phải (col 5) – dọc đầy đủ
  "1,5",
  "2,5",
  "3,5",
  "4,5",
  "5,5",
  // Dòng dưới cùng (row 5)
  "5,1",
  "5,2",
  "5,3",
  "5,4",
  "5,5",
  // Cột trái (col 1) – dọc đầy đủ → đây là chìa khóa để đi thẳng!
  "1,1",
  "2,1",
  "3,1",
  "4,1",
  "5,1",
]);

function isValidCell(r, c) {
  return r >= 1 && r <= 5 && c >= 1 && c <= 5 && validCells.has(`${r},${c}`);
}

// Heuristic Manhattan chuẩn
function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

// Neighbors cực kỳ thông minh – cho phép đi tất cả hướng hợp lệ trên các làn
function getNeighbors(pos) {
  const [r, c] = pos;
  const neighbors = [];

  // 1. Trên dòng 1 hoặc dòng 5 → cho đi ngang trái/phải
  if (r === 1 || r === 5) {
    if (c > 1) neighbors.push([r, c - 1]);
    if (c < 5) neighbors.push([r, c + 1]);
  }

  // 1. Trên cột 1 hoặc cột 5 → cho đi dọc lên/xuống
  if (c === 1 || c === 5) {
    if (r > 1) neighbors.push([r - 1, c]);
    if (r < 5) neighbors.push([r + 1, c]);
  }

  // LỌC CHỈ GIỮ Ô HỢP LỆ
  return neighbors.filter((n) => isValidCell(n[0], n[1]));
}

export function aStarSearch(start, goal, returnToStart = true) {
  if (!isValidCell(start[0], start[1]) || !isValidCell(goal[0], goal[1])) {
    return [];
  }

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  const key = (pos) => `${pos[0]},${pos[1]}`;

  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start, goal));
  openSet.push({ pos: start, f: fScore.get(key(start)) });

  while (openSet.length > 0) {
    // Tìm node có f nhỏ nhất
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift().pos;
    const currentKey = key(current);

    // Đến đích
    if (current[0] === goal[0] && current[1] === goal[1]) {
      // Xây đường đi
      const path = [];
      let cur = current;
      while (cur) {
        path.unshift(cur);
        const prev = cameFrom.get(key(cur));
        if (!prev) break;
        cur = prev;
      }

      // Nếu cần về kho
      if (returnToStart && (start[0] !== goal[0] || start[1] !== goal[1])) {
        const returnPath = aStarSearch(goal, start, false);
        return returnPath.length > 1 ? path.concat(returnPath.slice(1)) : path;
      }
      return path;
    }

    for (const neighbor of getNeighbors(current)) {
      const nKey = key(neighbor);
      const tentativeG = gScore.get(currentKey) + 1;

      if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(neighbor, goal));

        if (!openSet.some((node) => key(node.pos) === nKey)) {
          openSet.push({ pos: neighbor, f: fScore.get(nKey) });
        }
      }
    }
  }

  return []; // Không tìm thấy đường
}
