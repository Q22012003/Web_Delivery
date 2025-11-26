// src/utils/smartPathfinding.js
const validCells = new Set([
  "1,1","1,2","1,3","1,4","1,5",
  "2,1","3,1","4,1","5,1",
  "2,5","3,5","4,5","5,5",
  "5,2","5,3","5,4",
  "2,2","2,3","2,4","3,2","3,3","3,4","4,2","4,3","4,4"
]);

export function isValidCell(r, c) {
  return r >= 1 && r <= 5 && c >= 1 && c <= 5 && validCells.has(`${r},${c}`);
}

function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function getNeighbors([r, c]) {
  return [[0,1],[0,-1],[1,0],[-1,0]]
    .map(([dr, dc]) => [r + dr, c + dc])
    .filter(([nr, nc]) => isValidCell(nr, nc));
}

function parseReserved(setIn) {
  const nodes = new Set(), edges = new Set();
  for (const r of setIn) {
    if (r.includes('->')) edges.add(r);
    else nodes.add(r);
  }
  return { nodes, edges };
}

function shiftReserved(originalSet, delta) {
  const out = new Set();
  for (const r of originalSet) {
    const me = r.match(/(\d+,\d+)->(\d+,\d+)@(\d+)/);
    if (me) { out.add(`${me[1]}->${me[2]}@${+me[3] + delta}`); continue; }
    const mn = r.match(/(\d+,\d+)@(\d+)/);
    if (mn) out.add(`${mn[1]}@${+mn[2] + delta}`);
  }
  return out;
}

export function findSafePathWithReturn(start, goal, reservedTimes, timeOffset = 4, v1Path = null) {
  if (!isValidCell(...start) || !isValidCell(...goal)) return null;

  const key = p => `${p[0]},${p[1]}`;

  // Tìm đường đi đến đích
  let pathToGoal = null;
  let bestDelay = 0;
  for (let delay = 0; delay <= 24; delay += 3) {
    const delayed = shiftReserved(reservedTimes, delay);
    const candidate = aStar(start, goal, delayed, timeOffset + delay, v1Path);
    if (candidate && candidate.length >= 2) {
      pathToGoal = candidate;
      bestDelay = delay;
      break;
    }
  }
  if (!pathToGoal) return null;

  timeOffset += bestDelay;
  const arrivalTime = timeOffset + pathToGoal.length - 1;

  const baseReserved = new Set([...reservedTimes]);
  const v1EndPos = v1Path?.[v1Path.length - 1];
  const isSameDestination = v1EndPos && v1EndPos[0] === goal[0] && v1EndPos[1] === goal[1];

  // Reserve đường đi của V2
  for (let i = 1; i < pathToGoal.length; i++) {
    const p = pathToGoal[i];
    const t = timeOffset + i;
    baseReserved.add(`${key(p)}@${t}`);
    const prev = pathToGoal[i - 1];
    if (prev) baseReserved.add(`${prev[0]},${prev[1]}->${p[0]},${p[1]}@${t}`);
  }

  // CHỐNG SWAP HOÀN HẢO – PHIÊN BẢN CHUẨN CUỐI
  // CHỐNG HOÀN TOÀN VIỆC V2 ĐI NGƯỢC LẠI BẤT KỲ ĐOẠN NÀO V1 ĐÃ QUA KHI VỀ NHÀ
if (v1Path && isSameDestination) {
  const v1GoalIndex = v1Path.findIndex(p => p[0] === goal[0] && p[1] === goal[1]);
  if (v1GoalIndex !== -1) {
    const v1ArrivalTime = v1GoalIndex;

    // Chặn toàn bộ các cạnh mà V1 dùng từ lúc đến đích trở về
    for (let i = v1GoalIndex; i < v1Path.length - 1; i++) {
      const from = v1Path[i];
      const to = v1Path[i + 1];
      const moveTime = v1ArrivalTime + (i - v1GoalIndex) + 1;

      // Buffer cực rộng: ±30 tick để chắc chắn không lọt
      for (let dt = -30; dt <= 50; dt++) {
        const t = moveTime + dt;
        if (t >= 0) {
          // Cấm đi ngược lại cạnh này ở mọi thời điểm khả nghi
          baseReserved.add(`${to[0]},${to[1]}->${from[0]},${from[1]}@${t}`);
        }
      }
    }

    // BONUS: Cấm luôn cả việc đứng yên quá lâu ở đích nếu V1 đã rời đi
    // (tránh V2 đứng đợi đúng lúc V1 quay lại lấy hàng)
    const v1LeaveTime = v1ArrivalTime + 1;
    for (let t = v1LeaveTime - 10; t <= v1LeaveTime + 60; t++) {
      baseReserved.add(`${goal[0]},${goal[1]}@${t}`);
    }
  }
}

  // Tìm đường về
  let returnPath = null;
  let waitAtHome = 0;
  for (waitAtHome = 0; waitAtHome <= 120; waitAtHome += 3) {
    const shifted = shiftReserved(baseReserved, -waitAtHome);
    const candidate = aStar(goal, start, shifted, arrivalTime + waitAtHome + 2, v1Path);
    if (candidate && candidate.length >= 2) {
      returnPath = candidate;
      break;
    }
  }
  if (!returnPath) return null;

  const final = [...pathToGoal];
  if (waitAtHome > 0) final.push(...Array(waitAtHome).fill(goal));
  final.push(...returnPath.slice(1));

  return final;
}

function aStar(start, goal, reservedCombined, offset = 0, v1Path = null) {
  const { nodes: reservedNodes, edges: reservedEdges } = parseReserved(reservedCombined);
  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const key = p => `${p[0]},${p[1]}`;

  gScore.set(key(start), 0);
  openSet.push({ pos: start, f: heuristic(start, goal) });

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const { pos } = openSet.shift();

    if (pos[0] === goal[0] && pos[1] === goal[1]) {
      const path = [];
      let cur = pos;
      while (cur) {
        path.unshift(cur);
        cur = cameFrom.get(key(cur));
      }
      return path;
    }

    for (const nei of getNeighbors(pos)) {
      const nk = key(nei);
      const tentG = (gScore.get(key(pos)) || 0) + 1;
      const tentTime = offset + tentG;

      if (reservedNodes.has(`${nk}@${tentTime}`) || reservedNodes.has(`${nk}@${tentTime-1}`)) continue;
      if (reservedEdges.has(`${key(pos)}->${nk}@${tentTime}`)) continue;

      let penalty = 0;
      if (v1Path && v1Path.some(p => p[0] === nei[0] && p[1] === nei[1])) {
        penalty += 6;
      }

      const newG = tentG + penalty;
      if (!gScore.has(nk) || newG < gScore.get(nk)) {
        cameFrom.set(nk, pos);
        gScore.set(nk, newG);
        const f = newG + heuristic(nei, goal);
        const existing = openSet.find(o => key(o.pos) === nk);
        if (existing) existing.f = f;
        else openSet.push({ pos: nei, f });
      }
    }
  }
  return null;
}