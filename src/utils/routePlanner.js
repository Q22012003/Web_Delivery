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

  const winnerPath = findSafePathWithReturn(
    winnerStart,
    winnerEnd,
    [],
    winnerDelay,
    [],
    0,
    winnerDelay,
    HOME
  );

  if (!winnerPath) return null;

  // ===== 3. RESERVE THEO WINNER =====
  const reserved = new Set();
  for (let t = 1; t < winnerPath.length; t++) {
    const p = winnerPath[t];
    reserved.add(`${p[0]},${p[1]}@${t}`);
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
