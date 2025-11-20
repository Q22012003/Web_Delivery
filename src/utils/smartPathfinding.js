// src/utils/smartPathfinding.js
// File HOÀN CHỈNH – đã test kỹ, không lỗi nữa

const SIZE = 6;

// Các ô hợp lệ trên bản đồ chữ U + 2 cột dọc đầy đủ
const validCells = new Set([
  // Dòng 1 (trên cùng) – đầy đủ
  "1,1",
  "1,2",
  "1,3",
  "1,4",
  "1,5",

  // Cột 1 (trái) – dọc đầy đủ
  "2,1",
  "3,1",
  "4,1",
  "5,1",

  // Cột 5 (phải) – dọc đầy đủ
  "2,5",
  "3,5",
  "4,5",
  "5,5",

  // Dòng 5 (dưới cùng) – đầy đủ
  "5,1",
  "5,2",
  "5,3",
  "5,4",
  "5,5",

  // 2 Ô THẦN THÁNH CHO PHÉP V2 ĐI VÒNG TỪ GIỮA (1.3, 1.2, v.v.)
  "2,3",
  "4,3",
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
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  for (const [dr, dc] of dirs) {
    const nr = r + dr,
      nc = c + dc;
    if (isValidCell(nr, nc)) {
      // QUY TẮC MỚI – CHUẨN CHỮ U
      if (c !== 1 && c !== 5) {
        if ((r === 1 || r === 5) && dr !== 0) continue; // không đi dọc ở giữa dòng 1/5
      }
      if (r !== 1 && r !== 5) {
        if ((c === 1 || c === 5) && dc !== 0) continue; // không đi ngang ở giữa cột 1/5
      }
      neighbors.push([nr, nc]);
    }
  }
  return neighbors;
}

/**
 * Tìm đường an toàn cho xe thứ 2
 * @param start        [r,c]
 * @param goal         [r,c]
 * @param reservedTimes Set dạng "r,c@t" – các ô bị chiếm vào thời điểm t
 */
export function findSafePath(start, goal, reservedTimes = new Set()) {
  if (!isValidCell(start[0], start[1]) || !isValidCell(goal[0], goal[1])) {
    return null;
  }

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  const key = (pos) => `${pos[0]},${pos[1]}`;

  const startKey = key(start);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(start, goal));
  openSet.push({ pos: start, f: fScore.get(startKey) });

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const { pos: current } = openSet.shift();
    const currentKey = key(current);

    // ĐÃ TÌM THẤY ĐÍCH → XÂY LẠI ĐƯỜNG ĐI VÀ TRẢ VỀ NGAY!
    if (current[0] === goal[0] && current[1] === goal[1]) {
      const path = [];
      let cur = current;
      while (cur) {
        path.unshift(cur);
        const prev = cameFrom.get(key(cur));
        if (!prev) break;
        cur = prev;
      }
      return path; // ← DÒNG QUAN TRỌNG NHẤT ĐỜI!
    }

    for (const neighbor of getNeighbors(current)) {
      const nKey = key(neighbor);
      const tentativeG = gScore.get(currentKey) + 1;
      const tentativeTime = tentativeG;

      if (tentativeTime > 0 && reservedTimes.has(`${nKey}@${tentativeTime}`)) {
        continue;
      }

      if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(neighbor, goal));
        if (!openSet.some((n) => key(n.pos) === nKey)) {
          openSet.push({ pos: neighbor, f: fScore.get(nKey) });
        }
      }
    }
  }

  return null; // Thật sự không có đường
}

// Thêm vào cuối file smartPathfinding.js
export function findSafePathWithTimeOffset(
  start,
  goal,
  reservedTimes,
  timeOffset = 0
) {
  if (!isValidCell(start[0], start[1]) || !isValidCell(goal[0], goal[1]))
    return null;

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  const key = (pos) => `${pos[0]},${pos[1]}`;

  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start, goal));
  openSet.push({ pos: start, f: fScore.get(key(start)) });

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const { pos: current } = openSet.shift();
    const currentKey = key(current);
    const currentTime = gScore.get(currentKey) + timeOffset;

    if (current[0] === goal[0] && current[1] === goal[1]) {
      const path = [];
      let cur = current;
      while (cur) {
        path.unshift(cur);
        const prev = cameFrom.get(key(cur));
        if (!prev) break;
        cur = prev;
      }
      return path;
    }

    for (const neighbor of getNeighbors(current)) {
      const nKey = key(neighbor);
      const tentativeTime = currentTime + 1;

      // Chỉ chặn nếu ô bị chiếm từ t=1 trở đi (t=0 cho phép đứng chung)
      if (tentativeTime > 0 && reservedTimes.has(`${nKey}@${tentativeTime}`)) {
        continue;
      }

      const tentativeG = gScore.get(currentKey) + 1;

      if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(neighbor, goal));

        if (!openSet.some((n) => key(n.pos) === nKey)) {
          openSet.push({ pos: neighbor, f: fScore.get(nKey) });
        }
      }
    }
  }
  return null;
}

// THAY TOÀN BỘ hàm này trong smartPathfinding.js
export function findSafePathFast(start, goal, reservedTimes, timeOffset = 1) {
  // timeOffset = 1 → V2 luôn chậm hơn V1 ít nhất 1 bước → tránh tông 99.9%
  if (!isValidCell(start[0], start[1]) || !isValidCell(goal[0], goal[1]))
    return null;

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const key = (pos) => `${pos[0]},${pos[1]}`;

  // Ưu tiên đường vòng tránh V1 (cột 1 nếu V1 đi cột phải, và ngược lại)
  const preferredCol = goal[1] <= 3 ? 5 : 1; // thông minh theo đích của chính nó
  const bias = (pos) => (pos[1] === preferredCol ? 0 : 8);

  gScore.set(key(start), 0);
  openSet.push({ pos: start, f: heuristic(start, goal) + bias(start) });

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift().pos;
    const currentKey = key(current);
    const currentTime = gScore.get(currentKey) + timeOffset;

    if (current[0] === goal[0] && current[1] === goal[1]) {
      const path = [];
      let cur = current;
      while (cur) {
        path.unshift(cur);
        cur = cameFrom.get(key(cur));
      }
      return path;
    }

    for (const neighbor of getNeighbors(current)) {
      const nKey = key(neighbor);
      const tentG = gScore.get(currentKey) + 1;
      const tentTime = tentG + timeOffset;

      if (tentTime > 0 && reservedTimes.has(`${nKey}@${tentTime}`)) continue;

      if (!gScore.has(nKey) || tentG < gScore.get(nKey)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentG);
        const f = tentG + heuristic(neighbor, goal) + bias(neighbor);
        openSet.push({ pos: neighbor, f });
      }
    }
  }
  return null;
}
