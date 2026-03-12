// src/pages/RealTime.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import ControlPanel from "../components/ControlPanel";
import { aStarSearch } from "../utils/aStar";
import { planMultiCarsRoute, pathToMcuCommands } from "../utils/routePlanner";

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const API_BASE = (import.meta.env.VITE_API_URL || SOCKET_SERVER_URL).replace(/\/$/, "");
  
// ===== helpers =====
const isPos = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]);
const toCsv = (p) => (isPos(p) ? `${p[0]},${p[1]}` : null);
const normalizePos = (p) => {
  if (!p) return null;
  if (isPos(p)) return [Number(p[0]), Number(p[1])];
  if (typeof p === "string") {
    const s = p.trim().replace(".", ",");
    const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) return [a, b];
    }
  }
  if (typeof p === "object" && p !== null) {
    const a = p.row ?? p.r ?? p.x ?? p.i;
    const b = p.col ?? p.c ?? p.y ?? p.j;
    if (Number.isFinite(+a) && Number.isFinite(+b)) return [Number(a), Number(b)];
  }
  return null;
};
const SIDEBAR_W = 280; // đúng bằng width sidebar của bạn
  const PAGE_GAP = 20;
  
const HOME = [1, 1];
const START_SPOTS = [
  [1, 1], // V1
  [1, 2], // V2
  [1, 3], // V3
  [1, 4], // V4
  [1, 5], // V5
];

const makeVehicle = (id, pos, endPos) => ({
  id,
  pos,
  endPos,
  status: "idle",
  tripLog: [],
  delayMs: 0,
});

const buildDefaultVehicles = () => ([
  makeVehicle("V1", START_SPOTS[0], [5, 3]),
  makeVehicle("V2", START_SPOTS[1], [5, 5]),
  makeVehicle("V3", START_SPOTS[2], [5, 1]),
]);

const buildDefaultCargo = () => ({ V1: "", V2: "", V3: "" });

// Shared (Home + RealTime) deadzone storage key
const DEADZONE_LS_KEY = "deadZones";

// deadzones are stored as array of "r,c" strings for stability.
const normalizeDeadZones = (raw) => {
  const src = raw instanceof Set ? Array.from(raw) : Array.isArray(raw) ? raw : [];
  const out = new Set();
  for (const item of src) {
    const p = normalizePos(item);
    if (!p) continue;
    if (p[0] < 1 || p[0] > 5 || p[1] < 1 || p[1] > 5) continue;
    const k = toCsv(p);
    if (k) out.add(k);
  }
  return Array.from(out);
};

// Parse a text input into multiple grid positions.
// Accepts: "2.1 1.2", "2,1;1,2", "(2.1) và (1.2)", etc.
const parseMultiPositions = (text) => {
  if (!text || typeof text !== "string") return [];
  const matches = [...text.matchAll(/(\d+)\D+(\d+)/g)];
  const out = [];
  for (const m of matches) {
    const r = Number(m[1]);
    const c = Number(m[2]);
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
    if (r < 1 || r > 5 || c < 1 || c > 5) continue;
    out.push([r, c]);
  }
  return out;
};

// ===== parse cargo: hỗ trợ nhập dạng "10 Laptop" hoặc "10|Laptop" =====
const parseCargoInput = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return { qty: 0, itemName: "", raw: "" };
  const m = s.match(/^\s*(\d+)\s*(?:\||-|:)?\s*(.*)\s*$/);
  if (m) {
    const qty = Number(m[1] || 0);
    const itemName = String(m[2] || "").trim();
    return { qty: Number.isFinite(qty) ? qty : 0, itemName, raw: s };
  }
  const qty = parseInt(s, 10);
  return { qty: Number.isFinite(qty) ? qty : 0, itemName: "", raw: s };
};

