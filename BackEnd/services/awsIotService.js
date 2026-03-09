// services/awsIotService.js (MULTI-VEHICLE)
console.log("--> awsIotService loaded (Multi-vehicle topics: car/V1/*, car/V2/*)");

const { buildConnection } = require("../config/awsIotConfig.js");
const mqtt = require("aws-iot-device-sdk-v2").mqtt;
const { TextDecoder } = require("util");

let connection = null;

// Thời gian thực tế xe đi 1 ô (ước lượng). Dùng để HOLD đủ lâu, tránh spam HOLD_DONE.
// Có thể chỉnh bằng env WAIT_TICK_MS (ms).
const WAIT_TICK_MS = Number(process.env.WAIT_TICK_MS || 7500);

// HOLD tối thiểu (ms) nếu bị block
const MIN_HOLD_MS = Number(process.env.MIN_HOLD_MS || 1200);

// ====== topic map đúng theo MCU ======
const TOPICS = {
  V1: { pubCmd: "car/V1/command", subPos: "car/V1/matrix_position" },
  V2: { pubCmd: "car/V2/command", subPos: "car/V2/matrix_position" },
};

// ====== occupancy (source-of-truth = last ACK node từ MCU) ======
const occupancy = {}; // { "r,c": "V1" | "V2" }

// Chuẩn hoá mọi input vị trí về "r,c" (đề phòng client gửi "r.c" hoặc có spaces)
const normPos = (p) => String(p ?? "").trim().replace(/\./g, ",");

// ===== helpers for batch + ghost-occupancy cleanup =====
const getBatchId = (s) => (s?.batchId ?? s?.meta?.batchId ?? null);

// Xoá mọi occupancy cũ của 1 xe (tránh ghost node bị chiếm do session/ACK cũ)
const clearVehicleOccupancy = (vehicleId) => {
  for (const k of Object.keys(occupancy)) {
    if (occupancy[k] === vehicleId) delete occupancy[k];
  }
};

// ===== step-gate: delay start theo "lead steps" (tick = số bước của xe lead) =====
// batchGate[batchId] = { leadId, leadSteps, waiting: { [vehicleId]: requiredLeadSteps } }
const batchGate = Object.create(null);

const getGate = (batchId) => {
  if (!batchId) return null;
  if (!batchGate[batchId]) batchGate[batchId] = { leadId: null, leadSteps: 0, waiting: Object.create(null) };
  return batchGate[batchId];
};

const inferLeadIdForBatch = (batchId) => {
  const ids = Object.keys(sessions).filter(
    (id) => getBatchId(sessions[id]) && String(getBatchId(sessions[id])) === String(batchId)
  );
  if (ids.length === 0) return null;
  let best = ids[0];
  for (const id of ids) {
    if (getEffectiveRank(id) < getEffectiveRank(best)) best = id;
  }
  return best;
};

// ====== session state theo xe ======
const sessions = {
  V1: { pathQueue: [], isNavigating: false, lastPosition: null, prevPosition: null, meta: null, lastVector: { x: 0, y: 1 }, currentTarget: null, waiting: false, waitToken: 0 },
  V2: { pathQueue: [], isNavigating: false, lastPosition: null, prevPosition: null, meta: null, lastVector: { x: 0, y: 1 }, currentTarget: null, waiting: false, waitToken: 0 },
};

// throttle spam position khi xe đứng yên
const EMIT_SAME_POS_MS = Number(process.env.EMIT_SAME_POS_MS || 1000);
Object.keys(sessions).forEach((vid) => {
  sessions[vid].lastEmitPos = null;
  sessions[vid].lastEmitAt = 0;
});

const emitToFrontend = (event, data) => {
  if (global.io) global.io.emit(event, data);
};

const publishToCar = (topic, payloadObj) => {
  if (!connection) {
    console.log("[WARN] publishToCar: connection null");
    return;
  }
  const payload = JSON.stringify(payloadObj);
  connection.publish(topic, payload, mqtt.QoS.AtLeastOnce);
};

