// src/pages/Home.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import ControlPanel from "../components/ControlPanel";
import { aStarSearch } from "../utils/aStar";
import { planMultiCarsRoute } from "../utils/routePlanner";
const SIDEBAR_W = 280; // đúng bằng width sidebar
const PAGE_GAP = 20;
// ===== helpers =====
const loadSavedState = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  try {
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const buildDefaultVehicles = () => ([
  makeVehicle("V1", START_SPOTS[0], [5, 3]),
  makeVehicle("V2", START_SPOTS[1], [5, 5]),
]);

const buildDefaultCargo = () => ({ V1: "", V2: "" });

const HOME = [1, 1];
const START_SPOTS = [
  [1, 1], // V1
  [1, 2], // V2
  [1, 3], // V3
  [1, 4], // V4
  [1, 5], // V5
];

const PARKING_SPOTS = [
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
];

const samePos = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const posKey = (p) => `${p[0]},${p[1]}`;

function makeVehicle(id, startPos, endPos) {
  return {
    id,
    startPos, // để tương thích UI cũ (nhưng sẽ disabled chọn start)
    endPos,
    pos: startPos,
    path: [],
    status: "idle",
    deliveries: 0,
    tripLog: null,
    activeCargo: 0,
    // IMPORTANT: prevPos dùng cho animation/hiển thị trong MapGrid.
    // Nếu để null, khi bấm chạy có thể bị "nháy" (sáng lên rồi tắt) trước khi xe thực sự di chuyển.
    prevPos: startPos,
  };
}

export default function Home() {
  const navigate = useNavigate();

  const [alertMessage, setAlertMessage] = useState("");
  const [isRunningTogether, setIsRunningTogether] = useState(false);

  const lastCollisionRef = useRef({ fp: "", t: 0 });

  // ===== vehicles: mặc định 2 xe =====
  const [vehicles, setVehicles] = useState(() =>
    loadSavedState("home_vehicles_state", buildDefaultVehicles())
  );

  const [cargoAmounts, setCargoAmounts] = useState(() =>
    loadSavedState("home_cargoAmounts", buildDefaultCargo())
  );

  const [logs, setLogs] = useState(() => loadSavedState("home_logs", []));

  useEffect(() => {
    localStorage.setItem("home_vehicles_state", JSON.stringify(vehicles));
    localStorage.setItem("home_cargoAmounts", JSON.stringify(cargoAmounts));
    localStorage.setItem("home_logs", JSON.stringify(logs));
  }, [vehicles, cargoAmounts, logs]);

  const addLog = (id, deliveries, pathOrMessage) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let message;
    if (typeof pathOrMessage === "string") {
      message = `[${now}] ${id === "System" ? "HỆ THỐNG" : id}: ${pathOrMessage}`;
    } else {
      const pathStr = pathOrMessage.map((p) => `${p[0]}.${p[1]}`).join(" → ");
      message = `[${now}] Xe ${id}: ${pathStr}`;
    }
    setLogs((prev) => [...prev, message]);
  };

  // ===== Persist alerts for Alert.jsx (legacy compatible) =====
  const appendLegacyAlertLog = (entry) => {
    try {
      const raw = localStorage.getItem("alertLogs");
      const arr = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];

      // de-dup by alertId (if provided)
      if (entry?.alertId && list.some((x) => x?.alertId === entry.alertId)) return;

      const next = [...list, entry].slice(-300);
      localStorage.setItem("alertLogs", JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const getNextDeliveryId = () => {
    const counter = parseInt(localStorage.getItem("deliveryCounter") || "0") + 1;
    localStorage.setItem("deliveryCounter", counter);
    return `DH${String(counter).padStart(4, "0")}`;
  };

  const saveTripLog = async (id, startPos, endPos, cargo, path) => {
    const deliveryId = getNextDeliveryId();
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    const logEntry = {
      deliveryId,
      vehicleId: id,
      route: `${startPos[0]},${startPos[1]} → ${endPos[0]},${endPos[1]}`,
      cargo: cargo || "Chưa nhập",
      time: now,
      path: path.map((p) => `${p[0]},${p[1]}`).join(" → "),
    };

    const existing = JSON.parse(localStorage.getItem("tripLogs") || "[]");
    localStorage.setItem("tripLogs", JSON.stringify([...existing, logEntry]));
  };

  // ===== giữ nguyên logic nhập kho của bạn =====
  const updateInventoryStorage = (destinationPos, amount, vehicleId) => {
    const destKey = `${destinationPos[0]},${destinationPos[1]}`;
    const qty = parseInt(amount);
    if (!qty || qty <= 0) return;

    const validWarehouses = ["5,1", "5,2", "5,3", "5,4", "5,5"];
    if (validWarehouses.includes(destKey)) {
      let currentStock = JSON.parse(localStorage.getItem("warehouse_stock") || "{}");
      const oldQty = currentStock[destKey] || 0;
      const newQty = oldQty + qty;
      currentStock[destKey] = newQty;

      localStorage.setItem("warehouse_stock", JSON.stringify(currentStock));

      const msg = `✅ Đã nhập kho [${destKey}]: +${qty} (Tổng: ${newQty})`;
      console.log(msg);
      addLog("System", 0, msg);
    }
  };

  const handleManualTest = () => {
    if (confirm("Test: Sẽ cộng thêm 10 đơn vị vào kho 5,1. Bạn có muốn thử không?")) {
      updateInventoryStorage([5, 1], 10, "TESTER");
      alert("Đã gửi dữ liệu! Hãy qua trang Quản lý kho kiểm tra.");
    }
  };

  // ===== utils: parking =====
  const pickParkingSpot = (occupiedPositions = []) => {
    const occ = new Set(occupiedPositions.map((p) => posKey(p)));
    for (const p of PARKING_SPOTS) if (!occ.has(posKey(p))) return p;
    return PARKING_SPOTS[PARKING_SPOTS.length - 1];
  };

  const moveVehicleById = (id, updater) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? updater(v) : v)));
  };

  // ===== ADD VEHICLE (tối đa 5) =====
  const handleAddVehicle = () => {
    setVehicles((prev) => {
      if (prev.length >= 5) {
        alert("⚠️ Tối đa 5 xe trên ma trận!");
        return prev;
      }
      const nextIndex = prev.length; // 0-based
      const newId = `V${nextIndex + 1}`;
      const startPos = START_SPOTS[nextIndex]; // V3 at 1.3, V4 at 1.4, V5 at 1.5
      const defaultEnd = [5, Math.min(5, nextIndex + 1)]; // gợi ý 5.3/5.4/5.5...
      const next = [...prev, makeVehicle(newId, startPos, defaultEnd)];
      // init cargo key
      setCargoAmounts((c) => ({ ...c, [newId]: "" }));
      addLog("System", 0, `➕ Đã thêm xe ${newId} tại ${startPos[0]}.${startPos[1]}`);
      return next;
    });
  };

  // ===== UPDATE endPos only (lock startPos) =====
  const updateVehicle = (vehicleId, field, value) => {
    // Khi đang chạy chế độ nhiều xe thì khoá chỉnh route để tránh lệch state
    if (isRunningTogether) return;

    // Nếu xe không idle thì cũng khoá chỉnh (tránh đổi endPos trong lúc xe đang chạy/đợi)
    const current = vehicles.find((v) => v.id === vehicleId);
    if (current && current.status !== "idle") return;

    const f = String(field || "").toLowerCase();
    // 🔒 user chỉ thấy vị trí bắt đầu, không được chỉnh
    if (f === "startpos" || f.startsWith("start")) return;
    moveVehicleById(vehicleId, (v) => ({ ...v, [field]: value }));
  };

  // ===== START SINGLE (A* riêng lẻ) =====
  const handleStartSingle = (vehicleId, delay = 0) => {
    // Nếu đang chạy chế độ nhiều xe thì chặn start lẻ để tránh state bị chồng
    if (isRunningTogether) {
      alert("Đang chạy chế độ nhiều xe, vui lòng chờ tất cả xe dừng rồi hãy chạy lẻ.");
      return;
    }

    setTimeout(() => {
      const current = vehicles.find((v) => v.id === vehicleId);
      if (!current) return;

      const amount = parseInt(cargoAmounts[vehicleId]);
      if (!amount || amount <= 0) {
        alert(`⚠️ Vui lòng nhập số lượng hàng cho xe ${vehicleId} > 0`);
        return;
      }
      // Chỉ cho chạy khi xe đang idle (tránh double-start)
      if (current.status !== "idle") return;

      // xác định điểm về: ưu tiên HOME (user = 1.1). Nếu HOME đang bị chiếm, xe sẽ về bến đỗ khác
      const others = vehicles.filter((v) => v.id !== vehicleId);
      const occupied = others.map((v) => v.pos);

      const homeOccupied = others.some((v) => samePos(v.pos, HOME));
      const returnSpot = homeOccupied ? pickParkingSpot(occupied) : HOME;

      if (homeOccupied) {
        addLog(
          "System",
          0,
          `🏁 ${vehicleId} sẽ không về 1.1 (đang có xe khác), chuyển về bến đỗ ${returnSpot[0]}.${returnSpot[1]}`
        );
      }

      // A* đi giao xong quay về điểm ưu tiên (HOME hoặc bến đỗ thay thế)
      const fullPath = aStarSearch(current.pos, current.endPos, true, returnSpot);
      if (!fullPath || fullPath.length < 2) {
        alert(`Xe ${vehicleId}: Không tìm thấy đường!`);
        return;
      }

      moveVehicleById(vehicleId, (prev) => ({
        ...prev,
        path: fullPath.slice(1),
        status: "moving",
        // tránh nháy UI: coi như xe đang đứng yên tại pos hiện tại cho tới khi tick đầu tiên thực sự đổi ô
        prevPos: prev.pos,
        deliveries: prev.deliveries + 1,
        tripLog: fullPath,
        activeCargo: amount,
      }));

      saveTripLog(vehicleId, current.pos, current.endPos, amount, fullPath);
      addLog(vehicleId, current.deliveries + 1, fullPath);
    }, delay);
  };

  // ===== START TOGETHER (N xe) =====
      // 1) Chỉ chọn xe đã có endPos (được cấu hình điểm đến)

  const handleStartTogetherSafeMulti = () => {
        try {
            // 1) Chỉ chọn xe đã có endPos (được cấu hình điểm đến)
            const selected = vehicles.filter(
              (v) => Array.isArray(v.endPos) && v.endPos.length === 2
            );
      
            if (selected.length === 0) {
              alert("⚠️ Chưa chọn điểm đến cho xe nào (endPos).");
              return;
            }
      
            // 2) Nếu có bất kỳ xe nào đang chạy/đợi thì chặn
            if (vehicles.some((v) => v.status !== "idle")) {
              alert("Có xe đang chạy, vui lòng chờ.");
              return;
            }
      
            // 3) Validate cargo CHỈ cho các xe selected
            for (const v of selected) {
              const amount = parseInt(cargoAmounts[v.id]);
              if (!amount || amount <= 0) {
                alert(`⚠️ Vui lòng nhập số lượng cho ${v.id} > 0`);
                return;
              }
            }
      
            const planInput = selected.map((v) => ({
              id: v.id,
              startPos: v.pos,
              endPos: v.endPos,
            }));
      
            // ✅ Chỉ set running sau khi planner chạy OK (tránh kẹt nút nếu planner throw)
            const result = planMultiCarsRoute({
              vehicles: planInput,
              baseDelayTicks: 4,
              baseDelayMs: 4000,
              maxCars: 5,
            });
      
            if (!result) {
              addLog("System", 0, "❌ Không tìm được lộ trình an toàn cho tất cả xe!");
              return;
            }
      
            setIsRunningTogether(true);

// ===== START CÙNG LÚC - delay bằng WAIT STEPS theo delayTicks =====
const ordered = [...selected].sort(
  (a, b) => parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10)
);

ordered.forEach((v) => {
  const amount = parseInt(cargoAmounts[v.id]);
  const pack = result[v.id];
  if (!pack || !pack.fullPath || pack.fullPath.length < 2) return;

  const delayTicks = pack.delayTicks || 0;
  const startCell = pack.fullPath[0];

  // WAIT = đứng yên tại startCell đúng số tick planner đã dùng để reserve
  const waitSteps = Array.from({ length: delayTicks }, () => [...startCell]);

  // vehicle.path là danh sách "nextPos" mỗi tick (có thể trùng để đứng yên)
  const runPath = [...waitSteps, ...pack.fullPath.slice(1)];

  moveVehicleById(v.id, (prev) => ({
    ...prev,
    path: runPath,
    // Nếu có delayTicks thì coi là "đang đợi" để UI không nháy sáng rồi tắt.
    // Khi tới tick đầu tiên mà xe thật sự đổi ô thì status sẽ tự chuyển sang "moving" trong vòng tick loop.
    status: delayTicks > 0 ? "waiting" : "moving",
    // tránh "nháy" icon: giữ prevPos = pos hiện tại ngay khi start (đặc biệt quan trọng khi delayTicks > 0)
    prevPos: prev.pos,
    deliveries: prev.deliveries + 1,
    tripLog: runPath,         // log đúng timeline thực chạy
    activeCargo: amount,
  }));

  saveTripLog(v.id, v.pos, v.endPos, amount, runPath);
  addLog(v.id, (v.deliveries || 0) + 1, runPath);
});

    // clear cargo (chỉ clear xe selected)
          // clear cargo (chỉ clear xe selected)
          const cleared = {};
          for (const v of selected) cleared[v.id] = "";
          setCargoAmounts((prev) => ({ ...prev, ...cleared }));
    
        } catch (err) {
          console.error("[handleStartTogetherSafeMulti] ERROR:", err);
          alert(`❌ Lỗi khi planMultiCarsRoute: ${err?.message || err}`);
          addLog("System", 0, `❌ Lỗi planner: ${err?.message || err}`);
          setIsRunningTogether(false); // ✅ đảm bảo không bị kẹt nút
        }
  };

  // ===== Tick chạy xe (N xe) =====
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles((prev) =>
        prev.map((vehicle) => {
          if (!vehicle.path || vehicle.path.length === 0) return vehicle;

          const nextPos = vehicle.path[0];
          const isAtDestination =
            nextPos[0] === vehicle.endPos[0] && nextPos[1] === vehicle.endPos[1];

          let currentCargo = vehicle.activeCargo;
          if (isAtDestination && currentCargo > 0) {
            updateInventoryStorage(nextPos, currentCargo, vehicle.id);
            currentCargo = 0;
          }

          const nextPath = vehicle.path.slice(1);
          const nextIsIdle = vehicle.path.length === 1;
          const isWaitingStep = samePos(nextPos, vehicle.pos);

          // Quy ước status:
          // - idle    : không còn path
          // - waiting : còn path nhưng tick này đứng yên (delay / WAIT step)
          // - moving  : đang đổi ô
          const nextStatus = nextIsIdle ? "idle" : isWaitingStep ? "waiting" : "moving";

          const updated = {
            ...vehicle,
            prevPos: vehicle.pos,
            pos: nextPos,
            path: nextPath,
            status: nextStatus,
            activeCargo: currentCargo,
          };

          // ✅ Khi xe dừng (kết thúc chuyến), cập nhật vị trí xuất phát mới để ControlPanel hiển thị đúng
          if (nextIsIdle) {
            updated.startPos = nextPos;
          }

          return updated;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ===== Simple collision warning (đa xe) =====
  useEffect(() => {
    // cảnh báo nếu nhiều xe có tripLog trùng quá nhiều cell (naive)
    const tripLogs = vehicles.filter((v) => v.tripLog && v.tripLog.length > 0);
    if (tripLogs.length < 2) {
      setAlertMessage("");
      return;
    }

    let maxCommon = 0;
    let pair = null;

    for (let i = 0; i < tripLogs.length; i++) {
      for (let j = i + 1; j < tripLogs.length; j++) {
        const a = tripLogs[i];
        const b = tripLogs[j];
        const aSet = new Set(a.tripLog.map((p) => `${p[0]},${p[1]}`));
        const bSet = new Set(b.tripLog.map((p) => `${p[0]},${p[1]}`));
        const common = [...aSet].filter((c) => bSet.has(c));
        if (common.length > maxCommon) {
          maxCommon = common.length;
          pair = [a.id, b.id];
        }
      }
    }

    if (maxCommon > 2 && pair) {
      const msg = `CẢNH BÁO: ${pair[0]} & ${pair[1]} trùng ${maxCommon - 2} bước!`;
      setAlertMessage(msg);

      // Lưu cảnh báo va chạm sang localStorage để trang Alert.jsx đọc được (ghi 1 lần theo fingerprint + cooldown)
      const fp = `COLL|${pair[0]}|${pair[1]}|${maxCommon}`;
      const nowMs = Date.now();
      if (lastCollisionRef.current.fp !== fp || nowMs - lastCollisionRef.current.t > 15000) {
        try {
          const va = tripLogs.find((v) => v.id === pair[0]);
          const vb = tripLogs.find((v) => v.id === pair[1]);
          const aSet = new Set((va?.tripLog || []).map((p) => `${p[0]},${p[1]}`));
          const overlapKeys = (vb?.tripLog || []).map((p) => `${p[0]},${p[1]}`).filter((k) => aSet.has(k));
          const overlapText = overlapKeys
            .slice(0, 12)
            .map((k) => k.split(",").map((n) => Number(n)).join("."))
            .join(" → ");

          const timeText = new Date().toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          appendLegacyAlertLog({
            type: "Cảnh báo va chạm",
            description: overlapText ? `${msg} | Trùng: ${overlapText}` : msg,
            vehicleId: `${pair[0]},${pair[1]}`,
            route:
              (va?.endPos ? `${pair[0]}→${va.endPos[0]}.${va.endPos[1]}` : `${pair[0]}→-`) +
              " | " +
              (vb?.endPos ? `${pair[1]}→${vb.endPos[0]}.${vb.endPos[1]}` : `${pair[1]}→-`),
            alertId: fp,
            time: timeText,
            createdAt: new Date().toISOString(),
          });

          lastCollisionRef.current = { fp, t: nowMs };
        } catch {
          // ignore
        }
      }
    } else setAlertMessage("");
  }, [vehicles]);

  useEffect(() => {
    if (isRunningTogether) {
      const allIdle = vehicles.every((v) => v.status === "idle");
      if (allIdle) setIsRunningTogether(false);
    }
  }, [vehicles, isRunningTogether]);

  const handleResetApp = () => {
    if (!confirm("Reset toàn bộ trạng thái về mặc định (2 xe V1, V2)?")) return;
  
    // clear các key bạn đang lưu
    localStorage.removeItem("home_vehicles_state");
    localStorage.removeItem("home_cargoAmounts");
    localStorage.removeItem("home_logs");
    localStorage.removeItem("deliveryCounter");
    localStorage.removeItem("tripLogs");
    localStorage.removeItem("warehouse_stock");
  
    // reset state tại chỗ (không cần reload)
    setVehicles(buildDefaultVehicles());
    setCargoAmounts(buildDefaultCargo());
    setLogs([]);
  
    setIsRunningTogether(false);
    setAlertMessage("");
  };

  const handleRemoveVehicle = (vehicleId) => {
    // Nếu bạn muốn cho phép xóa cả V1/V2 thì bỏ block này.
    if (vehicleId === "V1" || vehicleId === "V2") {
      alert("Không thể xóa V1/V2. Bạn có thể Reset App để về mặc định.");
      return;
    }
  
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
  
    if (v.status !== "idle") {
      alert(`Xe ${vehicleId} đang chạy/đợi, không thể xóa.`);
      return;
    }
  
    if (!confirm(`Bạn chắc chắn muốn xóa xe ${vehicleId} không?`)) return;
  
    // Xóa xe khỏi danh sách
    setVehicles((prev) => prev.filter((x) => x.id !== vehicleId));
  
    // Xóa cargo của xe đó
    setCargoAmounts((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
  
    addLog("System", 0, `🗑️ Đã xóa xe ${vehicleId}`);
  };
  
  // ===== Map props: giữ v1/v2 để tương thích MapGrid cũ =====
  const v1 = vehicles.find((v) => v.id === "V1");
  const v2 = vehicles.find((v) => v.id === "V2");

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
 {/* HEADER – title bên trái, thời gian ở giữa (nhỏ vừa khung) */}
<div
  style={{
    position: "relative",
    marginBottom: 22,
    padding: "12px 18px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))",
    backdropFilter: "blur(8px)",
    height: 74, // ✅ thấp hơn để giống “khung xanh” ban đầu
  }}
>
  {/* LEFT: REALTIME + sub */}
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
    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.8 }}>
    </div>
    <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 600, opacity: 0.75 }}>
    </div>
  </div>

  {/* CENTER: time + system (nhỏ vừa khung) */}
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
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "space-between", height: "calc(100vh - 180px)", minHeight: "720px", maxHeight: "900px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>

            <MapGrid v1={v1} v2={v2} vehicles={vehicles} />

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
 <div key={v.id} style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))", borderRadius: 14, padding: 14, border: "1px solid rgba(148,163,184,0.14)", boxShadow: "0 10px 22px rgba(2,6,23,0.35)" }}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
   <div style={{ fontWeight: 900, color: "#e2e8f0" }}>{v.id}</div>

   <button
     onClick={() => handleRemoveVehicle(v.id)}
     disabled={v.id === "V1" || v.id === "V2"}
     style={{
       padding: "6px 10px",
       borderRadius: 10,
       border: "1px solid rgba(239,68,68,0.35)",
       background: v.id === "V1" || v.id === "V2" ? "rgba(148,163,184,0.18)" : "rgba(239,68,68,0.12)",
       color: v.id === "V1" || v.id === "V2" ? "rgba(226,232,240,0.55)" : "#fecaca",
       fontWeight: 800,
       cursor: v.id === "V1" || v.id === "V2" ? "not-allowed" : "pointer",
     }}
   >
     ✖ Xóa
   </button>
 </div>
    {/* --- ControlPanel (giữ nguyên) --- */}
    <ControlPanel
      vehicle={v}
      onChange={(field, value) => updateVehicle(v.id, field, value)}
      onStart={() => handleStartSingle(v.id, 0)}
    />

    {/* --- Divider --- */}
    <div style={{ height: 10 }} />

    {/* --- Cargo --- */}
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
      disabled={v.status !== "idle"}
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
                background: isRunningTogether
                  ? "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))"
                  : "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))",
                color: "#e2e8f0",
                fontWeight: 900,
                letterSpacing: "0.4px",
                cursor: isRunningTogether ? "not-allowed" : "pointer",
                boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
              }}
            >
              {isRunningTogether ? "Đang chạy ..." : "Chạy cùng lúc (V1→V5, delay tuần tự)"}
            </button>

            {alertMessage && (
              <div style={{ marginTop: 15, width: "100%" }}>
                <CollisionAlert message={alertMessage} />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ marginTop: 20, display: "flex", gap: 12, flexDirection: "column" }}>
            

              <button
                onClick={() => navigate("/warehouse")}
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
                📦 Qua trang Quản lý kho
              </button>

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
            <DeliveryLog logs={logs} v1Deliveries={v1?.deliveries || 0} v2Deliveries={v2?.deliveries || 0} />
          </div>
        </div>
      </div>
    </div>
  );
}