// ===== update Inventory (localStorage) =====
const updateInventoryStorage = (destCsv, cargoRaw) => {
  if (!destCsv) return;
  const parsed = parseCargoInput(cargoRaw);
  const qty = parseInt(parsed.qty, 10);
  const itemName = String(parsed.itemName || "").trim();
  if (!qty || qty <= 0) return;

  const validWarehouses = ["5,1", "5,2", "5,3", "5,4", "5,5"];
  if (!validWarehouses.includes(destCsv)) return;

  // 1) Tổng tồn kho theo vị trí
  try {
    const stock = JSON.parse(localStorage.getItem("warehouse_stock") || "{}");
    const oldQty = Number(stock?.[destCsv] || 0);
    const newQty = oldQty + qty;
    stock[destCsv] = newQty;
    localStorage.setItem("warehouse_stock", JSON.stringify(stock));
  } catch {}

  // 2) Item theo kho (inventory_goods_v1)
  try {
    const GOODS_KEY = "inventory_goods_v1";
    const raw = localStorage.getItem(GOODS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const goods = Array.isArray(arr) ? arr : [];
    const norm = (s) => String(s || "").trim().toLowerCase();

    const sysId = `SYS_${destCsv}`;
    const nameToFind = itemName ? norm(itemName) : null;

    let idx = -1;
    if (nameToFind) {
      idx = goods.findIndex(
        (g) => norm(g?.warehouseKey) === destCsv && !g?.system && norm(g?.name) === nameToFind
      );
    }

    if (idx >= 0) {
      const old = Number(goods[idx]?.qty || 0);
      goods[idx] = { ...goods[idx], qty: old + qty };
    } else {
      const sysIdx = goods.findIndex((g) => g?.id === sysId || (g?.system && norm(g?.warehouseKey) === destCsv));
      if (sysIdx >= 0) {
        const old = Number(goods[sysIdx]?.qty || 0);
        goods[sysIdx] = { ...goods[sysIdx], id: sysId, system: true, warehouseKey: destCsv, name: goods[sysIdx]?.name || "Khác", qty: old + qty };
      } else {
        goods.push({
          id: sysId,
          system: true,
          warehouseKey: destCsv,
          name: "Khác",
          positionDetail: "",
          qty: qty,
          target: 0,
          createdAtIso: new Date().toISOString(),
        });
      }

      // auto create nếu user nhập tên hàng
      if (nameToFind) {
        goods.push({
          id: `G${Date.now()}`,
          system: false,
          warehouseKey: destCsv,
          name: itemName,
          positionDetail: "",
          qty: qty,
          target: 0,
          createdAtIso: new Date().toISOString(),
        });
      }
    }

    localStorage.setItem(GOODS_KEY, JSON.stringify(goods));
  } catch {}
};
// ===== localStorage keys =====
const RT_KEYS = {
  vehicles: "realtime_vehicles_state",
  logs: "realtime_logs",
  cargo: "realtime_cargo_amounts_v1",
  counters: "realtime_delivery_counters_v1",
};

const safeParseLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const normalizeVehicleForState = (v) => {
  if (!v || typeof v !== "object") return null;
  const id = String(v.id || "").trim();
  if (!id) return null;

  const m = id.match(/^V(\d+)$/i);
  const idx = m ? Number(m[1]) - 1 : 0;
  const fallbackPos = START_SPOTS[idx] || START_SPOTS[0];
  const fallbackEnd = [5, 1];

  const pos = isPos(v.pos) ? [Number(v.pos[0]), Number(v.pos[1])] : null;
  const endPos = isPos(v.endPos) ? [Number(v.endPos[0]), Number(v.endPos[1])] : null;

  return {
    ...makeVehicle(id, pos || fallbackPos, endPos || fallbackEnd),
    ...v,
    id,
    pos: pos || fallbackPos,
    endPos: endPos || fallbackEnd,
    status: v.status || "idle",
    tripLog: Array.isArray(v.tripLog) ? v.tripLog : [],
  };
};

const loadVehicles = () => {
  const saved = safeParseLS(RT_KEYS.vehicles, null);
  if (Array.isArray(saved) && saved.length) {
    const norm = saved.map(normalizeVehicleForState).filter(Boolean);
    if (norm.length) return norm;
  }
  return buildDefaultVehicles();
};

const loadLogs = () => {
  const saved = safeParseLS(RT_KEYS.logs, []);
  return Array.isArray(saved) ? saved : [];
};

const loadCargo = () => {
  const saved = safeParseLS(RT_KEYS.cargo, null);
  return saved && typeof saved === "object" ? saved : buildDefaultCargo();
};

const loadCounters = () => {
  const saved = safeParseLS(RT_KEYS.counters, null);
  return saved && typeof saved === "object" ? saved : { V1: 0, V2: 0 };
};

export default function RealTime() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  
    // ===== REAL WORLD SYNC (IMPORTANT) =====
    // Thay vì delay theo ms (UI nhanh/chậm khác thực tế), ta dùng "gate theo progress":
    // Ví dụ: V2 chỉ bắt đầu khi V1 đã đi được N node (N = delayTicks).
    const runGateRef = useRef({
      running: false,
      leadId: "V1",
      progress: {}, // { V1: 0, ... }  số lần đổi node
      lastPos: {},  // { V1: "1,1", ... } để chống đếm trùng
      waiting: {},  // { V2: { leadTicks, path, cargo } }
      batchId: null,
      batchVehicles: [],
      done: {},
    });
  const [vehicles, setVehicles] = useState(loadVehicles);
  const [cargoAmounts, setCargoAmounts] = useState(loadCargo);
  const [alertMessage, setAlertMessage] = useState("");
  const [blink, setBlink] = useState(false);
  const [logs, setLogs] = useState(loadLogs);
  const [deliveryCounters, setDeliveryCounters] = useState(loadCounters);
  const [isRunningTogether, setIsRunningTogether] = useState(false);

  // ===== Deadzones (static obstacles) =====
  const [deadZones, setDeadZones] = useState(() => normalizeDeadZones(safeParseLS(DEADZONE_LS_KEY, [])));
  const [deadZoneMode, setDeadZoneMode] = useState(false);
  const [deadZoneText, setDeadZoneText] = useState("");
  const deadZoneSetRef = useRef(new Set(deadZones));

  useEffect(() => {
    deadZoneSetRef.current = new Set(deadZones);
    try {
      localStorage.setItem(DEADZONE_LS_KEY, JSON.stringify(deadZones));
    } catch (e) {}
  }, [deadZones]);

  // ===== Persist to Inventory page (localStorage) =====
  const activeTripRef = useRef({}); // { V1: deliveryId, ... }
  const tripMetaRef = useRef({}); // { V1: { destCsv, cargoRaw }, ... } (để cập nhật inventory khi car:reached)

  useEffect(() => {
    try { localStorage.setItem(RT_KEYS.vehicles, JSON.stringify(vehicles)); } catch (e) {}
  }, [vehicles]);

  useEffect(() => {
    try { localStorage.setItem(RT_KEYS.logs, JSON.stringify(logs)); } catch (e) {}
  }, [logs]);

  useEffect(() => {
    try { localStorage.setItem(RT_KEYS.cargo, JSON.stringify(cargoAmounts)); } catch (e) {}
  }, [cargoAmounts]);

  useEffect(() => {
    try { localStorage.setItem(RT_KEYS.counters, JSON.stringify(deliveryCounters)); } catch (e) {}
  }, [deliveryCounters]);

  // đảm bảo cargoAmounts có key cho tất cả vehicles (và xoá key xe đã remove)
  useEffect(() => {
    setCargoAmounts((prev) => {
      const cur = prev && typeof prev === "object" ? { ...prev } : {};
      const ids = new Set((vehicles || []).map((v) => v.id));
      (vehicles || []).forEach((v) => {
        if (!(v.id in cur)) cur[v.id] = "";
      });
      Object.keys(cur).forEach((k) => {
        if (!ids.has(k)) delete cur[k];
      });
      return cur;
    });
  }, [vehicles]);

  const getNextDeliveryIdGlobal = () => {
    const counter = parseInt(localStorage.getItem("deliveryCounter") || "0", 10) + 1;
    localStorage.setItem("deliveryCounter", String(counter));
    return `DH${String(counter).padStart(4, "0")}`;
  };

  const csvToPos = (s) => {
    if (!s) return null;
    const parts = String(s).trim().split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) return [a, b];
    }
    return null;
  };

  const saveTripLogToStorage = (vehicleId, startPos, endPos, cargo, path) => {
    if (!vehicleId || !Array.isArray(path) || path.length < 2) return null;

    // tránh ghi trùng khi xe đang ở trạng thái moving cùng 1 batch
    if (activeTripRef.current?.[vehicleId]) return activeTripRef.current[vehicleId];

    const deliveryId = getNextDeliveryIdGlobal();
    const nowLabel = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const timeIso = new Date().toISOString();

    const sp = Array.isArray(startPos) ? startPos : path[0];
    const ep = Array.isArray(endPos) ? endPos : csvToPos(endPos) || null;

    const entry = {
      deliveryId,
      vehicleId,
      route: sp && ep ? `${sp[0]},${sp[1]} → ${ep[0]},${ep[1]}` : "—",
      cargo: cargo || "Chưa nhập",
      time: nowLabel,
      timeIso,
      path: path.map((p) => `${p[0]},${p[1]}`).join(" → "),
      source: "realtime",
    };

    try {
      const existing = JSON.parse(localStorage.getItem("tripLogs") || "[]");
      localStorage.setItem("tripLogs", JSON.stringify([...existing, entry]));
      activeTripRef.current[vehicleId] = deliveryId;
    } catch (e) {
      // ignore
    }

    return deliveryId;
  };

  // ===== helpers =====
  const normalizePos = (p) => {
    if (!p) return null;
    if (Array.isArray(p) && p.length === 2) return [Number(p[0]), Number(p[1])];
    if (typeof p === "string") {
      const s = p.trim().replace(".", ",");
      const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
      if (parts.length === 2) return [Number(parts[0]), Number(parts[1])];
    }
    return null;
  };

  const debugLog = (msg) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [`[${now}] 🧪 ${msg}`, ...prev].slice(0, 200));
  };

  const startTimersRef = useRef({}); // { V2: timeoutId, ... }


  const v1 = vehicles.find((v) => v.id === "V1");
  const v2 = vehicles.find((v) => v.id === "V2");

  const addPathLog = (vehicleId, path) => {
    if (!Array.isArray(path) || path.length === 0) return;
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const pathStr = path.map((p) => `${p[0]}.${p[1]}`).join(" → ");
    setLogs((prev) => [`[${now}] Xe ${vehicleId}: ${pathStr}`, ...prev].slice(0, 200));
  };

  const addLog = (vehicleId, cargo, ok) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const message = `[${now}] ${vehicleId}: ${ok ? "✅" : "❌"} cargo=${cargo || "Chưa nhập"}`;
    setLogs((prev) => [message, ...prev].slice(0, 200));
  };

  // ===== Deadzone helpers =====
  const systemLog = (msg) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [`[${now}] ${msg}`, ...prev].slice(0, 200));
  };

  const formatDot = (kOrPos) => {
    if (typeof kOrPos === "string") return kOrPos.replace(",", ".");
    const p = normalizePos(kOrPos);
    return p ? `${p[0]}.${p[1]}` : "?";
  };

  const validateDeadZonesNow = (deadSet) => {
    const errors = [];
    for (const v of vehicles) {
      if (v.status !== "idle") continue;
      const start = normalizePos(v.pos);
      const goal = normalizePos(v.endPos);
      if (!start || !goal) continue;

      const sk = toCsv(start);
      const gk = toCsv(goal);
      if (!sk || !gk) continue;

      if (deadSet.has(sk)) {
        errors.push(`❌ ${v.id} đang ở ${formatDot(sk)} nhưng vị trí này là vật cản (deadzone).`);
        continue;
      }
      if (deadSet.has(gk)) {
        errors.push(`❌ ${v.id}: Điểm đến ${formatDot(gk)} đang là vật cản (deadzone).`);
        continue;
      }

      const p = aStarSearch(start, goal, false, null, deadSet);
      if (!p || p.length < 2) {
        errors.push(`❌ ${v.id}: Không tìm được đường từ ${formatDot(sk)} đến ${formatDot(gk)} do vật cản.`);
      }
    }

    if (errors.length) {
      errors.forEach((m) => {
        console.error(m);
        systemLog(m);
      });
      setAlertMessage(errors[0]);
    }
  };

  const applyDeadZones = (nextKeys) => {
    const next = normalizeDeadZones(nextKeys);
    setDeadZones(next);
    deadZoneSetRef.current = new Set(next);
    validateDeadZonesNow(new Set(next));
  };

  const toggleDeadZone = (pos) => {
    if (vehicles.some((v) => v.status !== "idle")) {
      systemLog("⚠️ Không thể tạo vật cản khi xe đang chạy/đợi. Vui lòng chờ xe idle.");
      return;
    }
    const p = normalizePos(pos);
    if (!p) return;
    const k = toCsv(p);
    if (!k) return;
    const set = new Set(deadZoneSetRef.current);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    applyDeadZones(Array.from(set));
  };

  const addDeadZonesFromText = () => {
    if (vehicles.some((v) => v.status !== "idle")) {
      systemLog("⚠️ Không thể tạo vật cản khi xe đang chạy/đợi. Vui lòng chờ xe idle.");
      return;
    }
    const positions = parseMultiPositions(deadZoneText);
    if (!positions.length) {
      systemLog("⚠️ Vui lòng nhập ít nhất 1 vị trí vật cản. Ví dụ: 2.1, 1.2");
      return;
    }
    const set = new Set(deadZoneSetRef.current);
    positions.forEach((p) => {
      const k = toCsv(p);
      if (k) set.add(k);
    });
    applyDeadZones(Array.from(set));
    setDeadZoneText("");
  };

  const clearDeadZones = () => {
    if (vehicles.some((v) => v.status !== "idle")) {
      systemLog("⚠️ Không thể xoá vật cản khi xe đang chạy/đợi. Vui lòng chờ xe idle.");
      return;
    }
    applyDeadZones([]);
  };

  const updateVehicle = (id, field, value) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const getNextDeliveryId = (vehicleId) => {
    const current = deliveryCounters[vehicleId] || 0;
    const next = current + 1;
    setDeliveryCounters((prev) => ({ ...prev, [vehicleId]: next }));
    return next;
  };