// Expose a safe helper for REST/socket layer to send a direct command to a specific car
const sendCommandToCar = (vehicleId, payloadObj) => {
  const topic = TOPICS?.[vehicleId]?.pubCmd;
  if (!topic) throw new Error(`Unknown vehicleId: ${vehicleId}`);
  publishToCar(topic, payloadObj);
};

// ====== heading/direction ======
const getDirection = (session, currentStr, targetStr) => {
  const [r1, c1] = String(currentStr).split(",").map(Number);
  const [r2, c2] = String(targetStr).split(",").map(Number);
  const dr = r2 - r1;
  const dc = c2 - c1;

  // nếu đứng yên (WAIT)
  if (dr === 0 && dc === 0) return "HOLD";

  // IMPORTANT: In this project, row+ is treated as "north/forward" and col+ is "east/right".
  // Use a right-handed vector (x=dc, y=dr) so clockwise rotation corresponds to RIGHT.
  const next = { x: dc, y: dr };

  // vector hiện tại của xe (để suy ra LEFT/RIGHT/BACK)
  const cur = session.lastVector || { x: 0, y: 1 }; // default heading: "north" (dr+)

  const same = cur.x === next.x && cur.y === next.y;
  if (same) {
    session.lastVector = next;
    return "FORWARD";
  }

  // RIGHT (clockwise): (x,y) -> (y,-x)
  if (next.x === cur.y && next.y === -cur.x) {
    session.lastVector = next;
    return "RIGHT";
  }

  // LEFT (counter-clockwise): (x,y) -> (-y,x)
  if (next.x === -cur.y && next.y === cur.x) {
    session.lastVector = next;
    return "LEFT";
  }

  // BACK: đảo vector
  if (next.x === -cur.x && next.y === -cur.y) {
    session.lastVector = next;
    return "BACK";
  }

  // fallback
  session.lastVector = next;
  return "FORWARD";
};

// ====== ETA priority (đồng bộ với Home.jsx) ======
const comparePriority = (aId, bId) => {
  const a = sessions[aId];
  const b = sessions[bId];
  const ea = typeof a?.etaGoalTicks === "number" ? a.etaGoalTicks : Number.POSITIVE_INFINITY;
  const eb = typeof b?.etaGoalTicks === "number" ? b.etaGoalTicks : Number.POSITIVE_INFINITY;

  if (ea !== eb) return ea - eb;
  return String(aId).localeCompare(String(bId));
};

const recomputePriorityRanks = () => {
  // Tính winner/loser ổn định theo ETA (etaGoalTicks) hoặc meta.rank (0=winner).
  // Không phụ thuộc batchId để tránh trường hợp rank=99 và đổi vai gây HOLD luân phiên.
  const active = Object.keys(sessions).filter((vid) => {
    const s = sessions[vid];
    if (!s?.isNavigating) return false;
    const hasEta = typeof s?.etaGoalTicks === "number" && Number.isFinite(s.etaGoalTicks);
    const hasMetaRank = Number.isFinite(s?.meta?.rank);
    return hasEta || hasMetaRank;
  });

  if (active.length === 0) return;

  active.sort((aId, bId) => {
    const a = sessions[aId];
    const b = sessions[bId];

    // Ưu tiên meta.rank (0=winner) nếu có, vì đây là kết quả đồng bộ từ UI/Home.jsx.
    const ar = Number.isFinite(a?.meta?.rank) ? Number(a.meta.rank) : null;
    const br = Number.isFinite(b?.meta?.rank) ? Number(b.meta.rank) : null;
    if (ar != null && br != null && ar !== br) return ar - br;

    const ea = typeof a?.etaGoalTicks === "number" ? a.etaGoalTicks : Number.POSITIVE_INFINITY;
    const eb = typeof b?.etaGoalTicks === "number" ? b.etaGoalTicks : Number.POSITIVE_INFINITY;
    if (ea !== eb) return ea - eb;

    // tie-break ổn định theo vehicleId
    return String(aId).localeCompare(String(bId));
  });

  active.forEach((vid, idx) => {
    sessions[vid].priorityRank = idx + 1; // 1 = winner
  });
};

