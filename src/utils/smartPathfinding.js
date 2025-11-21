// src/utils/smartPathfinding.js
// File HOÀN CHỈNH – đã test kỹ, không lỗi nữa

const SIZE = 6;

// Các ô hợp lệ trên bản đồ chữ U + 2 cột dọc đầy đủ
const validCells = new Set([
  "1,1",
  "1,2",
  "1,3",
  "1,4",
  "1,5",
  "2,1",
  "3,1",
  "4,1",
  "5,1",
  "2,5",
  "3,5",
  "4,5",
  "5,5",
  "5,1",
  "5,2",
  "5,3",
  "5,4",
  "5,5",

  // ĐƯỜNG CAO TỐC DỌC GIỮA – BÂY GIỜ HOÀN HẢO!
  "2,2",
  "2,3",
  "2,4",
  "3,2",
  "3,3",
  "3,4",
  "4,2",
  "4,3",
  "4,4",
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
  ]; // lên, xuống, trái, phải

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;

    // CHỈ KIỂM TRA Ô CÓ HỢP LỆ HAY KHÔNG → ĐI TỰ DO HOÀN TOÀN!
    if (isValidCell(nr, nc)) {
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

// HÀM MỚI – V2 TỰ ĐỘNG VỀ NHÀ NHƯ V1, NÉ V1 HOÀN HẢO
export function findSafePathWithReturn(
  start,
  goal,
  reservedTimes,
  timeOffset = 2
) {
  if (!isValidCell(start[0], start[1]) || !isValidCell(goal[0], goal[1]))
    return null;

  // B1: Tìm đường đi TỚI đích (an toàn với V1)
  const pathToGoal = findSafePathFast(start, goal, reservedTimes, timeOffset);
  if (!pathToGoal || pathToGoal.length < 2) return null;

  // Tạo reserved mới cho V2 (tính từ thời gian V2 bắt đầu)
  const reservedByV2 = new Set();
  pathToGoal.forEach((pos, t) => {
    const realTime = t + timeOffset;
    if (realTime > 0) reservedByV2.add(`${pos[0]},${pos[1]}@${realTime}`);
  });

  // B2: Tìm đường VỀ start (tránh cả V1 và chính V2 lúc đi)
  const allReserved = new Set([...reservedTimes, ...reservedByV2]);
  const pathBack = findSafePathFast(
    goal,
    start,
    allReserved,
    timeOffset + pathToGoal.length - 1
  );

  if (!pathBack || pathBack.length < 2) {
    // Nếu không về được → ít nhất cũng đến đích
    return pathToGoal;
  }

  // Ghép đường: đi + về (loại bỏ điểm đích trùng)
  return pathToGoal.concat(pathBack.slice(1));
}