useEffect(() => {
  socketRef.current = io(SOCKET_SERVER_URL);

  socketRef.current.on("car:position", (payload) => {
    // backend có thể gửi: { vehicle_id | vehicleId | id, position: [row,col], status }
    const vid = payload?.vehicle_id || payload?.vehicleId || payload?.id;
    const pos = payload?.position;
    if (!vid || !Array.isArray(pos) || pos.length !== 2) return;

    // DONE/IDLE là kết thúc (OK có thể chỉ ACK từng node)
    const rawStatus = String(payload?.status || "").toUpperCase();
    const isTerminal = rawStatus === "DONE" || rawStatus === "IDLE";

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vid
          ? {
              ...v,
              pos: [pos[0], pos[1]],
              ...(isTerminal ? { status: "idle", tripLog: [] } : null),
            }
          : v
      )
    );
    
        // ===== Gate progress: start xe sau khi xe lead đi được N node (delayTicks) =====
        const gate = runGateRef.current;
       if (gate?.running) {
          const key = `${pos[0]},${pos[1]}`;
          const last = gate.lastPos?.[vid];
    
          // chỉ đếm khi xe thực sự đổi node (tránh spam cùng 1 QR)
          if (key !== last) {
            gate.lastPos[vid] = key;
            gate.progress[vid] = (gate.progress[vid] || 0) + 1;
    
            // Khi lead xe (thường là V1) đã đi đủ leadTicks -> mở gate cho xe đang chờ
            if (vid === gate.leadId) {
              for (const [waitVid, w] of Object.entries(gate.waiting || {})) {
                const need = Number(w?.leadTicks || 0);
                if (gate.progress[gate.leadId] >= need) {
                  setVehicles((prev) =>
                    prev.map((x) =>
                      x.id === waitVid ? { ...x, status: "moving", tripLog: w.path || [] } : x
                    )
                  );
                  saveTripLogToStorage(waitVid, (w.path && w.path[0]) ? w.path[0] : null, (w.meta && w.meta.goalPos) ? csvToPos(w.meta.goalPos) : null, w.cargo, w.path);
                  sendPathToBackend(waitVid, w.path, w.cargo, w.meta);
                  if (startTimersRef.current[waitVid]) { clearTimeout(startTimersRef.current[waitVid]); delete startTimersRef.current[waitVid]; }
                  delete gate.waiting[waitVid];
                }
              }
            }
          }

        // ===== Gate finish: khi tất cả xe trong batch đã DONE/IDLE thì mở lại nút "CHẠY CÙNG LÚC" =====
        if (gate?.running) {
          if (isTerminal) {
            gate.done[vid] = true;
          }
          const list = Array.isArray(gate.batchVehicles) ? gate.batchVehicles : [];
          const allDone = list.length > 0 && list.every((id) => gate.done?.[id]);
          const noWaiting = !gate.waiting || Object.keys(gate.waiting).length === 0;

          if (allDone && noWaiting) {
            gate.running = false;
            gate.batchVehicles = [];
            gate.done = {};
            gate.progress = {};
            gate.lastPos = {};
            gate.waiting = {};
            gate.leadId = "V1";
            gate.batchId = null;
            // clear any pending delayed starts
            Object.keys(startTimersRef.current || {}).forEach((k) => { try { clearTimeout(startTimersRef.current[k]); } catch(e){} });
            startTimersRef.current = {};
            setIsRunningTogether(false);
          }
        }
        }    
  });

  // ✅ FIX: hỗ trợ nhiều kiểu key khi backend emit xong job
  socketRef.current.on("car:reached", (payload) => {
    const vehicleId = payload?.vehicleId || payload?.vehicle_id || payload?.id;
    if (!vehicleId) return;

    // ✅ cập nhật Inventory (tồn kho + item theo kho)
    try {
      const meta = tripMetaRef.current?.[vehicleId];
      if (meta?.destCsv) updateInventoryStorage(meta.destCsv, meta.cargoRaw);
      delete tripMetaRef.current[vehicleId];
    } catch (e) {}

    // clear active trip marker
    try { delete activeTripRef.current[vehicleId]; } catch(e) {}

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId ? { ...v, status: "idle", tripLog: [] } : v
      )
    );
  });

  socketRef.current.on("car:error", (payload) => {
    const vehicleId = payload?.vehicleId || payload?.vehicle_id || payload?.id;
    const message = payload?.message;
    if (!vehicleId) return;

    // clear trip meta
    try { delete tripMetaRef.current[vehicleId]; } catch(e) {}

    // clear active trip marker
    try { delete activeTripRef.current[vehicleId]; } catch(e) {}

    setAlertMessage(`${vehicleId}: ${message || "Lỗi không rõ"}`);
    setTimeout(() => setAlertMessage(""), 4000);

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId ? { ...v, status: "idle", tripLog: [] } : v
      )
    );
  });

  return () => socketRef.current?.disconnect();
}, []);


  useEffect(() => {
    const interval = setInterval(() => setBlink((prev) => !prev), 1500);
    return () => clearInterval(interval);
  }, []);

  const sendPathToBackend = async (vehicleId, fullPath, cargo, meta = {}) => {
    if (!fullPath || fullPath.length < 2) {
      setAlertMessage("Lộ trình không hợp lệ!");
      setTimeout(() => setAlertMessage(""), 4000);
      return;
    }

    // lưu meta để cập nhật Inventory khi nhận car:reached
    try {
      const goal = meta?.goalPos || (fullPath?.[fullPath.length - 1] ? toCsv(fullPath[fullPath.length - 1]) : null);
      if (vehicleId) tripMetaRef.current[vehicleId] = { destCsv: goal, cargoRaw: cargo };
    } catch (e) {}
    const formattedPath = fullPath.map(toCsv);
    const formattedStartPoint = toCsv(fullPath[0]);
  
    const { commands } = pathToMcuCommands(fullPath, { normalizeAtEnd: true });
  
    try {
      const res = await fetch(`${API_BASE}/api/car/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          path: formattedPath,
          cargo,
          startPoint: formattedStartPoint,
          commands,
          meta,
        }),
      });
  
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
  
      const data = await res.json();
  
      // log debug 1 dòng rõ ràng
      const now = new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLogs((prev) => [`[${now}] ✅ ${vehicleId} backend OK: ${data?.message || "sent"}`, ...prev].slice(0, 200));
  
      // log giao hàng như bạn đang dùng
      addLog(vehicleId, cargo, true);
      setAlertMessage(`${vehicleId} đã gửi lộ trình thực tế`);
    } catch (err) {
      console.error("Lỗi gửi lệnh:", err);
      try { delete activeTripRef.current[vehicleId]; } catch(e) {}
      addLog(vehicleId, cargo, false);
      setAlertMessage(`❌ Backend lỗi: ${err?.message || "unknown"}`);
    } finally {
      setTimeout(() => setAlertMessage(""), 4000);
    }
  };
  

  const handleAddVehicle = () => {
    setVehicles((prev) => {
      if (prev.length >= 5) return prev;

      const nextIndex = prev.length; // 0..4
      const id = `V${nextIndex + 1}`;
      const newV = makeVehicle(id, START_SPOTS[nextIndex], [5, 1]);

      return [...prev, newV];
    });

    setCargoAmounts((prev) => {
      const count = Object.keys(prev).length;
      if (count >= 5) return prev;
      const id = `V${count + 1}`;
      return { ...prev, [id]: "" };
    });
  };

  const handleRemoveVehicle = (vehicleId) => {
    if (vehicleId === "V1" || vehicleId === "V2") {
      alert("Không thể xóa V1/V2.");
      return;
    }
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
    if (v.status === "moving") {
      alert(`Xe ${vehicleId} đang chạy, không thể xóa.`);
      return;
    }

    if (!confirm(`Bạn chắc chắn muốn xóa xe ${vehicleId} không?`)) return;

    setVehicles((prev) => prev.filter((x) => x.id !== vehicleId));
    setCargoAmounts((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
  };

  const handleResetApp = () => {
    if (!confirm("Reset toàn bộ trạng thái về mặc định (2 xe V1, V2)?")) return;

    // stop any delayed starts
    try {
      Object.keys(startTimersRef.current || {}).forEach((k) => {
        try { clearTimeout(startTimersRef.current[k]); } catch (e) {}
      });
      startTimersRef.current = {};
    } catch (e) {}

    // reset run gate (real-world sync)
    try {
      runGateRef.current = {
        running: false,
        leadId: "V1",
        progress: {},
        lastPos: {},
        waiting: {},
        batchId: null,
        batchVehicles: [],
        done: {},
      };
    } catch (e) {}

    // clear storage keys used by realtime UI
    try { localStorage.removeItem(RT_KEYS.vehicles); } catch (e) {}
    try { localStorage.removeItem(RT_KEYS.logs); } catch (e) {}
    try { localStorage.removeItem(RT_KEYS.cargo); } catch (e) {}
    try { localStorage.removeItem(RT_KEYS.counters); } catch (e) {}
	    try { localStorage.removeItem(DEADZONE_LS_KEY); } catch (e) {}

    // (optional) clear global counters/logs used by other pages
    try { localStorage.removeItem("deliveryCounter"); } catch (e) {}
    try { localStorage.removeItem("tripLogs"); } catch (e) {}

    // reset in-memory state (không cần reload)
    setVehicles(buildDefaultVehicles());
    setCargoAmounts(buildDefaultCargo());
    setLogs([]);
    setDeliveryCounters({ V1: 0, V2: 0 });
    setIsRunningTogether(false);
    setAlertMessage("");
    setBlink(false);
	    setDeadZones([]);
	    deadZoneSetRef.current = new Set();
	    setDeadZoneMode(false);
	    setDeadZoneText("");

    // clear active trips marker
    try { activeTripRef.current = {}; } catch (e) {}

    // reconnect socket (nếu backend/socket bị treo)
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.connect();
      }
    } catch (e) {}
  };

  const handleStartTogetherSafeMulti = () => {
    const active = vehicles
      .filter((v) => v.id === "V1" || v.id === "V2" || v.id === "V3")
      .map((v) => ({
        id: v.id,
        startPos: normalizePos(v.pos),
        endPos: normalizePos(v.endPos),
      }))
      .filter((v) => v.startPos && v.endPos);

  // Nút "chạy cùng lúc" yêu cầu đủ 2 xe (V1 & V2) có điểm đến hợp lệ
  const hasV1 = active.some((v) => v.id === "V1");
  const hasV2 = active.some((v) => v.id === "V2");
  const hasV3 = active.some((v) => v.id === "V3");
  if (!hasV1 || !hasV2 || !hasV3) {
    setAlertMessage("⚠️ Cần đặt điểm đến hợp lệ cho cả V1, V2 và V3 trước khi chạy cùng lúc!");
    setTimeout(() => setAlertMessage(""), 5000);
    debugLog(`active thiếu xe: hasV1=${hasV1}, hasV2=${hasV2}, hasV3=${hasV3}`);
    return;
  }

  if (active.length === 0) {
    setAlertMessage("⚠️ Chưa chọn xe / chưa có điểm đến!");
    setTimeout(() => setAlertMessage(""), 4000);
    return;
  }

  const result = planMultiCarsRoute({
    vehicles: active,
    baseDelayTicks: 4,
    baseDelayMs: 3500,
    maxCars: 3,
	    blockedCells: deadZoneSetRef.current,
  });

	  if (!result) {
	    setAlertMessage("❌ Không tìm được lộ trình an toàn cho tất cả xe (có thể do vật cản hoặc xung đột tránh va chạm)!");
    setTimeout(() => setAlertMessage(""), 5000);
	    // diagnostic: log xe nào đang bị deadzone chặn đường
	    active.forEach((v) => {
	      const p = aStarSearch(v.startPos, v.endPos, false, null, deadZoneSetRef.current);
	      if (!p || p.length < 2) {
	        systemLog(`❌ ${v.id}: Không có đường đi từ ${formatDot(v.startPos)} đến ${formatDot(v.endPos)} do vật cản.`);
	      }
	    });
    return;
  }

    
  debugLog(`active=${active.map(v=>v.id+":"+v.startPos.join(",")+"->"+v.endPos.join(",")).join(" | ")}`);
  debugLog(`planner keys=${Object.keys(result||{}).join(",")}`);
setIsRunningTogether(true);
  
    // ===== Gate reset =====
    const gate = runGateRef.current;
    const leadId = active.some((x) => x.id === "V1") ? "V1" : active[0].id;
  
    gate.running = true;
    gate.leadId = leadId;
    gate.progress = {};
    gate.lastPos = {};
    gate.waiting = {};
    gate.batchId = Date.now();
    gate.batchVehicles = active.map((x) => x.id);
    gate.done = {};
  
    // init chống đếm trùng ngay node start
    const leadStart =
      result?.[leadId]?.fullPath?.[0] || active.find((x) => x.id === leadId)?.startPos;
    if (leadStart) gate.lastPos[leadId] = `${leadStart[0]},${leadStart[1]}`;
    gate.progress[leadId] = 0;
  
    // ===== Start lead ngay, xe còn lại sẽ start khi lead đi đủ delayTicks =====
    active.forEach((v) => {
      const res = result[v.id];
      const fullPath = res?.fullPath;
      const meta = res?.meta || {};
  
      if (!fullPath || fullPath.length < 2) {
        setAlertMessage(`❌ ${v.id}: Lộ trình không hợp lệ!`);
        setTimeout(() => setAlertMessage(""), 5000);
        return;
      }
  
      addPathLog(v.id, fullPath);
  
      const cargo = cargoAmounts[v.id] ?? "";
      
            // ===== META đồng bộ ETA (giống Home.jsx) =====
            // ✅ delayTicks phải lấy từ planner để đồng bộ timeline với backend step-gate.
            // Không hardcode (vd 3) vì sẽ lệch so với baseDelayTicks=4 và gây HOLD/đụng lịch.
            const delayTicks = Number(res?.delayTicks ?? 0);
            const goalPos = v.endPos;
            const startPosForEta = v.startPos;
	            const naive = (startPosForEta && goalPos)
	              ? aStarSearch(startPosForEta, goalPos, true, [1, 1], deadZoneSetRef.current)
	              : null;
            const etaGoalTicks = naive ? (naive.length - 1 + delayTicks) : null;
            const metaPayload = {
              ...meta,
              batchId: gate.batchId,
          leadId: leadId,
              goalPos: goalPos ? toCsv(goalPos) : null,
              delayTicks,
              etaGoalTicks,
            };
      
      // ✅ Start ALL vehicles ngay lập tức.
      // Backend (awsIotService) đã có step-gate theo meta.delayTicks + batchId + leadId.
      // Gửi sớm giúp backend cập nhật occupancy/startPoint của V2 ngay từ đầu,
      // tránh ghost-occupancy khiến V1 bị HOLD vô lý.
      setVehicles((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, status: "moving", tripLog: fullPath } : x))
      );
      saveTripLogToStorage(v.id, (fullPath && fullPath[0]) ? fullPath[0] : null, v.endPos, cargo, fullPath);
      sendPathToBackend(v.id, fullPath, cargo, metaPayload);
    });
  };

  // ===== UI =====
  return (
    <div
      style={{
        padding: "30px 40px",
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.25), rgba(2,6,23,1) 60%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER – title bên trái, thời gian ở giữa */}
      <div
        style={{
          position: "relative",
          marginBottom: 22,
          padding: "12px 18px",
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,0.12)",
          background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))",
          backdropFilter: "blur(8px)",
          height: 74,
        }}
      >
        {/* LEFT: title + sub */}
        <div
          style={{
            position: "absolute",
            left: 18,
            top: "50%",
            transform: "translateY(-50%)",
            textAlign: "left",
            lineHeight: 1.1,
          }}
        >
        </div>

        {/* CENTER: time */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
        </div>

        {/* TOP-LEFT: button chuyển trang */}
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 18,
            right: "auto",
            transform: "none",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <button
            onClick={() => navigate("/fleet-status")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(96,165,250,0.45)",
              background:
                "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))",
              color: "#e2e8f0",
              fontWeight: 900,
              letterSpacing: "0.3px",
              cursor: "pointer",
              boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            📡 Fleet Status
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 30,
          justifyContent: "center",
          alignItems: "stretch",
          flexWrap: "nowrap",
        }}
      >
        {/* CỘT 1: BẢN ĐỒ */}
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "space-between",
            height: "calc(100vh - 180px)",
            minHeight: "720px",
            maxHeight: "900px",
          }}
        >
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
	          <MapGrid
	            v1={v1}
	            v2={v2}
	            vehicles={vehicles}
	            deadZones={deadZones}
	            deadZoneMode={deadZoneMode}
	            onToggleDeadZone={toggleDeadZone}
	          />
          </div>

          <div style={{ paddingTop: 18, display: "flex", justifyContent: "center" }}>
            <PageSwitchButtons />
          </div>
        </div>

        {/* CỘT 2: CONTROLS & LOG */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 25,
            height: "calc(100vh - 180px)",
            minHeight: "720px",
            maxHeight: "900px",
          }}
        >
          {/* A. Bảng điều khiển */}
          <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "clamp(720px, 52vw, 980px)" }}>
            {/* Button thêm xe */}
            <button
              onClick={handleAddVehicle}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(96,165,250,0.45)",
                background: "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))",
                color: "#e2e8f0",
                fontWeight: 900,
                letterSpacing: "0.4px",
                cursor: "pointer",
                boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
                marginBottom: 14,
              }}
            >
              ➕ Thêm xe (tối đa 5)
            </button>

            {/* Panels từng xe */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                gap: 16,
                width: "100%",
                alignItems: "stretch",
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                paddingRight: 8,
              }}
            >
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  style={{
                    background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))",
                    borderRadius: 14,
                    padding: 14,
                    border: "1px solid rgba(148,163,184,0.14)",
                    boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 900, color: "#e2e8f0" }}>{v.id}</div>

                    <button
                      onClick={() => handleRemoveVehicle(v.id)}
                      disabled={v.id === "V1" || v.id === "V2"}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.35)",
                        background:
                          v.id === "V1" || v.id === "V2" ? "rgba(148,163,184,0.18)" : "rgba(239,68,68,0.12)",
                        color: v.id === "V1" || v.id === "V2" ? "rgba(226,232,240,0.55)" : "#fecaca",
                        fontWeight: 800,
                        cursor: v.id === "V1" || v.id === "V2" ? "not-allowed" : "pointer",
                      }}
                    >
                      ✖ Xóa
                    </button>
                  </div>

                  <ControlPanel
                    vehicle={v}
                    onChange={(field, value) => updateVehicle(v.id, field, value)}
                    onStart={() => {
                      // chạy 1 xe: plan riêng rồi gửi
                      const startPos = normalizePos(v.pos);
                      const goalPos = normalizePos(v.endPos);
                      if (!startPos || !goalPos) {
                        const msg = `⚠️ ${v.id}: Chưa có điểm đến hợp lệ!`;
                        setAlertMessage(msg);
                        setTimeout(() => setAlertMessage(""), 4000);
                        systemLog(msg);
                        return;
                      }

                      const result = planMultiCarsRoute({
                        vehicles: [{ id: v.id, startPos, endPos: goalPos }],
                        baseDelayTicks: 2,
                        baseDelayMs: 3500,
                        maxCars: 2,
                        blockedCells: deadZoneSetRef.current,
                      });

                      const fullPath = result?.[v.id]?.fullPath;
                      if (!fullPath || fullPath.length < 2) {
                        const msg = `❌ ${v.id}: Không tìm thấy đường đi phù hợp (có thể bị chặn bởi vật cản).`;
                        setAlertMessage(msg);
                        setTimeout(() => setAlertMessage(""), 5000);
                        systemLog(msg);

                        const diag = aStarSearch(startPos, goalPos, false, null, deadZoneSetRef.current);
                        if (!diag || diag.length < 2) {
                          systemLog(`❌ ${v.id}: Không có đường đi từ ${formatDot(startPos)} đến ${formatDot(goalPos)} do vật cản.`);
                        }
                        return;
                      }

                      let meta = result?.[v.id]?.meta || {};
                      const delayTicks = Number(result?.[v.id]?.delayTicks ?? 0);
                      const etaGoalTicks = fullPath.length - 1 + delayTicks;
                      meta = {
                        ...meta,
                        batchId: Date.now(),
                        goalPos: goalPos ? toCsv(goalPos) : null,
                        delayTicks,
                        etaGoalTicks,
                      };

                      setVehicles((prev) =>
                        prev.map((x) =>
                          x.id === v.id ? { ...x, status: "moving", tripLog: fullPath } : x
                        )
                      );
                      addPathLog(v.id, fullPath);
                      const cargo = cargoAmounts[v.id] ?? "";
                      sendPathToBackend(v.id, fullPath, cargo, meta);
                    }}
                  />

                  <div style={{ height: 10 }} />

                  <div style={{ fontWeight: 800, color: "#e2e8f0", marginBottom: 6 }}>
                    Nhập số hàng {v.id}...
                  </div>

                  <input
                    value={cargoAmounts[v.id] ?? ""}
                    onChange={(e) => setCargoAmounts((prev) => ({ ...prev, [v.id]: e.target.value }))}
                    placeholder={`Nhập số hàng ${v.id}...`}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid rgba(148,163,184,0.18)",
                      background: "rgba(2,6,23,0.35)",
                      color: "#e2e8f0",
                      outline: "none",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                    disabled={v.status === "moving"}
                  />

                  <div style={{ marginTop: 8, color: "rgba(226,232,240,0.72)", fontSize: 12, lineHeight: 1.35 }}>
                    • Điểm về ưu tiên: 1.1 <br />
                    • Xe sau xuất phát theo delay (V2 sau V1, V3 sau V2...)
                  </div>
                </div>
              ))}
            </div>

            {/* Start Together */}
            <button
              type="button"
              onClick={handleStartTogetherSafeMulti}
              disabled={isRunningTogether}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(96,165,250,0.45)",
                background: "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))",
                color: "#e2e8f0",
                fontWeight: 900,
                letterSpacing: "0.4px",
                cursor: isRunningTogether ? "not-allowed" : "pointer",
                boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
              }}
            >
              {isRunningTogether ? "Đang chạy ..." : "Chạy cùng lúc (V1 & V2, delay tuần tự)"}
            </button>

            {alertMessage && (
              <div style={{ marginTop: 15, width: "100%" }}>
                <CollisionAlert message={alertMessage} />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ marginTop: 20, display: "flex", gap: 12, flexDirection: "column" }}>
	              <button
	                type="button"
	                onClick={() => {
	                  if (vehicles.some((v) => v.status !== "idle")) {
	                    systemLog("⚠️ Vui lòng chờ xe idle rồi mới tạo vật cản.");
	                    return;
	                  }
	                  setDeadZoneMode((m) => !m);
	                }}
	                style={{
	                  width: "100%",
	                  padding: "14px 16px",
	                  borderRadius: 14,
	                  border: "1px solid rgba(239,68,68,0.55)",
	                  background: deadZoneMode
	                    ? "linear-gradient(135deg, rgba(239,68,68,0.35), rgba(251,113,133,0.18))"
	                    : "linear-gradient(135deg, rgba(239,68,68,0.22), rgba(251,113,133,0.10))",
	                  color: "#ffe4e6",
	                  fontWeight: 900,
	                  letterSpacing: "0.4px",
	                  cursor: "pointer",
	                  boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
	                }}
	              >
	                🚧 {deadZoneMode ? "Đang tạo vật cản (click trên map)" : "Tạo vật cản"}
	              </button>

	              {deadZoneMode && (
	                <div
	                  style={{
	                    padding: 12,
	                    borderRadius: 14,
	                    border: "1px solid rgba(239,68,68,0.25)",
	                    background: "rgba(2,6,23,0.35)",
	                    boxShadow: "0 10px 22px rgba(2,6,23,0.25)",
	                  }}
	                >
	                  <div style={{ color: "rgba(226,232,240,0.8)", fontSize: 12, lineHeight: 1.35 }}>
	                    • Nhập 1 hoặc nhiều vị trí. Ví dụ: <b>2.1, 1.2</b>
	                    <br />
	                    • Hoặc click trực tiếp lên grid để bật/tắt vật cản.
	                  </div>

	                  <input
	                    value={deadZoneText}
	                    onChange={(e) => setDeadZoneText(e.target.value)}
	                    placeholder="VD: 2.1, 1.2, 3.4"
	                    style={{
	                      marginTop: 10,
	                      width: "100%",
	                      padding: 10,
	                      borderRadius: 10,
	                      border: "1px solid rgba(239,68,68,0.25)",
	                      background: "rgba(2,6,23,0.35)",
	                      color: "#e2e8f0",
	                      outline: "none",
	                      fontSize: 14,
	                      boxSizing: "border-box",
	                    }}
	                  />

	                  <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
	                    <button
	                      type="button"
	                      onClick={addDeadZonesFromText}
	                      style={{
	                        flex: 1,
	                        padding: "10px 12px",
	                        borderRadius: 12,
	                        border: "1px solid rgba(239,68,68,0.45)",
	                        background: "rgba(239,68,68,0.18)",
	                        color: "#ffe4e6",
	                        fontWeight: 900,
	                        cursor: "pointer",
	                      }}
	                    >
	                      Thêm
	                    </button>

	                    <button
	                      type="button"
	                      onClick={clearDeadZones}
	                      style={{
	                        flex: 1,
	                        padding: "10px 12px",
	                        borderRadius: 12,
	                        border: "1px solid rgba(148,163,184,0.22)",
	                        background: "rgba(148,163,184,0.08)",
	                        color: "#e2e8f0",
	                        fontWeight: 900,
	                        cursor: "pointer",
	                      }}
	                    >
	                      Xóa tất cả
	                    </button>
	                  </div>

	                  {deadZones.length > 0 ? (
	                    <div
	                      style={{
	                        marginTop: 10,
	                        padding: 10,
	                        borderRadius: 12,
	                        border: "1px solid rgba(148,163,184,0.14)",
	                        background: "rgba(15,23,42,0.25)",
	                        color: "rgba(226,232,240,0.8)",
	                        fontSize: 12,
	                        lineHeight: 1.35,
	                        wordBreak: "break-word",
	                      }}
	                    >
	                      <b>Vật cản hiện tại ({deadZones.length}):</b> {deadZones.map((k) => formatDot(k)).join(", ")}
	                    </div>
	                  ) : (
	                    <div style={{ marginTop: 10, color: "rgba(226,232,240,0.6)", fontSize: 12 }}>
	                      Chưa có vật cản.
	                    </div>
	                  )}
	                </div>
	              )}

	              {!deadZoneMode && deadZones.length > 0 && (
	                <div
	                  style={{
	                    marginTop: 6,
	                    padding: "10px 12px",
	                    borderRadius: 14,
	                    border: "1px solid rgba(239,68,68,0.22)",
	                    background: "rgba(2,6,23,0.25)",
	                    color: "rgba(254,202,202,0.85)",
	                    fontSize: 12,
	                    lineHeight: 1.35,
	                    wordBreak: "break-word",
	                  }}
	                >
	                  🚧 Vật cản ({deadZones.length}): {deadZones.map((k) => formatDot(k)).join(", ")}
	                </div>
	              )}

              <button
                onClick={handleResetApp}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(96,165,250,0.45)",
                  background: "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))",
                  color: "#e2e8f0",
                  fontWeight: 800,
                  letterSpacing: "0.4px",
                  cursor: "pointer",
                  boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
                }}
              >
                🧹 Reset App
              </button>
            </div>
          </div>

          {/* B. Log */}
          <div style={{ flex: 1, minWidth: 520 }}>
            <DeliveryLog logs={logs} blink={blink} />
          </div>
        </div>
      </div>
    </div>
  );
}
