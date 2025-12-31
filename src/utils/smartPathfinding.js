// src/utils/smartPathfinding.js
// ================== SMART PATHFINDING (CORRIDOR-LOCK) ==================

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

function key(pos) {
  return `${pos[0]},${pos[1]}`;
}

function nodeToken(pos, t) {
  return `${key(pos)}@${t}`;
}

function edgeToken(from, to, t) {
  return `${key(from)}->${key(to)}@${t}`;
}

function corridorToken(corridorId, t) {
  return `C:${corridorId}@${t}`;
}

/**
 * ================== CORRIDOR DEFINITIONS ==================
 * Bạn muốn “cấm dùng chung corridor”.
 *
 * Với map 5x5 của bạn, mình định nghĩa corridor theo các hành lang thẳng chính:
 *  - ROW1_1_5: hàng 1 (1.1..1.5)
 *  - ROW5_1_5: hàng 5 (5.1..5.5)
 *  - COL1_2_5: cột 1 từ 2.1..5.1 (đúng ví dụ bạn nêu)
 *  - COL5_2_5: cột 5 từ 2.5..5.5
 *  - MID_ROW{2|3|4}_2_4: hàng 2/3/4 trong vùng giữa (cột 2..4)
 *  - MID_COL{2|3|4}_2_4: cột 2/3/4 trong vùng giữa (hàng 2..4)
 *
 * Khi xe đi một bước (from->to), nếu bước đó nằm trên corridor nào thì sẽ khóa corridor đó theo tick.
 */
function corridorForMove(from, to) {
  if (!from || !to) return null;
  const [r1, c1] = from;
  const [r2, c2] = to;

  // wait (đứng yên) không khóa corridor
  if (r1 === r2 && c1 === c2) return null;

  // ROW1: 1.1..1.5
  if (r1 === 1 && r2 === 1) return "ROW1_1_5";

  // ROW5: 5.1..5.5
  if (r1 === 5 && r2 === 5) return "ROW5_1_5";

  // COL1: 2.1..5.1 (đúng yêu cầu ví dụ corridor 2.1→5.1)
  if (c1 === 1 && c2 === 1 && r1 >= 2 && r2 >= 2) return "COL1_2_5";

  // COL5: 2.5..5.5
  if (c1 === 5 && c2 === 5 && r1 >= 2 && r2 >= 2) return "COL5_2_5";

  // MID area rows 2..4 cols 2..4
  const inMid = (r, c) => r >= 2 && r <= 4 && c >= 2 && c <= 4;

  if (inMid(r1, c1) && inMid(r2, c2)) {
    // mid row corridor
    if (r1 === r2) return `MID_ROW${r1}_2_4`;
    // mid col corridor
    if (c1 === c2) return `MID_COL${c1}_2_4`;
  }

  return null;
}

function parseReserved(setIn) {
  const nodes = new Set();
  const edges = new Set();
  const corridors = new Set();

  for (const token of setIn || []) {
    if (token.startsWith("C:")) corridors.add(token);
    else if (token.includes("->")) edges.add(token);
    else nodes.add(token);
  }
  return { nodes, edges, corridors };
}

function isBlocked(reservedParsed, from, to, t) {
  // node collision at time t (occupy "to" at time t)
  if (reservedParsed.nodes.has(nodeToken(to, t))) return true;

  // edge collision (swap head-on): other uses (to->from) at time t
  if (reservedParsed.edges.has(edgeToken(to, from, t))) return true;

  // corridor collision: nếu bước này thuộc corridor nào thì corridor đó không được bị chiếm ở tick t
  const cid = corridorForMove(from, to);
  if (cid && reservedParsed.corridors.has(corridorToken(cid, t))) return true;

  return false;
}

// A* in time-expanded graph (pos + time)
function aStar(start, goal, reservedSet, startTime = 0, otherPath = [], otherStartTime = 0) {
  const reserved = parseReserved(reservedSet);

  const open = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  const stateKey = (pos, t) => `${key(pos)}@${t}`;
  const startState = stateKey(start, startTime);

  gScore.set(startState, 0);
  fScore.set(startState, heuristic(start, goal));
  open.push({ pos: start, t: startTime, f: fScore.get(startState) });

  const maxTime = 450;

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const curKey = stateKey(current.pos, current.t);

    if (current.pos[0] === goal[0] && current.pos[1] === goal[1]) {
      const path = [];
      let cur = current;
      while (cur) {
        path.unshift(cur.pos);
        const prev = cameFrom.get(stateKey(cur.pos, cur.t));
        cur = prev || null;
      }
      return path;
    }

    if (current.t - startTime > maxTime) continue;

    const candidates = [...getNeighbors(current.pos), current.pos]; // + wait
    for (const nextPos of candidates) {
      const nextT = current.t + 1;

      // 1) reserved checks (node/edge/corridor)
      if (isBlocked(reserved, current.pos, nextPos, nextT)) continue;

      // 2) also avoid being on same node as otherPath at same time (extra safety)
      const relT = nextT - otherStartTime;
      if (otherPath && otherPath.length > 0 && relT >= 0 && relT < otherPath.length) {
        const otherPos = otherPath[relT];
        if (otherPos && otherPos[0] === nextPos[0] && otherPos[1] === nextPos[1]) continue;

        // head-on swap vs otherPath
        const prevRelT = relT - 1;
        if (prevRelT >= 0 && prevRelT < otherPath.length) {
          const otherPrev = otherPath[prevRelT];
          if (
            otherPrev &&
            otherPrev[0] === nextPos[0] &&
            otherPrev[1] === nextPos[1] &&
            otherPos &&
            otherPos[0] === current.pos[0] &&
            otherPos[1] === current.pos[1]
          ) {
            continue;
          }
        }
      }

      const nextState = stateKey(nextPos, nextT);
      const tentativeG = (gScore.get(curKey) || 0) + 1;

      if (!gScore.has(nextState) || tentativeG < gScore.get(nextState)) {
        cameFrom.set(nextState, { pos: current.pos, t: current.t });
        gScore.set(nextState, tentativeG);
        const f = tentativeG + heuristic(nextPos, goal);
        fScore.set(nextState, f);

        if (!open.some((n) => n.t === nextT && n.pos[0] === nextPos[0] && n.pos[1] === nextPos[1])) {
          open.push({ pos: nextPos, t: nextT, f });
        }
      }
    }
  }

  return null;
}

