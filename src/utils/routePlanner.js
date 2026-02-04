// src/utils/routePlanner.js
import { aStarSearch } from "./aStar";
import { findSafePathWithReturn } from "./smartPathfinding";
export { planTwoCarsRoute } from "./routePlanner_legacy_twoCars";
const HOME = [1, 1];
const PARKING_SPOTS = [
  [1, 1], // ưu tiên 1.1
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
];

const posKey = (p) => `${p[0]},${p[1]}`;
const nodeToken = (pos, t) => `${posKey(pos)}@${t}`;
const edgeToken = (from, to, t) => `${posKey(from)}->${posKey(to)}@${t}`;
const corridorToken = (cid, t) => `C:${cid}@${t}`;

// ===== corridorForMove copy theo smartPathfinding.js để reserve corridor giống logic cũ =====
function corridorForMove(from, to) {
  if (!from || !to) return null;
  const [r1, c1] = from;
  const [r2, c2] = to;

  // wait không khóa corridor
  if (r1 === r2 && c1 === c2) return null;

  if (r1 === 1 && r2 === 1) return "ROW1_1_5";
  if (r1 === 5 && r2 === 5) return "ROW5_1_5";
  if (c1 === 1 && c2 === 1 && r1 >= 2 && r2 >= 2) return "COL1_2_5";
  if (c1 === 5 && c2 === 5 && r1 >= 2 && r2 >= 2) return "COL5_2_5";

  const inMid = (r, c) => r >= 2 && r <= 4 && c >= 2 && c <= 4;
  if (inMid(r1, c1) && inMid(r2, c2)) {
    if (r1 === r2) return `MID_ROW${r1}_2_4`;
    if (c1 === c2) return `MID_COL${c1}_2_4`;
  }
  return null;
}

function reservePathAll(reserved, fullPath, timeOffset = 0, corridorWindow = 1) {
  if (!fullPath || fullPath.length < 2) return;

  for (let i = 1; i < fullPath.length; i++) {
    const from = fullPath[i - 1];
    const to = fullPath[i];
    const t = timeOffset + i;

    // node occupy (fix 90°)
    reserved.add(nodeToken(from, t));
    reserved.add(nodeToken(to, t));

    // edge occupy
    reserved.add(edgeToken(from, to, t));

    // corridor occupy (window)
    const cid = corridorForMove(from, to);
    if (cid) {
      for (let dt = -corridorWindow; dt <= corridorWindow; dt++) {
        const tt = t + dt;
        if (tt >= 0) reserved.add(corridorToken(cid, tt));
      }
    }
  }
}

function reserveDelayAtStart(reserved, startPos, delayTicks) {
  for (let t = 0; t <= delayTicks; t++) reserved.add(nodeToken(startPos, t));
}

// Giữ chỗ bến đỗ sau khi về (xe đứng yên) để xe sau không lao vào
function reserveHold(reserved, finalPos, fromTime, holdTicks = 80) {
  for (let t = fromTime; t <= fromTime + holdTicks; t++) reserved.add(nodeToken(finalPos, t));
}

function estimateETA(start, end, delayTicks) {
  const naive = aStarSearch(start, end, true, HOME);
  if (!naive || naive.length < 2) return Number.POSITIVE_INFINITY;
  return (naive.length - 1) + delayTicks;
}

function assignReturnTargetsByETA(vehicles) {
    // Yêu cầu của bạn:
    // - Xe có ETA về đích (goal) nhỏ nhất sẽ được ưu tiên về bến 1.1
    // - Các xe còn lại lần lượt về 1.2, 1.3, 1.4, 1.5
    // Lưu ý: ETA ở đây là ước lượng naive (A* đơn, chưa tính kẹt do reservation),
    // nhưng đủ để quyết định "winner" nhất quán theo logic bạn mô tả.
    const ranked = vehicles
      .map((v) => ({
        id: v.id,
        eta: estimateETA(v.startPos, v.endPos, v.delayTicks || 0),
      }))
      .sort((a, b) => a.eta - b.eta);
  
        const returnMap = {};
        const rankMap = {};
        ranked.forEach((x, idx) => {
          returnMap[x.id] = PARKING_SPOTS[Math.min(idx, PARKING_SPOTS.length - 1)];
          rankMap[x.id] = idx; // 0 = winner
        });
        return {
          ranked,
          returnMap,
          rankMap,
          winnerId: ranked[0]?.id || null,
        };
  }
  
