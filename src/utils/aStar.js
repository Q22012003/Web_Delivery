// src/utils/aStar.js – PHIÊN BẢN HOÀN HẢO, ĐỒNG BỘ VỚI smartPathfinding.js
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

// Normalize blocked/deadzone input into a Set of "r,c" strings.
// Accepts:
// - Set/Array of strings ("2,1" / "2.1")
// - Set/Array of positions ([2,1])
// - Object position ({row,col}/{r,c})
// - Object map ({"2,1": true})
function normalizeBlocked(blockedCells) {
  const out = new Set();
  if (!blockedCells) return out;

  const add = (r, c) => {
    const rr = Number(r);
    const cc = Number(c);
    if (Number.isFinite(rr) && Number.isFinite(cc)) out.add(`${rr},${cc}`);
  };

  const addAny = (v) => {
    if (v == null) return;
    if (typeof v === "string") {
      const m = v.trim().match(/(\d+)\D+(\d+)/);
      if (m) add(m[1], m[2]);
      return;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      // numeric shorthand like 5.1
      const r = Math.floor(v);
      const c = Math.round((v - r) * 10);
      add(r, c);
      return;
    }
    if (Array.isArray(v) && v.length >= 2) {
      add(v[0], v[1]);
      return;
    }
    if (typeof v === "object") {
      // object map form: {"2,1": true}
      const keys = Object.keys(v);
      if (keys.length && keys.every((k) => typeof k === "string")) {
        keys.forEach((k) => {
          if (v[k]) addAny(k);
        });
        return;
      }

      // object position form: {r,c} or {row,col}
      const r = v.r ?? v.row;
      const c = v.c ?? v.col;
      if (r != null && c != null) add(r, c);
    }
  };

  if (blockedCells instanceof Set) {
    for (const v of blockedCells) addAny(v);
    return out;
  }
  if (Array.isArray(blockedCells)) {
    blockedCells.forEach(addAny);
    return out;
  }

  addAny(blockedCells);
  return out;
}

function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function getNeighbors(pos, blockedSet) {
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
    if (isValidCell(nr, nc) && !blockedSet?.has(`${nr},${nc}`)) neighbors.push([nr, nc]);
  }
  return neighbors;
}

// aStarSearch: nếu returnToStart=true thì mặc định quay về start.
// Nếu muốn quay về một điểm khác (ví dụ bến đỗ 1,2..1,5), truyền returnTarget.
// blockedCells: static obstacles (deadzone). Accepts Set/Array/etc (see normalizeBlocked).
export function aStarSearch(start, goal, returnToStart = true, returnTarget = null, blockedCells = null) {
  const blocked = normalizeBlocked(blockedCells);
  const key = (pos) => `${pos[0]},${pos[1]}`;

  if (!isValidCell(start[0], start[1]) || !isValidCell(goal[0], goal[1])) {
    return [];
  }

  // Deadzone blocks
  if (blocked.has(key(start)) || blocked.has(key(goal))) return [];

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

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
        const target = returnTarget || start;
        const returnPath = aStarSearch(goal, target, false, null, blocked);
        return returnPath.length > 1 ? path.concat(returnPath.slice(1)) : path;
      }
      return path;
    }

    for (const neighbor of getNeighbors(current, blocked)) {
      const nKey = key(neighbor);
      const tentativeG = (gScore.get(currentKey) || 0) + 1;

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
  return [];
}
