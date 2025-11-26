// src/utils/smartPathfinding.js
const validCells = new Set([
  "1,1","1,2","1,3","1,4","1,5",
  "2,1","3,1","4,1","5,1",
  "2,5","3,5","4,5","5,5",
  "5,1","5,2","5,3","5,4","5,5",
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

export function findSafePathWithReturn(start, goal, reservedTimes, timeOffset = 4, v1Path = null) {
  if (!isValidCell(...start) || !isValidCell(...goal)) return null;

  const key = p => `${p[0]},${p[1]}`;

  function parseReserved(setIn) {
    const nodes = new Set(), edges = new Set();
    for (const r of setIn) {
      const me = r.match(/(\d+,\d+)->(\d+,\d+)@(\d+)/);
      if (me) { edges.add(r); continue; }
      nodes.add(r);
    }
    return { nodes, edges };
  }

  function shiftReserved(originalSet, delta) {
    const out = new Set();
    for (const r of originalSet) {
      const me = r.match(/(\d+,\d+)->(\d+,\d+)@(\d+)/);
      if (me) { out.add(`${me[1]}->${me[2]}@${+me[3] + delta}`); continue; }
      const mn = r.match(/(\d+,\d+)@(\d+)/);
      if (mn) { out.add(`${mn[1]}@${+mn[2] + delta}`); }
    }
    return out;
  }

  // Tìm đường đi
  let pathToGoal = null;
  for (let delay = 0; delay <= 16; delay += 3) {
    const delayed = shiftReserved(reservedTimes, delay);
    const candidate = aStar(start, goal, delayed, timeOffset + delay, v1Path);
    if (candidate && candidate.length >= 2) {
      pathToGoal = candidate;
      timeOffset += delay;
      break;
    }
  }

  if (!pathToGoal) return null;

  const arrivalTime = timeOffset + pathToGoal.length - 1;

  // Đường về: tăng wait max lên 60 + tránh mạnh các ô V1 từng đi
  let returnPath = null;
  let wait = 0;
  const baseReserved = new Set([...reservedTimes]);
  for (let i = 1; i < pathToGoal.length; i++) {
    const p = pathToGoal[i];
    const t = timeOffset + i;
    baseReserved.add(`${key(p)}@${t}`);
    const prev = pathToGoal[i-1];
    if (prev) baseReserved.add(`${prev[0]},${prev[1]}->${p[0]},${p[1]}@${t}`);
  }
  for (let t = arrivalTime; t < arrivalTime + 15; t++) {
    baseReserved.add(`${key(goal)}@${t}`);
  }

  for (wait = 0; wait <= 60; wait += 4) {
    const shifted = shiftReserved(baseReserved, -wait);
    const candidate = aStar(goal, start, shifted, arrivalTime + wait + 2, v1Path);
    if (candidate && candidate.length >= 2) {
      returnPath = candidate;
      break;
    }
  }

  const final = [...pathToGoal];
  if (returnPath) {
    if (wait > 0) final.push(...Array(wait).fill(goal));
    final.push(...returnPath.slice(1));
  }
  return final;
}

function aStar(start, goal, reservedCombined, offset = 0, v1Path = null) {
  const { nodes: reservedNodes, edges: reservedEdges } = (() => {
    const n = new Set(), e = new Set();
    for (const r of reservedCombined) {
      if (r.includes('->')) e.add(r);
      else n.add(r);
    }
    return { nodes: n, edges: e };
  })();

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
      if (reservedEdges.has(`${nk}->${key(pos)}@${tentTime}`)) continue;

      // TRÁNH MẠNH CÁC Ô V1 TỪNG ĐI QUA
      let penalty = 0;
      if (v1Path && v1Path.some(p => p[0] === nei[0] && p[1] === nei[1])) {
        penalty += 15; // cực kỳ tránh
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