function pickReturnTargetByPreference(preferredOrder, reserved, etaApprox) {
    // Chọn bến có “ít nguy cơ” nhất.
    // IMPORTANT FIX: Không chỉ check đúng 1 tick (etaApprox),
    // mà check cả một "window" vài tick sau đó vì hệ thống có reserveHold ở bến.
    const HOLD_WINDOW = 12;
  for (const spot of preferredOrder) {
        let ok = true;
        for (let dt = 0; dt <= HOLD_WINDOW; dt++) {
          if (reserved.has(nodeToken(spot, etaApprox + dt))) {
            ok = false;
            break;
          }
        }
        if (ok) return spot;
  }
  return preferredOrder[preferredOrder.length - 1];
}

/**
 * planMultiCarsRoute
 * vehicles: [{ id, startPos, endPos, delayTicks }]
 * tickSeconds: 1 tick = 1s (Home của bạn chạy interval 1000ms)
 */
export function planMultiCarsRoute({
  vehicles,
  baseDelayTicks = 4,
  baseDelayMs = 3500,
  maxCars = 5,
}) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return null;

  const list = vehicles.slice(0, maxCars).map((v, idx) => ({
    ...v,
    order: idx,
    delayTicks: idx === 0 ? 0 : (v.delayTicks ?? idx * baseDelayTicks),
    delayMs: idx === 0 ? 0 : (v.delayMs ?? idx * baseDelayMs),
  }));
    // Quyết định bến đỗ theo ETA (winner -> 1.1, các xe sau -> 1.2..1.5)
    const etaInfo = assignReturnTargetsByETA(list);
    const assignedReturnTargets = etaInfo.returnMap;
  
  // ưu tiên V1..Vn theo index (đúng yêu cầu)
  const reserved = new Set();
  const results = {};

  // reserve luôn “delay” của các xe đứng yên ở start (để xe trước không đi xuyên qua)
  for (const v of list) reserveDelayAtStart(reserved, v.startPos, v.delayTicks);

  // Lập kế hoạch lần lượt theo thứ tự (Prioritized Planning)
  for (const v of list) {
    const start = v.startPos;
    const goal = v.endPos;
    const timeOffset = v.delayTicks;

    // ước lượng ETA để chọn bến đỗ hợp lý (ưu tiên 1.1)
    const etaApprox = estimateETA(start, goal, timeOffset);

        // BẾN ĐỖ:
        // - assignedReturnTargets được quyết định theo ETA (winner -> 1.1)
        // - nhưng nếu bến đó "bị reserve quá nhiều" ở thời điểm ETA thì fallback sang bến kế tiếp.
        const assigned = assignedReturnTargets[v.id] || PARKING_SPOTS[0];
    
        // Ưu tiên: bến assigned trước, sau đó các bến còn lại
        const preferredReturn = [
          assigned,
          ...PARKING_SPOTS.filter((p) => posKey(p) !== posKey(assigned)),
        ];
    
        const chosenReturn = pickReturnTargetByPreference(preferredReturn, reserved, etaApprox);

    const fullPath = findSafePathWithReturn(
      start,
      goal,
      reserved,         // reservedTimes
      timeOffset,       // timeOffset
      [],               // otherPath (đã dồn vào reserved nên không cần)
      0,
      0,
      chosenReturn      // returnTarget
    );

    if (!fullPath || fullPath.length < 2) {
      return null; // fail toàn bộ nếu 1 xe không có đường an toàn
    }

    // reserve path theo timeline
    reservePathAll(reserved, fullPath, timeOffset, 1);

    // reserve “hold” tại bến đỗ
    const arrivalT = timeOffset + (fullPath.length - 1);
    const finalPos = fullPath[fullPath.length - 1];
    reserveHold(reserved, finalPos, arrivalT, 120);

    results[v.id] = {
      fullPath,
      delayMs: v.delayMs,
      delayTicks: v.delayTicks,
      returnTarget: finalPos,
      meta: {
              etaGoal: etaInfo.ranked.find((x) => x.id === v.id)?.eta ?? etaApprox,
              rank: etaInfo.rankMap?.[v.id] ?? 999,   // 0 = winner
              winnerId: etaInfo.winnerId,
              assignedReturn: assigned,
      },
    };
  }

  return results;
}

