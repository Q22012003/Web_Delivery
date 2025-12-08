// ================== SMART PATHFINDING V2 - ONE WAY TRAFFIC EDITION ==================

// Đảm bảo tất cả các ô trong lưới 5x5 đều hợp lệ để xe có thể "quay đầu" sang làn khác
const validCells = new Set([
  "1,1", "1,2", "1,3", "1,4", "1,5",
  "2,1", "2,2", "2,3", "2,4", "2,5",
  "3,1", "3,2", "3,3", "3,4", "3,5",
  "4,1", "4,2", "4,3", "4,4", "4,5",
  "5,1", "5,2", "5,3", "5,4", "5,5",
]);

export function isValidCell(r, c) {
  return r >= 1 && r <= 5 && c >= 1 && c <= 5 && validCells.has(`${r},${c}`);
}

function heuristic(a, b) {
  // Manhattan distance
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/**
 * HÀM QUAN TRỌNG NHẤT: ĐỊNH NGHĨA LUẬT GIAO THÔNG
 * Giải pháp: Đường 1 chiều xen kẽ
 * - Cột lẻ (1, 3, 5): Chỉ được đi xuống (Row tăng: r + 1)
 * - Cột chẵn (2, 4): Chỉ được đi lên (Row giảm: r - 1)
 * - Hàng ngang: Đi thoải mái để chuyển làn
 */
function getNeighbors([r, c]) {
  const neighbors = [];
  
  // 1. Xử lý di chuyển Ngang (Trái/Phải) - Luôn cho phép để chuyển làn
  const horizontalMoves = [[0, 1], [0, -1]]; 
  
  // 2. Xử lý di chuyển Dọc (Lên/Xuống) - Tùy thuộc vào cột chẵn hay lẻ
  let verticalMove = [];
  
  if (c % 2 !== 0) {
    // CỘT LẺ (1, 3, 5): Đường 1 chiều đi TĂNG số dòng (1 -> 5)
    // Ví dụ: Từ 1.1 -> 2.1 là OK. Từ 2.1 -> 1.1 là CẤM.
    verticalMove = [[1, 0]]; 
  } else {
    // CỘT CHẴN (2, 4): Đường 1 chiều đi GIẢM số dòng (5 -> 1)
    // Ví dụ: Từ 5.2 -> 4.2 là OK. Từ 4.2 -> 5.2 là CẤM.
    verticalMove = [[-1, 0]];
  }

  // Gộp các hướng di chuyển hợp lệ
  const allowedDirs = [...horizontalMoves, ...verticalMove];

  for (const [dr, dc] of allowedDirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (isValidCell(nr, nc)) {
      neighbors.push([nr, nc]);
    }
  }

  return neighbors;
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
  // Chỉnh lại scale thời gian nếu cần, ở đây giữ nguyên logic của bạn
  const v1Offset = Math.round(v1StartTime / 100); 

  // --- PATH TO GOAL ---
  let pathToGoal = null,
    bestDelay = 0;
  
  // Tìm đường đi với delay tối ưu
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

  // --- RESERVE V2 PATH (Đánh dấu đường V2 sẽ đi để tính đường về) ---
  for (let i = 1; i < pathToGoal.length; i++) {
    const p = pathToGoal[i];
    const t = arrivalTime - (pathToGoal.length - 1) + i;
    baseReserved.add(`${key(p)}@${t}`);
    const prev = pathToGoal[i - 1];
    baseReserved.add(`${key(prev)}->${key(p)}@${t}`);
  }

  // --- RESERVE V1 NODES & EDGES (Tránh va chạm với V1) ---
  if (v1Path && v1Path.length) {
    for (let i = 0; i < v1Path.length; i++) {
      const p = v1Path[i];
      const t = i;
      for (let dt = -2; dt <= 2; dt++) { // Safety padding
        const ti = t + dt;
        if (ti >= 0) baseReserved.add(`${key(p)}@${ti}`);
      }
    }
    // Reserve edges của V1
    for (let i = 0; i < v1Path.length - 1; i++) {
        const from = v1Path[i], to = v1Path[i+1];
        const moveTime = i + 1;
        // Block edge ngược chiều để tránh đi xuyên qua nhau
        for(let dt = -1; dt <= 1; dt++){
             const ti = moveTime + dt;
             if(ti >= 0) baseReserved.add(`${key(to)}->${key(from)}@${ti}`);
        }
    }
  }

  // --- RETURN PATH (Tìm đường về) ---
  let returnPath = null;
  // Cho phép chờ tại điểm đích (Wait At Home) để tránh kẹt xe lúc quay đầu
  for (let waitAtHome = 0; waitAtHome <= 50; waitAtHome++) { // Giảm max wait xuống chút cho nhanh
    const shifted = shiftReserved(baseReserved, -waitAtHome);
    const candidate = aStar(
      goal,
      start,
      shifted,
      arrivalTime + waitAtHome + 2, // +2 ticks để xử lý quay đầu/delay
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
  const { nodes: reservedNodes, edges: reservedEdges } = parseReserved(reservedCombined);
  const openSet = [],
    cameFrom = new Map(),
    gScore = new Map();
  const key = (p) => `${p[0]},${p[1]}`;
  const closed = new Set(); // Closed set gồm {pos + time}

  const startState = `${key(start)}@${offset}`;
  gScore.set(startState, 0);
  // F = G + H. Chú ý: Time là 1 chiều trong đồ thị, không cộng vào chi phí G nhưng dùng để check va chạm
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
    
    // LẤY HÀNG XÓM THEO LUẬT 1 CHIỀU ĐÃ ĐỊNH NGHĨA
    const neighbors = getNeighbors(pos);
    let hasFreeNeighbor = false;

    // --- LOGIC ĐẶC BIỆT: NẾU V1 VẪN Ở START, BUỘC PHẢI CHỜ ---
    if (
      posTime === 0 &&
      v1Path.length &&
      v1Path[0][0] === pos[0] &&
      v1Path[0][1] === pos[1]
    ) {
       // Code giữ nguyên logic chờ
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
      const tentG = curG + 1; // Chi phí di chuyển là 1

      // --- prevent cycles in time-space ---
      // Kiểm tra xem node này đã nằm trong đường đi hiện tại chưa để tránh lặp
      let anc = posState, isAncestor = false;
      while (anc) {
        const p = cameFrom.get(anc);
        if (!p) break;
        if (p === neiState) { isAncestor = true; break; }
        anc = p;
      }
      if (isAncestor) continue;

      // --- BLOCK CHECK (KIỂM TRA VA CHẠM) ---
      let blocked = false;

      // 1. Check va chạm với V1 (Dynamic Obstacle)
      if (v1Path.length) {
        const idxBase = tentTime - v2DelayTicks - v1TimeOffset;
        for (let dt = -1; dt <= 1; dt++) { // Safety buffer +/- 1 tick
          const idx = idxBase + dt;
          if (idx >= 0 && idx < v1Path.length) {
            const v1Pos = v1Path[idx];
            // Va chạm tại node (2 xe cùng vào 1 ô)
            if (v1Pos?.[0] === nei[0] && v1Pos?.[1] === nei[1]) blocked = true;
            
            // Va chạm tráo đổi vị trí (Swap conflict: A->B vs B->A)
            if (idx > 0) {
              const v1Prev = v1Path[idx - 1];
              if (
                v1Prev &&
                v1Prev[0] === nei[0] && v1Prev[1] === nei[1] && // V1 cũ ở Nei
                v1Pos[0] === pos[0] && v1Pos[1] === pos[1]      // V1 mới ở Pos
              )
                blocked = true;
            }
          }
        }
      }

      // 2. Check Reserved Table (Các vùng đã bị đặt trước)
      if (
        reservedNodes.has(`${nk}@${tentTime}`) ||
        reservedNodes.has(`${nk}@${tentTime - 1}`) // Đợi người đi trước đi khỏi hẳn
      )
        blocked = true;
      
      // 3. Check Edge collision (Đi ngược chiều vào cạnh đã đặt)
      if (reservedEdges.has(`${posK}->${nk}@${tentTime}`)) blocked = true;
      if (reservedEdges.has(`${nk}->${posK}@${tentTime}`)) blocked = true;


      // --- Logic: Cho phép Wait nếu bị block ---
      const freeNeighborExist = neighbors.some(
        (n) => !reservedNodes.has(`${key(n)}@${tentTime}`)
      );
      if (!blocked || (!freeNeighborExist && nk === posK)) {
        hasFreeNeighbor = true;
      }

      if (blocked) continue;

      // --- CẬP NHẬT G & OPENSET ---
      if (!gScore.has(neiState) || tentG < gScore.get(neiState)) {
        cameFrom.set(neiState, posState);
        gScore.set(neiState, tentG);
        const f = tentG + heuristic(nei, goal);
        
        // Tìm xem node này đã có trong OpenSet chưa
        const existingIdx = openSet.findIndex(
          (o) => key(o.pos) === nk && o.time === tentTime
        );
        
        if (existingIdx !== -1) {
            if (openSet[existingIdx].f > f) {
                openSet[existingIdx].f = f;
                openSet[existingIdx].pos = nei; // Update
            }
        } else {
            openSet.push({ pos: nei, f, time: tentTime });
        }
      }
    }

    // --- ALWAYS ALLOW WAIT (ĐỨNG YÊN) ---
    // Xe có thể đứng yên tại chỗ (pos cũ) ở thời điểm tiếp theo (posTime + 1)
    const waitState = `${posK}@${posTime + 1}`;
    // Nếu chưa xét trạng thái chờ này HOẶC không có hàng xóm nào đi được (bị kẹt) -> Thêm Wait vào
    if (!gScore.has(waitState) || !hasFreeNeighbor) {
      gScore.set(waitState, curG + 1);
      cameFrom.set(waitState, posState);
      openSet.push({
        pos: pos,
        f: curG + 1 + heuristic(pos, goal), // Heuristic giữ nguyên
        time: posTime + 1,
      });
    }
  }

  return null;
}