function shiftReserved(reservedSet, deltaT) {
  const out = new Set();

  for (const token of reservedSet || []) {
    // Corridor token: C:<id>@t
    if (token.startsWith("C:")) {
      const [cPart, tPart] = token.split("@");
      const t = parseInt(tPart, 10);
      const nt = t + deltaT;
      if (Number.isFinite(nt) && nt >= 0) out.add(`${cPart}@${nt}`);
      continue;
    }

    // Edge token
    if (token.includes("->")) {
      const [edgePart, tPart] = token.split("@");
      const t = parseInt(tPart, 10);
      const nt = t + deltaT;
      if (Number.isFinite(nt) && nt >= 0) out.add(`${edgePart}@${nt}`);
      continue;
    }

    // Node token
    const [posPart, tPart] = token.split("@");
    const t = parseInt(tPart, 10);
    const nt = t + deltaT;
    if (Number.isFinite(nt) && nt >= 0) out.add(`${posPart}@${nt}`);
  }

  return out;
}

function reservePathAll(baseReserved, pathFull, timeOffset = 0, corridorWindow = 0) {
  if (!pathFull || pathFull.length < 2) return;

  // reserve nodes + edges + corridors per tick
  for (let i = 1; i < pathFull.length; i++) {
    const from = pathFull[i - 1];
    const to = pathFull[i];
    const t = timeOffset + i;

    baseReserved.add(nodeToken(to, t));
    baseReserved.add(edgeToken(from, to, t));

    const cid = corridorForMove(from, to);
    if (cid) {
      // window = 0: chỉ khóa đúng tick di chuyển
      // window > 0: khóa thêm ±window tick (cực an toàn, tránh sát nút)
      for (let dt = -corridorWindow; dt <= corridorWindow; dt++) {
        const tt = t + dt;
        if (tt >= 0) baseReserved.add(corridorToken(cid, tt));
      }
    }
  }
}

// MAIN API
// returnTarget: nếu muốn xe về bến đỗ khác start (vd 1.2..1.5) thì truyền returnTarget
export function findSafePathWithReturn(
  start,
  goal,
  reservedTimes,
  timeOffset = 0,
  otherPath = [],
  otherStartTime = 0,
  v2DelayTicks = 0,
  returnTarget = null
) {
  if (!isValidCell(start[0], start[1]) || !isValidCell(goal[0], goal[1])) return null;

  const baseReserved = new Set(reservedTimes || []);

  // Reserve otherPath into baseReserved (node+edge+corridor) để path mới né toàn diện
  if (otherPath && otherPath.length > 1) {
    reservePathAll(baseReserved, otherPath, 0, 0); // corridorWindow=1 cho chắc
  }

  // --- TO GOAL ---
  const pathToGoal = aStar(start, goal, baseReserved, timeOffset, otherPath, otherStartTime);
  if (!pathToGoal || pathToGoal.length < 2) return null;

  const arrivalTime = timeOffset + (pathToGoal.length - 1);

  // reserve chính pathToGoal của mình để đoạn return không tự đụng + để shift/wait ổn định
  reservePathAll(baseReserved, pathToGoal, timeOffset, 1);

  // --- RETURN PATH ---
  const backTarget = returnTarget || start;
  let returnPath = null;

  for (let wait = 0; wait <= 220; wait++) {
    // shiftReserved giúp “dời” các reserved theo wait để tìm đường return an toàn hơn
    const shifted = shiftReserved(baseReserved, -wait);
    const candidate = aStar(
      goal,
      backTarget,
      shifted,
      arrivalTime + wait + 2,
      otherPath,
      otherStartTime
    );

    if (candidate && candidate.length >= 2) {
      returnPath = candidate;
      break;
    }
  }

  if (!returnPath) return null;

  return [...pathToGoal, ...returnPath.slice(1)];
}
