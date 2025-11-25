// src/utils/smartPathfinding.js
// ABSOLUTE FINAL – 26/11/2025 00:01
// V2 LUÔN CHẠY ĐƯỢC – DÙ V1 CHẶN CỠ NÀO ĐI NỮA

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

export function findSafePathWithReturn(start, goal, reservedTimes, timeOffset = 3) {
  if (!isValidCell(...start) || !isValidCell(...goal)) return null;

  const key = p => `${p[0]},${p[1]}`;

  // === TÌM ĐƯỜNG TỚI GOAL – BẮT BUỘC PHẢI CÓ ===
  let pathToGoal = null;
  
  // Thử nhiều lần với delay nhỏ để né V1 ở đoạn đầu
  for (let delay = 0; delay <= 12; delay += 2) {
    const delayedReserved = new Set();
    for (const r of reservedTimes) {
      const m = r.match(/(\d+,\d+)@(\d+)/);
      if (m) {
        const newT = +m[2] + delay;
        delayedReserved.add(`${m[1]}@${newT}`);
      }
    }
    
    const candidate = aStar(start, goal, delayedReserved, timeOffset + delay);
    if (candidate && candidate.length >= 2) {
      pathToGoal = candidate;
      timeOffset += delay;
      break;
    }
  }

  // NẾU VẪN KHÔNG TỚI ĐƯỢC → DÙ SAO CŨNG CHO CHẠY (để tránh block)
  if (!pathToGoal) {
    console.log("V2: Buộc phải chạy dù không an toàn – tránh deadlock");
    const fallback = aStar(start, goal, new Set(), timeOffset);
    if (fallback && fallback.length >= 2) {
      pathToGoal = fallback;
    } else {
      return null;
    }
  }

  const arrivalTime = timeOffset + pathToGoal.length - 1;

  // Reserve nhẹ
  const v2Reserved = new Set();
  for (let i = 1; i < pathToGoal.length - 1; i++) {
    v2Reserved.add(`${key(pathToGoal[i])}@${timeOffset + i}`);
  }
  for (let t = arrivalTime; t < arrivalTime + 10; t++) {
    v2Reserved.add(`${key(goal)}@${t}`);
  }

  // Tìm đường về (nếu được thì tốt)
  let returnPath = null;
  let wait = 0;
  for (wait = 0; wait <= 30; wait += 3) {
    const shifted = new Set();
    for (const r of [...reservedTimes, ...v2Reserved]) {
      const m = r.match(/(\d+,\d+)@(\d+)/);
      if (m) {
        const nt = +m[2] - wait;
        if (nt >= 0) shifted.add(`${m[1]}@${nt}`);
      }
    }
    const candidate = aStar(goal, start, shifted, arrivalTime + wait + 1);
    if (candidate && candidate.length >= 2) {
      returnPath = candidate;
      break;
    }
  }

  // XÂY ĐƯỜNG CUỐI
  const final = [...pathToGoal];
  if (returnPath) {
    if (wait > 0) final.push(...Array(wait).fill(goal));
    final.push(...returnPath.slice(1));
  }

  return final; // LUÔN TRẢ VỀ NẾU CÓ ĐƯỜNG TỚI GOAL
}

function aStar(start, goal, reserved, offset = 0) {
  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();
  const key = p => `${p[0]},${p[1]}`;

  gScore.set(key(start), 0);
  openSet.push({ pos: start, f: heuristic(start, goal) });

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const { pos } = openSet.shift();
    const k = key(pos);

    if (pos[0] === goal[0] && pos[1] === goal[1]) {
      const path = [];
      let node = pos;
      while (node) {
        path.unshift(node);
        node = cameFrom.get(key(node));
      }
      return path;
    }

    for (const nei of getNeighbors(pos)) {
      const nk = key(nei);
      const tentG = (gScore.get(k) || 0) + 1;
      const tentTime = offset + tentG;

      if (reserved.has(`${nk}@${tentTime}`) || reserved.has(`${nk}@${tentTime-1}`)) continue;

      if (!gScore.has(nk) || tentG < gScore.get(nk)) {
        cameFrom.set(nk, pos);
        gScore.set(nk, tentG);
        const f = tentG + heuristic(nei, goal);
        const existing = openSet.find(o => key(o.pos) === nk);
        if (existing) existing.f = f;
        else openSet.push({ pos: nei, f });
      }
    }
  }
  return null;
}