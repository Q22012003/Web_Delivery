// ================== SMART PATHFINDING V2 ==================

const validCells = new Set([
  "1,1",
  "1,2",
  "1,3",
  "1,4",
  "1,5",
  "2,1",
  "2,2",
  "2,3",
  "2,4",
  "2,5",
  "3,1",
  "3,2",
  "3,3",
  "3,4",
  "3,5",
  "4,1",
  "4,2",
  "4,3",
  "4,4",
  "4,5",
  "5,1",
  "5,2",
  "5,3",
  "5,4",
  "5,5",
]);

export function isValidCell(r, c) {
  return r >= 1 && r <= 5 && c >= 1 && c <= 5 && validCells.has(`${r},${c}`);
}

function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function getNeighbors([r, c]) {
  return [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]
    .map(([dr, dc]) => [r + dr, c + dc])
    .filter(([nr, nc]) => isValidCell(nr, nc));
}

function parseReserved(setIn) {
  const nodes = new Set(),
    edges = new Set();
  for (const r of setIn) {
    r.includes("->") ? edges.add(r) : nodes.add(r);
  }
  return { nodes, edges };
}

function shiftReserved(originalSet, delta) {
  const out = new Set();
  for (const r of originalSet) {
    const me = r.match(/(\d+,\d+)->(\d+,\d+)@(\d+)/);
    if (me) {
      out.add(`${me[1]}->${me[2]}@${+me[3] + delta}`);
      continue;
    }
    const mn = r.match(/(\d+,\d+)@(\d+)/);
    if (mn) out.add(`${mn[1]}@${+mn[2] + delta}`);
  }
  return out;
}