// ===== GIỮ LẠI API CŨ CHO 2 XE (không phá code cũ nếu bạn còn chỗ khác dùng) =====



// ================== PATH -> MCU COMMANDS ==================
// Quy ước heading (hướng) theo lưới:
// - 'S' : từ (r,c) -> (r+1,c)  (từ hàng 1 xuống hàng 5)  // theo mô tả của bạn: 1.1 đi "forward" lên 2.1
// - 'N' : (r-1,c)
// - 'E' : (r,c+1)
// - 'W' : (r,c-1)
//
// Lệnh MCU: FORWARD / LEFT / RIGHT / BACK / STOP
// BACK = quay 180° tại chỗ (KHÔNG chạy lùi). Sau đó có thể FORWARD tiếp để đi về ô phía sau theo hành lang.
//
// Mặc định: khi bắt đầu ở các điểm 1.x, xe đang hướng 'S' (hướng vào trong map).
const DEFAULT_HOME_HEADING = "S";

function dirBetween(a, b) {
  const [r1, c1] = a;
  const [r2, c2] = b;
  if (r2 === r1 + 1 && c2 === c1) return "S";
  if (r2 === r1 - 1 && c2 === c1) return "N";
  if (r2 === r1 && c2 === c1 + 1) return "E";
  if (r2 === r1 && c2 === c1 - 1) return "W";
  return null;
}

function turnNeeded(fromHeading, toHeading) {
  const order = ["N", "E", "S", "W"];
  const i = order.indexOf(fromHeading);
  const j = order.indexOf(toHeading);
  if (i === -1 || j === -1) return null;
  const diff = (j - i + 4) % 4;
  if (diff === 0) return [];
  if (diff === 1) return ["LEFT"];
  if (diff === 3) return ["RIGHT"];
  if (diff === 2) return ["BACK"]; // u-turn 180
  return null;
}

/**
 * Convert fullPath (list of [r,c]) -> MCU commands.
 * - startHeading: default 'S'
 * - normalizeAtEnd: nếu true, khi tới điểm cuối (1.x hoặc bãi đỗ), sẽ quay xe về hướng mặc định (S) để lần sau đi đúng.
 */
export function pathToMcuCommands(fullPath, opts = {}) {
  const startHeading = opts.startHeading || DEFAULT_HOME_HEADING;
  const normalizeAtEnd = opts.normalizeAtEnd ?? true;

  if (!Array.isArray(fullPath) || fullPath.length < 2) {
    return { commands: [], finalHeading: startHeading };
  }

  let heading = startHeading;
  const cmds = [];

  for (let i = 0; i < fullPath.length - 1; i++) {
    const a = fullPath[i];
    const b = fullPath[i + 1];
    const need = dirBetween(a, b);
    if (!need) continue;

    const turns = turnNeeded(heading, need);
    if (turns && turns.length) cmds.push(...turns);
    heading = need;

    // Sau khi đã quay đúng hướng, đi tới node kế tiếp
    cmds.push("FORWARD");
  }

  // Normalize heading khi về bến (row 1) để lần sau "FORWARD" sẽ đi vào trong map
  if (normalizeAtEnd) {
    const end = fullPath[fullPath.length - 1];
    const isRow1Parking = end[0] === 1 && end[1] >= 1 && end[1] <= 5;
    if (isRow1Parking && heading !== DEFAULT_HOME_HEADING) {
      const turns = turnNeeded(heading, DEFAULT_HOME_HEADING);
      if (turns && turns.length) cmds.push(...turns);
      heading = DEFAULT_HOME_HEADING;
    }
    // luôn stop cuối
    cmds.push("STOP");
  }

  return { commands: cmds, finalHeading: heading };
}
