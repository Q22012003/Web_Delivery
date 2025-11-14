// aStar.js
const SIZE = 6;

// Danh sách các ô hợp lệ (đường chữ U + cột 5)
const validCells = new Set([
  // Dòng 1 (top horizontal)
  "1,1",
  "1,2",
  "1,3",
  "1,4",
  "1,5",
  // Cột 5 (vertical right)
  "1,5",
  "2,5",
  "3,5",
  "4,5",
  "5,5",
  // Dòng 5 (bottom horizontal)
  "5,1",
  "5,2",
  "5,3",
  "5,4",
  "5,5",
]);

function isValidCell(r, c) {
  return r >= 1 && r <= 5 && c >= 1 && c <= 5 && validCells.has(`${r},${c}`);
}

function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

// aStar.js (chỉ sửa hàm format và log)
function formatPos(pos) {
  return `${pos[0]}.${pos[1]}`;
}

// Thêm hàm này để tạo log hành trình đẹp
export function getPathString(path) {
  if (path.length === 0) return "Không có đường";
  return path.map(formatPos).join(" → ");
}

// Ưu tiên đi theo LINE thực tế (không đi tắt)
function getNeighbors(pos) {
  const [r, c] = pos;
  const neighbors = [];

  // Dọc trên (row 1): chỉ trái ↔ phải
  if (r === 1) {
    if (c > 1) neighbors.push([r, c - 1]);
    if (c < 5) neighbors.push([r, c + 1]);
  }

  // Dọc phải (col 5): chỉ lên ↕ xuống
  if (c === 5) {
    if (r > 1) neighbors.push([r - 1, c]);
    if (r < 5) neighbors.push([r + 1, c]);
  }

  // Dọc dưới (row 5): chỉ phải → trái
  if (r === 5) {
    if (c > 1) neighbors.push([r, c - 1]);
    if (c < 5) neighbors.push([r, c + 1]);
  }

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
  const key = (pos) => pos.join(",");

  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start, goal));
  openSet.push({ pos: start, f: fScore.get(key(start)) });

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift().pos;
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

    for (const n of getNeighbors(current)) {
      const nKey = key(n);
      const tentativeG = (gScore.get(currentKey) || 0) + 1;

      if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(n, goal));

        if (!openSet.some((node) => key(node.pos) === nKey)) {
          openSet.push({ pos: n, f: fScore.get(nKey) });
        }
      }
    }
  }

  return [];
}
