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

function pickReturnTargetByPreference(preferredOrder, reserved, etaApprox) {
  // Chọn bến có “ít nguy cơ” nhất: thử lần lượt 1.1 -> 1.2 -> ...,
  // kiểm tra xem tại thời điểm etaApprox nó có bị reserve không.
  for (const spot of preferredOrder) {
    const tok = nodeToken(spot, etaApprox);
    if (!reserved.has(tok)) return spot;
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

    // thử return target theo ưu tiên (1.1 trước)
    const preferredReturn = PARKING_SPOTS;
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
    };
  }

  return results;
}

// ===== GIỮ LẠI API CŨ CHO 2 XE (không phá code cũ nếu bạn còn chỗ khác dùng) =====