// ====== collision / block checking ======
const getOtherIds = (vehicleId) => Object.keys(sessions).filter((x) => x !== vehicleId);

const getRank = (vehicleId) => {
  const s = sessions[vehicleId];
  const r = s?.meta?.rank;
  if (Number.isFinite(r)) return Number(r);
  // fallback: V1 < V2 < V3...
  const n = Number(String(vehicleId).replace("V", ""));
  return Number.isFinite(n) ? (n - 1) : 999;
};

const getIntentTarget = (vehicleId) => {
  const s = sessions[vehicleId];
  if (!s || !s.isNavigating) return null;
  // Khi đang HOLD hoặc đang bị gate (delay start), không reserve node kế tiếp
  if (s.waiting || s.gated) return null;
  return s.currentTarget || (s.pathQueue.length > 0 ? String(s.pathQueue[0]) : null);
};

const isFreeNode = (pos, excludeVehicleId = null) => {
  if (occupancy[pos] && occupancy[pos] !== excludeVehicleId) return false;
  for (const vid of Object.keys(sessions)) {
    if (vid === excludeVehicleId) continue;
    const intent = getIntentTarget(vid);
    if (intent && String(intent) === String(pos)) return false;
  }
  return true;
};

const neighbors4 = (pos) => {
  const [r, c] = String(pos).split(",").map(Number);
  const cand = [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  return cand
    .filter(([rr, cc]) => rr >= 1 && rr <= 5 && cc >= 1 && cc <= 5)
    .map(([rr, cc]) => `${rr},${cc}`);
};

const checkBlocked = (vehicleId, fromPos, toPos) => {
  const self = sessions[vehicleId];
  const selfBatch = getBatchId(self);

  // 1) Node occupied (source-of-truth = occupancy từ ACK/override)
  // IMPORTANT: không return sớm ở đây, vì nếu là tình huống "swap head-on" thì cần nhận diện để phá deadlock.
  const occ = occupancy[toPos] && occupancy[toPos] !== vehicleId ? occupancy[toPos] : null;

  for (const otherId of getOtherIds(vehicleId)) {
    const other = sessions[otherId];
    if (!other || !other.isNavigating) continue;

    // khác batch => bỏ qua intent/swap (tránh ghost session)
    const otherBatch = getBatchId(other);
    const batchMismatch =
      selfBatch != null && otherBatch != null && String(selfBatch) !== String(otherBatch);
    if (batchMismatch) continue;

    const otherPos = other.lastPosition;

    // Intent "mềm" (khi xe đang HOLD/gated thì getIntentTarget sẽ trả null để không reserve node kế tiếp)
    const otherIntent = getIntentTarget(otherId);

    // Next "cứng" để phát hiện swap ngay cả khi xe kia đang HOLD (waiting=true).
    // - gated => chưa được phép chạy => không tính next
    // - waiting => vẫn có thể đang "muốn" đi tới pathQueue[0] sau khi HOLD_DONE
    const otherNext = other?.gated
      ? null
      : (other.currentTarget || (other.pathQueue && other.pathQueue.length > 0 ? String(other.pathQueue[0]) : null));

    // 2) SWAP head-on
    if (otherPos && String(otherPos) === String(toPos) && otherNext && String(otherNext) === String(fromPos)) {
      return {
        blocked: true,
        kind: "swap",
        blockerId: otherId,
        reason: `swap with ${otherId} (${toPos}<->${fromPos})`,
      };
    }

    // 3) Reserve / intent (cùng batch)
    if (otherIntent && String(otherIntent) === String(toPos)) {
      return {
        blocked: true,
        kind: "reserve",
        blockerId: otherId,
        reason: `reserved by ${otherId} -> ${otherIntent} (to=${toPos})`,
      };
    }
  }

  // 4) Nếu không phải swap/reserve nhưng node đang bị chiếm -> block node
  if (occ) {
    return {
      blocked: true,
      kind: "node",
      blockerId: occ,
      reason: `node occupied by ${occ} (to=${toPos})`,
    };
  }

  return { blocked: false, kind: "", blockerId: null, reason: "" };
};

// Rank dùng cho quyết định "nhường đường":
// - priorityRank (tính từ ETA/meta) nếu có
// - fallback meta.rank (0=winner)
// - fallback theo vehicleId
const getEffectiveRank = (vehicleId) => {
  const s = sessions[vehicleId];
  if (!s) return 999;
  if (Number.isFinite(s.priorityRank)) return Number(s.priorityRank); // 1=winner
  if (Number.isFinite(s?.meta?.rank)) return Number(s.meta.rank) + 1; // 0=winner -> 1
  const n = Number(String(vehicleId).replace("V", ""));
  return Number.isFinite(n) ? n : 999;
};

// Loser "nhường đường": ưu tiên lùi về prevPosition; nếu không được thì né sang ô trống cạnh bên.
// Kỹ thuật: chèn lại node hiện tại vào đầu queue để sau khi né/lùi xong sẽ quay lại tiếp tục.
const tryYieldMove = (vehicleId) => {
  const s = sessions[vehicleId];
  if (!s?.lastPosition) return false;

  const cur = String(s.lastPosition);
  const prev = s.prevPosition ? String(s.prevPosition) : null;

  const canStepTo = (toPos) => {
    if (!toPos || String(toPos) === cur) return false;
    return isFreeNode(String(toPos), vehicleId);
  };

  // 1) yield-back
  if (prev && canStepTo(prev)) {
    s.pathQueue.unshift(cur);
    const dir = getDirection(s, cur, prev);
    s.currentTarget = prev;
    console.log(`>>> [YIELD ${vehicleId}] back: ${cur} -> ${prev} (${dir})`);
    publishToCar(TOPICS[vehicleId].pubCmd, { type: "STEP", target: prev, direction: dir });
    return true;
  }

  // 2) side-step
  for (const nb of neighbors4(cur)) {
    if (canStepTo(nb)) {
      s.pathQueue.unshift(cur);
      const dir = getDirection(s, cur, nb);
      s.currentTarget = nb;
      console.log(`>>> [YIELD ${vehicleId}] side: ${cur} -> ${nb} (${dir})`);
      publishToCar(TOPICS[vehicleId].pubCmd, { type: "STEP", target: nb, direction: dir });
      return true;
    }
  }

  return false;
};

// ====== HOLD / deadlock-breaker ======
const computeHoldMs = () => {
  return Math.max(MIN_HOLD_MS, Math.floor(WAIT_TICK_MS * 0.9));
};

const sendHold = (vehicleId, ms, reason) => {
  const s = sessions[vehicleId];
  if (!s) return;

  if (s.waiting) return;

  s.waiting = true;
  s.waitToken += 1;
  const token = s.waitToken;

  console.log(`>>> [HOLD ${vehicleId}] at ${s.lastPosition} for ${ms}ms (${reason})`);
  publishToCar(TOPICS[vehicleId].pubCmd, { type: "HOLD", ms });

  // fallback timer
  setTimeout(() => {
    const ss = sessions[vehicleId];
    if (!ss) return;
    if (ss.waiting && ss.waitToken === token) {
      ss.waiting = false;
      emitToFrontend("car:position", {
        vehicleId,
        position: ss.lastPosition ? ss.lastPosition.split(",").map(Number) : [0, 0],
        status: "HOLD_DONE",
      });
      setTimeout(() => sendNextPosition(vehicleId), 50);
    }
  }, ms + 200);
};

const breakSwapDeadlock = (vehicleId, otherId, fromPos, toPos) => {
  // Winner = rank nhỏ hơn. Nếu hòa, tie-break ổn định theo vehicleId.
  const aRank = getEffectiveRank(vehicleId);
  const bRank = getEffectiveRank(otherId);

  let winner = vehicleId;
  if (aRank > bRank) winner = otherId;
  if (aRank === bRank) {
    winner = String(vehicleId).localeCompare(String(otherId)) <= 0 ? vehicleId : otherId;
  }
  const yielder = winner === vehicleId ? otherId : vehicleId;

  // winner giữ nguyên và chờ; loser phải né/lùi
  if (vehicleId !== yielder) {
    sendHold(vehicleId, Math.max(MIN_HOLD_MS, 800), `swap: wait ${yielder} yield (winner=${winner})`);
    return true;
  }

  // loser: ưu tiên lùi/né bằng tryYieldMove (nhanh & đơn giản)
  const ok = tryYieldMove(vehicleId);
  if (ok) return true;

  // nếu không yield được thì fallback: tìm ô trống cạnh fromPos để "đỗ tránh"
  const s = sessions[vehicleId];
  if (!s) return false;

  const avoid = new Set([String(toPos)]);
  const otherPos = sessions[otherId]?.lastPosition;
  if (otherPos) avoid.add(String(otherPos));
  const otherIntent = getIntentTarget(otherId);
  if (otherIntent) avoid.add(String(otherIntent));

  const cand = neighbors4(fromPos).filter((p) => !avoid.has(p) && isFreeNode(p, vehicleId));
  if (cand.length === 0) {
    sendHold(vehicleId, computeHoldMs(), `swap: no free neighbor`);
    return true;
  }

  const parking = cand[0];
  console.log(`>>> [DEADLOCK] ${vehicleId}<->${otherId} swap ${fromPos}<->${toPos}. Loser=${vehicleId} detour to ${parking}`);
  s.pathQueue.unshift(parking);
  setTimeout(() => sendNextPosition(vehicleId), 0);
  return true;
};

// ====== main send-next ======
const sendNextPosition = (vehicleId) => {
  const s = sessions[vehicleId];
  if (!s || !s.isNavigating) return;

  if (s.waiting) return;

  if (!s.pathQueue || s.pathQueue.length === 0) {
    s.isNavigating = false;
    s.currentTarget = null;

    // Nếu fullPath có đoạn RETURN (finalPos != goalPos) thì dùng FINISH để MCU về LED ĐỎ.
    const goalStr = s.goalPos != null ? String(s.goalPos) : null;
    const finalStr = s.finalPos != null ? String(s.finalPos) : (s.lastPosition != null ? String(s.lastPosition) : null);
    const shouldFinish = goalStr && finalStr && String(finalStr) !== String(goalStr);

    console.log(`=== [DONE ${vehicleId}] ${shouldFinish ? "RETURNED -> FINISH" : "STOP"} (pos=${s.lastPosition || "?"}) ===`);

    // tránh publish lặp nếu sendNextPosition bị gọi lại nhiều lần
    if (!s.finishedNotified) {
      s.finishedNotified = true;
      if (shouldFinish) {
        publishToCar(TOPICS[vehicleId].pubCmd, { type: "FINISH" });
      } else {
        publishToCar(TOPICS[vehicleId].pubCmd, { type: "STOP", message: "Finished" });
      }
    }

    // Thông báo UI: terminal status (RealTime.jsx bắt DONE/IDLE để set idle)
    try {
      if (s.lastPosition) {
        const [rr, cc] = String(s.lastPosition).split(",").map(Number);
        if (Number.isFinite(rr) && Number.isFinite(cc)) {
          emitToFrontend("car:position", { vehicleId, position: [rr, cc], status: "DONE" });
        }
      }
    } catch (e) {
      // ignore
    }

    return;
  }

  const nextTarget = String(s.pathQueue[0]);

  // ===== PLANNED WAIT (duplicate node in path) =====
  // Planner (Home.jsx) biểu diễn WAIT bằng cách lặp lại cùng 1 node nhiều tick.
  // Trước đây backend "pop" các node trùng -> vô tình xoá WAIT, khiến xe đi sớm hơn plan
  // và dễ tạo deadlock (ví dụ V2 vào 3,1 sớm thay vì chờ ở 3,2).
  //
  // Fix: nếu nextTarget == lastPosition => coi là WAIT tick(s) và gửi HOLD tương ứng.
  if (s.lastPosition && nextTarget === s.lastPosition) {
    let nWait = 0;
    const cur = String(s.lastPosition);
    while (s.pathQueue.length > 0 && String(s.pathQueue[0]) === cur) {
      s.pathQueue.shift();
      nWait += 1;
    }

    // Hold theo số tick WAIT. Dùng computeHoldMs() để đồng bộ với nhịp di chuyển 1 ô.
    const msPerTick = computeHoldMs();
    const holdMs = Math.max(MIN_HOLD_MS, msPerTick * Math.max(1, nWait));
    sendHold(vehicleId, holdMs, `planned WAIT x${nWait}`);
    return;
  }

  const block = checkBlocked(vehicleId, s.lastPosition, nextTarget);
  if (block.blocked) {
    // 1) swap head-on: dùng breaker
    if (block.kind === "swap" && block.blockerId) {
      const handled = breakSwapDeadlock(vehicleId, block.blockerId, s.lastPosition, nextTarget);
      if (handled) return;
    }

    // 2) node/reserve: KHÔNG back/side-step. Loser chỉ HOLD tại chỗ theo tick planning.
sendHold(vehicleId, computeHoldMs(), block.reason);
return;
  }

  const direction = getDirection(s, s.lastPosition, nextTarget);
  s.currentTarget = nextTarget;

  const payload = { type: "STEP", target: nextTarget, direction };
  console.log(`>>> [CMD ${vehicleId}] ${s.lastPosition} -> ${nextTarget} (${direction})`);
  publishToCar(TOPICS[vehicleId].pubCmd, payload);
};

// ====== start navigation ======
const startNavigationSequence = (vehicleId, rawPath, startPoint, meta = {}) => {
  if (!sessions[vehicleId]) throw new Error(`Unknown vehicleId: ${vehicleId}`);

  const s = sessions[vehicleId];
  console.log("-------------------------------------------------------");
  const startStr = normPos(startPoint);
  console.log(`[NAVIGATE ${vehicleId}] Start: ${startStr}`);

  // meta: { batchId, goalPos, delayTicks, etaGoalTicks, rank, winnerId, assignedReturn ... }
  s.batchId = meta?.batchId ?? s.batchId;
  s.goalPos = meta?.goalPos ?? s.goalPos;
  s.delayTicks = Number(meta?.delayTicks ?? s.delayTicks ?? 0);
  const eta = meta?.etaGoalTicks;
  s.etaGoalTicks = typeof eta === "number" ? eta : (eta != null ? Number(eta) : s.etaGoalTicks);

  // Lưu meta để dùng rank (winner/loser) đồng bộ từ UI
  s.meta = meta || null;
  s.prevPosition = null;

  // ===== Mission markers for LED/state (DELIVERED/FINISH) =====
  s.goalReached = false;
  s.deliveredNotified = false;
  s.finishedNotified = false;

  // normalize goalPos to "r,c" string if provided
  if (s.goalPos != null) s.goalPos = String(s.goalPos).replace(/\./g, ",");


  let cleanPath = Array.isArray(rawPath) ? rawPath.map(normPos) : [];
  if (cleanPath.length > 0 && String(cleanPath[0]) === String(startStr)) cleanPath.shift();
  if (cleanPath.length === 0) return;

  // finalPos = điểm cuối của fullPath (thường là bến/returnTarget)
  s.finalPos = cleanPath.length ? String(cleanPath[cleanPath.length - 1]) : null;

  clearVehicleOccupancy(vehicleId);
  occupancy[String(startStr)] = vehicleId;

  s.pathQueue = cleanPath;
  s.lastPosition = String(startStr);

  s.lastVector = { x: 0, y: 1 };
  s.currentTarget = null;
  s.isNavigating = true;

  s.waiting = false;
  s.waitToken = 0;

  recomputePriorityRanks();

  
// ===== step-gate: tick tính theo số bước (ACK OK) của xe lead, tính từ LÚC batch bắt đầu (từ bước 1 của lead) =====
const delayTicks = Number(s.delayTicks || 0);
const batchId = getBatchId(s);
if (batchId) {
  const gate = getGate(batchId);

  // leadId lấy từ meta (UI). Nếu chưa có, fallback theo rank nhỏ nhất trong batch.
  const metaLead = meta?.leadId || meta?.leadVehicleId || null;
  if (!gate.leadId) gate.leadId = metaLead || inferLeadIdForBatch(batchId);

  // Nếu đây là lead (winner) và đang start batch, đảm bảo gate tồn tại từ đầu để leadSteps bắt đầu đếm ngay từ bước 1.
  // batchId là unique nên có thể reset leadSteps = 0 khi lead start lần đầu.
  if (gate.leadId && String(vehicleId) === String(gate.leadId) && !Number.isFinite(gate.leadSteps)) {
    gate.leadSteps = 0;
  }
  if (gate.leadId && String(vehicleId) === String(gate.leadId) && gate.leadSteps === 0 && Object.keys(gate.waiting).length === 0) {
    // noop: giữ leadSteps=0, sẽ tăng trong ACK OK
  }

  // Follower: nếu có delayTicks thì gate theo leadSteps.
  if (delayTicks > 0) {
    // Nếu lead đã đi đủ bước (trường hợp follower navigate tới muộn), cho chạy ngay.
    const already = Number(gate.leadSteps || 0);
    if (already >= delayTicks) {
      s.gated = false;
      console.log(`>>> [GATE ${vehicleId}] skip (leadSteps=${already} >= need=${delayTicks}) batch=${batchId}`);
      sendNextPosition(vehicleId);
      return;
    }

    s.gated = true; // soft gate (không publish HOLD)
    gate.waiting[vehicleId] = delayTicks;
    console.log(`>>> [GATE ${vehicleId}] wait lead=${gate.leadId || "?"} for ${delayTicks} step(s) (batch=${batchId})`);
    return;
  }
}

// Lead hoặc không delay: đi ngay
s.gated = false;
sendNextPosition(vehicleId);
};

// ====== AWS IoT subscribe handling ======
const setupConnectionEvents = async () => {
  if (!connection) return;

  const onPublish = (topic, payload) => {
    try {
      const decoder = new TextDecoder("utf-8");
      const jsonString = decoder.decode(payload);
      const data = JSON.parse(jsonString);

      let vehicleId = null;
      if (topic === TOPICS.V1.subPos) vehicleId = "V1";
      if (topic === TOPICS.V2.subPos) vehicleId = "V2";
      if (!vehicleId) return;

      if (!data.position) return;

      const rawPos = String(data.position).replace(/\./g, ",");
      const [row, col] = rawPos.split(",").map(Number);

      const s = sessions[vehicleId];

      if (s) {
        // lưu prevPosition để có thể yield-back khi bị block
        if (s.lastPosition && String(s.lastPosition) !== String(rawPos)) {
          s.prevPosition = s.lastPosition;
        }

        clearVehicleOccupancy(vehicleId);
        occupancy[rawPos] = vehicleId;
        s.lastPosition = rawPos;
      }

      const now = Date.now();
      const samePos = s?.lastEmitPos === rawPos;
      const tooSoon = now - (s?.lastEmitAt || 0) < EMIT_SAME_POS_MS;

      if (!samePos || !tooSoon) {
        if (s) {
          s.lastEmitPos = rawPos;
          s.lastEmitAt = now;
        }
        console.log("[EMIT] car:position", vehicleId, row, col, data.status);
        emitToFrontend("car:position", {
          vehicleId,
          position: [row, col],
          status: data.status || "OK",
        });
      }

      if (!s?.isNavigating) return;

      const statusUpper = String(data.status || "").toUpperCase();

      if (statusUpper === "HOLD_DONE" || statusUpper === "HOLD_OK") {
        if (s.waiting) {
          console.log(`✓ [HOLD ${vehicleId}] done at ${rawPos} -> resume`);
          s.waiting = false;
          setTimeout(() => sendNextPosition(vehicleId), 50);
        }
        return;
      }

      const ok = statusUpper !== "ERROR";
      if (ok && s.currentTarget && String(rawPos) === String(s.currentTarget)) {
        console.log(`✓ [ACK ${vehicleId}] Đã đến ${rawPos}. Pop + đi tiếp...`);

        // IMPORTANT:
        // - Chỉ pop đúng 1 node vừa ACK tới.
        // - KHÔNG pop hết các node trùng nhau vì planner dùng "node lặp" để biểu diễn WAIT ticks.
        if (s.pathQueue.length > 0 && String(s.pathQueue[0]) === String(rawPos)) {
          s.pathQueue.shift();
        }

        // ===== GOAL reached: notify once (for LED GREEN + inventory/log) =====
        try {
          const goalStr = s.goalPos != null ? String(s.goalPos) : null;
          if (goalStr && !s.goalReached && String(rawPos) === String(goalStr) && statusUpper === "OK") {
            s.goalReached = true;
            console.log(`=== [DELIVERED ${vehicleId}] reached goal ${goalStr} ===`);

            // Tell MCU to turn LED GREEN (hasDelivered = true)
            publishToCar(TOPICS[vehicleId].pubCmd, { type: "DELIVERED" });

            // Notify frontend: RealTime.jsx listens "car:reached" for inventory update
            emitToFrontend("car:reached", { vehicleId, position: [row, col], status: "DELIVERED", goalPos: goalStr });
          }
        } catch (e) {
          console.log("[DELIVERED] error:", e?.message || e);
        }


        s.currentTarget = null;
        recomputePriorityRanks();

// ===== step-gate release (theo lead ACK bước) =====
try {
  const batchId = getBatchId(s);
  if (batchId) {
    const gate = batchGate[batchId];
    if (gate) {
      if (!gate.leadId) gate.leadId = s?.meta?.leadId || inferLeadIdForBatch(batchId);
      const leadId = gate.leadId;

      if (leadId && String(vehicleId) === String(leadId)) {
        gate.leadSteps = Number(gate.leadSteps || 0) + 1;
        console.log(`>>> [GATE ${leadId}] leadSteps=${gate.leadSteps} (batch=${batchId})`);

        for (const [fid, need] of Object.entries(gate.waiting)) {
          if (gate.leadSteps >= Number(need)) {
            const fs = sessions[fid];
            if (fs && fs.isNavigating && fs.gated) {
              fs.gated = false;
              delete gate.waiting[fid];
              console.log(`>>> [GATE ${fid}] released at leadSteps=${gate.leadSteps} need=${need} (batch=${batchId})`);
              setTimeout(() => sendNextPosition(fid), 0);
            }
          }
        }
      }
    }
  }
} catch (e) {
  console.log("[GATE] error:", e?.message || e);
}
        setTimeout(() => sendNextPosition(vehicleId), 100);
      }
    } catch (e) {
      console.error("[onPublish parse error]", e.message);
    }
  };

  const subscribeAll = async () => {
    await connection.subscribe(TOPICS.V1.subPos, mqtt.QoS.AtLeastOnce, onPublish);
    await connection.subscribe(TOPICS.V2.subPos, mqtt.QoS.AtLeastOnce, onPublish);
    console.log(`✓ Subscribed: ${TOPICS.V1.subPos}`);
    console.log(`✓ Subscribed: ${TOPICS.V2.subPos}`);
  };

  connection.on("connect", () => {
    console.log("ĐÃ KẾT NỐI AWS IOT!");
    subscribeAll();
  });
  connection.on("resume", () => subscribeAll());
  connection.connect();
};

const connectToAwsIot = async () => {
  try {
    connection = await buildConnection();
    await setupConnectionEvents();
  } catch (err) {
    console.error("AWS IoT connect error:", err?.message || err);
    setTimeout(connectToAwsIot, 5000);
  }
};

module.exports = { connectToAwsIot, startNavigationSequence, sendCommandToCar };