// ================== FIND SAFE PATH WITH RETURN ==================
export function findSafePathWithReturn(
  start,
  goal,
  reservedTimes,
  timeOffset = 0,
  v1Path = [],
  v1StartTime = 0,
  v2DelayTicks = 17
) {
  if (!isValidCell(...start) || !isValidCell(...goal)) return null;
  const key = (p) => `${p[0]},${p[1]}`;
  const v1Offset = Math.round(v1StartTime / 100);

  // --- PATH TO GOAL ---
  let pathToGoal = null,
    bestDelay = 0;
  for (let delay = 0; delay <= 36; delay++) {
    const delayed = shiftReserved(reservedTimes, delay);
    const candidate = aStar(
      start,
      goal,
      delayed,
      timeOffset + delay,
      v1Path,
      v1Offset,
      v2DelayTicks
    );
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

  // --- RESERVE V2 PATH ---
  for (let i = 1; i < pathToGoal.length; i++) {
    const p = pathToGoal[i];
    const t = arrivalTime - (pathToGoal.length - 1) + i;
    baseReserved.add(`${key(p)}@${t}`);
    const prev = pathToGoal[i - 1];
    baseReserved.add(`${key(prev)}->${key(p)}@${t}`);
  }

  // --- RESERVE V1 NODES & EDGES ---
  if (v1Path && v1Path.length) {
    for (let i = 0; i < v1Path.length; i++) {
      const p = v1Path[i];
      const t = i;
      for (let dt = -2; dt <= 2; dt++) {
        const ti = t + dt;
        if (ti >= 0) baseReserved.add(`${key(p)}@${ti}`);
      }
    }
    for (let i = 0; i < v1Path.length - 1; i++) {
      const from = v1Path[i],
        to = v1Path[i + 1];
      const moveTime = i + 1;
      for (let dt = -2; dt <= 2; dt++) {
        const ti = moveTime + dt;
        if (ti >= 0) baseReserved.add(`${key(to)}->${key(from)}@${ti}`);
      }
    }
  }

  // --- RETURN PATH ---
  let returnPath = null;
  for (let waitAtHome = 0; waitAtHome <= 180; waitAtHome++) {
    const shifted = shiftReserved(baseReserved, -waitAtHome);
    const candidate = aStar(
      goal,
      start,
      shifted,
      arrivalTime + waitAtHome + 2,
      v1Path,
      v1Offset,
      v2DelayTicks
    );
    if (candidate && candidate.length >= 2) {
      returnPath = candidate;
      break;
    }
  }
  if (!returnPath) return null;

  return [...pathToGoal, ...returnPath.slice(1)];
}

// ================== A* HEAD-ON SAFE ==================
function aStar(
  start,
  goal,
  reservedCombined,
  offset = 0,
  v1Path = [],
  v1TimeOffset = 0,
  v2DelayTicks = 17
) {
  const { nodes: reservedNodes, edges: reservedEdges } =
    parseReserved(reservedCombined);
  const openSet = [],
    cameFrom = new Map(),
    gScore = new Map();
  const key = (p) => `${p[0]},${p[1]}`;
  const closed = new Set();

  const startState = `${key(start)}@${offset}`;
  gScore.set(startState, 0);
  openSet.push({ pos: start, f: heuristic(start, goal), time: offset });

  while (openSet.length) {
    openSet.sort((a, b) => a.f - b.f);
    const { pos, time: posTime } = openSet.shift();
    const posK = key(pos);
    const posState = `${posK}@${posTime}`;
    if (closed.has(posState)) continue;
    closed.add(posState);

    // --- GOAL FOUND ---
    if (pos[0] === goal[0] && pos[1] === goal[1]) {
      const path = [];
      let cur = posState;
      while (cur) {
        path.unshift(cur);
        cur = cameFrom.get(cur);
      }
      return path.map((s) => {
        const [rc] = s.split("@");
        return rc.split(",").map(Number);
      });
    }

    const curG = gScore.get(posState) || 0;
    const neighbors = getNeighbors(pos);
    let hasFreeNeighbor = false;

    // --- FORCE WAIT AT START IF V1 STILL THERE ---
    if (
      posTime === 0 &&
      v1Path.length &&
      v1Path[0][0] === pos[0] &&
      v1Path[0][1] === pos[1]
    ) {
      const waitState = `${posK}@${posTime + 1}`;
      if (!gScore.has(waitState)) {
        gScore.set(waitState, curG + 1);
        cameFrom.set(waitState, posState);
        openSet.push({
          pos: pos,
          f: curG + 1 + heuristic(pos, goal),
          time: posTime + 1,
        });
      }
      continue;
    }

    for (const nei of neighbors) {
      const nk = key(nei);
      const tentTime = posTime + 1;
      const neiState = `${nk}@${tentTime}`;
      const tentG = curG + 1;

      // --- prevent cycles ---
      let anc = posState,
        isAncestor = false;
      while (anc) {
        const p = cameFrom.get(anc);
        if (!p) break;
        if (p === neiState) {
          isAncestor = true;
          break;
        }
        anc = p;
      }
      if (isAncestor) continue;

      // --- BLOCK CHECK ---
      let blocked = false;

      // --- V1 node/edge head-on ±1 tick ---
      if (v1Path.length) {
        const idxBase = tentTime - v2DelayTicks - v1TimeOffset;
        for (let dt = -1; dt <= 1; dt++) {
          const idx = idxBase + dt;
          if (idx >= 0 && idx < v1Path.length) {
            const v1Pos = v1Path[idx];
            if (v1Pos?.[0] === nei[0] && v1Pos?.[1] === nei[1]) blocked = true;
            if (idx > 0) {
              const v1Prev = v1Path[idx - 1];
              if (v1Prev && v1Prev[0] === nei[0] && v1Prev[1] === nei[1])
                blocked = true;
              if (
                v1Prev &&
                v1Prev[0] === pos[0] &&
                v1Prev[1] === pos[1] &&
                v1Pos[0] === pos[0] &&
                v1Pos[1] === pos[1]
              )
                blocked = true;
            }
          }
        }
      }

      // --- reserved nodes/edges ---
      if (
        reservedNodes.has(`${nk}@${tentTime}`) ||
        reservedNodes.has(`${nk}@${tentTime - 1}`)
      )
        blocked = true;
      if (reservedEdges.has(`${posK}->${nk}@${tentTime}`)) blocked = true;
      if (reservedEdges.has(`${nk}->${posK}@${tentTime}`)) blocked = true;

      // --- prevent entering goal if V1 still there ---
      if (nk === key(goal) && v1Path.length) {
        const goalIdx = tentTime - v2DelayTicks - v1TimeOffset;
        if (goalIdx >= 0 && goalIdx < v1Path.length) {
          const v1AtGoal = v1Path[goalIdx];
          if (v1AtGoal[0] === goal[0] && v1AtGoal[1] === goal[1])
            blocked = true;
        }
      }

      // --- allow wait if neighbors blocked ---
      const freeNeighborExist = neighbors.some(
        (n) => !reservedNodes.has(`${key(n)}@${tentTime}`)
      );
      if (!blocked || (!freeNeighborExist && nk === posK)) {
        hasFreeNeighbor = true;
      }

      if (blocked) continue;

      // --- update g & openSet ---
      if (!gScore.has(neiState) || tentG < gScore.get(neiState)) {
        cameFrom.set(neiState, posState);
        gScore.set(neiState, tentG);
        const f = tentG + heuristic(nei, goal);
        const existing = openSet.find(
          (o) => key(o.pos) === nk && o.time === tentTime
        );
        if (existing) existing.f = f;
        else openSet.push({ pos: nei, f, time: tentTime });
      }
    }

    // --- always allow wait ---
    const waitState = `${posK}@${posTime + 1}`;
    if (!gScore.has(waitState) || !hasFreeNeighbor) {
      gScore.set(waitState, curG + 1);
      cameFrom.set(waitState, posState);
      openSet.push({
        pos: pos,
        f: curG + 1 + heuristic(pos, goal),
        time: posTime + 1,
      });
    }
  }

  return null;
}
