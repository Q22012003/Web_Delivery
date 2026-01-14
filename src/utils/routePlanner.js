import { aStarSearch } from "./aStar";
import { findSafePathWithReturn } from "./smartPathfinding";

const HOME = [1, 1];
const PARKING_SPOTS = [
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
];

const samePos = (a, b) => a[0] === b[0] && a[1] === b[1];
const posKey = (p) => `${p[0]},${p[1]}`;

const makeDelayReserved = (pos, delayTicks) => {
  const s = new Set();
  for (let t = 0; t <= delayTicks; t++) {
    s.add(`${posKey(pos)}@${t}`);
  }
  return s;
};
export function planTwoCarsRoute({
  v1Start,
  v2Start,
  v1End,
  v2End,
  v2DelayMs = 3500,
  v2DelayTicks = 4,
}) {
  // ===== 1. TÍNH AI VỀ 1.1 TRƯỚC (naive) =====
  const v1Naive = aStarSearch(v1Start, v1End, true, HOME);
  const v2Naive = aStarSearch(v2Start, v2End, true, HOME);

  if (!v1Naive || !v2Naive) return null;

  const v1ETA = v1Naive.length - 1;
  const v2ETA = (v2Naive.length - 1) + v2DelayTicks;

  const winner = v2ETA < v1ETA ? "V2" : "V1";
  const loser = winner === "V1" ? "V2" : "V1";

  // ===== 2. PLAN WINNER =====
  const winnerStart = winner === "V1" ? v1Start : v2Start;
  const winnerEnd = winner === "V1" ? v1End : v2End;
  const winnerDelay = winner === "V2" ? v2DelayTicks : 0;

// ===== khóa vị trí V2 trong lúc delay (để V1 không đi xuyên qua xe đứng yên) =====
// Lưu ý: V2 luôn là xe có delay trong hệ thống của bạn
const delayReserved = makeDelayReserved(v2Start, v2DelayTicks);

// ===== 2. PLAN WINNER =====
// const winnerStart = winner === "V1" ? v1Start : v2Start;
// const winnerEnd = winner === "V1" ? v1End : v2End;
// const winnerDelay = winner === "V2" ? v2DelayTicks : 0;

// Nếu winner là V1: cần né xe V2 đang đứng yên => truyền delayReserved vào reservedTimes
// Nếu winner là V2: delayReserved vẫn ok (không gây hại) nhưng không bắt buộc
const winnerReservedTimes = winner === "V1" ? delayReserved : new Set();

const winnerPath = findSafePathWithReturn(
  winnerStart,
  winnerEnd,
  winnerReservedTimes,
  winnerDelay,   // timeOffset
  [],
  0,
  winnerDelay,
  HOME
);

if (!winnerPath) return null;

// ===== 3. RESERVE THEO WINNER (PHẢI CỘNG OFFSET THỜI GIAN) =====
const reserved = new Set();

// luôn giữ lại delayReserved để LOSER cũng không đi xuyên qua xe đang đứng yên
for (const tok of delayReserved) reserved.add(tok);

// reserve đường winner theo đúng timeline: time = winnerDelay + t
for (let t = 1; t < winnerPath.length; t++) {
  const from = winnerPath[t - 1];
  const to = winnerPath[t];
  const tt = winnerDelay + t;

  // occupy current cell while moving out (prevents perpendicular/side-swipe at corners)
  reserved.add(`${from[0]},${from[1]}@${tt}`);

  // occupy destination cell
  reserved.add(`${to[0]},${to[1]}@${tt}`);

  // prevent crossing/partial overlap during the move
  reserved.add(`${from[0]},${from[1]}->${to[0]},${to[1]}@${tt}`);
}

  // ===== 4. PLAN LOSER (KHÔNG VỀ 1.1) =====
  const loserStart = loser === "V1" ? v1Start : v2Start;
  const loserEnd = loser === "V1" ? v1End : v2End;
  const loserDelay = loser === "V2" ? v2DelayTicks : 0;

  let loserPath = null;
  for (const park of PARKING_SPOTS) {
    if (samePos(park, HOME)) continue;

    const candidate = findSafePathWithReturn(
      loserStart,
      loserEnd,
      reserved,
      loserDelay,
      winnerPath,
      0,
      loserDelay,
      park
    );

    if (candidate) {
      loserPath = candidate;
      break;
    }
  }

  if (!loserPath) return null;

  return {
    V1: {
      fullPath: winner === "V1" ? winnerPath : loserPath,
      delayMs: 0,
    },
    V2: {
      fullPath: winner === "V2" ? winnerPath : loserPath,
      delayMs: v2DelayMs,
    },
  };
}
