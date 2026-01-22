// src/pages/Home.jsx
import { useState, useEffect } from "react";
import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import { useNavigate } from "react-router-dom";

import ControlPanel from "../components/ControlPanel"; // bạn đang có file này
import { aStarSearch } from "../utils/aStar";
import { planMultiCarsRoute } from "../utils/routePlanner";

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
    prevPos: null,
  };
}

export default function Home() {
  const navigate = useNavigate();

  const [alertMessage, setAlertMessage] = useState("");
  const [isRunningTogether, setIsRunningTogether] = useState(false);

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
    if (field === "startPos") return;
    moveVehicleById(vehicleId, (v) => ({ ...v, [field]: value }));
  };

  // ===== START SINGLE (A* riêng lẻ) =====
  const handleStartSingle = (vehicleId, delay = 0) => {
    setTimeout(() => {
      const current = vehicles.find((v) => v.id === vehicleId);
      if (!current) return;

      const amount = parseInt(cargoAmounts[vehicleId]);
      if (!amount || amount <= 0) {
        alert(`⚠️ Vui lòng nhập số lượng hàng cho xe ${vehicleId} > 0`);
        return;
      }
      if (current.status === "moving") return;

      // nếu có xe khác idle ở 1.1 => đẩy sang bến đỗ để tránh xe này quay về
      const others = vehicles.filter((v) => v.id !== vehicleId);
      const occupied = vehicles.map((v) => v.pos);

      const blocking = others.filter((v) => v.status !== "moving" && samePos(v.pos, HOME));
      if (blocking.length > 0) {
        for (const b of blocking) {
          const park = pickParkingSpot(occupied);
          const parkPath = aStarSearch(b.pos, park, false);
          if (parkPath && parkPath.length > 1) {
            moveVehicleById(b.id, (prev) => ({
              ...prev,
              path: parkPath.slice(1),
              status: "moving",
              tripLog: parkPath,
              activeCargo: 0,
            }));
            addLog(b.id, 0, `Di chuyển sang bến đỗ ${park[0]}.${park[1]} để tránh va chạm`);
          }
        }
      }

      // A* đi giao xong quay về 1.1
      const fullPath = aStarSearch(current.pos, current.endPos, true, HOME);
      if (!fullPath || fullPath.length < 2) {
        alert(`Xe ${vehicleId}: Không tìm thấy đường!`);
        return;
      }

      moveVehicleById(vehicleId, (prev) => ({
        ...prev,
        path: fullPath.slice(1),
        status: "moving",
        deliveries: prev.deliveries + 1,
        tripLog: fullPath,
        activeCargo: amount,
      }));

      saveTripLog(vehicleId, current.pos, current.endPos, amount, fullPath);
      addLog(vehicleId, current.deliveries + 1, fullPath);
    }, delay);
  };

  // ===== START TOGETHER (N xe) =====
  const handleStartTogetherSafeMulti = () => {
    // validate cargo + status
    for (const v of vehicles) {
      const amount = parseInt(cargoAmounts[v.id]);
      if (!amount || amount <= 0) {
        alert(`⚠️ Vui lòng nhập số lượng cho ${v.id} > 0`);
        return;
      }
      if (v.status === "moving") {
        alert("Có xe đang chạy, vui lòng chờ.");
        return;
      }
    }

    setIsRunningTogether(true);

    const planInput = vehicles.map((v, idx) => ({
      id: v.id,
      startPos: v.pos,
      endPos: v.endPos,
      // delayTicks/delayMs sẽ được set tự động theo thứ tự
    }));

    const result = planMultiCarsRoute({
      vehicles: planInput,
      baseDelayTicks: 4,
      baseDelayMs: 3500, // V2 3–4s, V3 7s, V4 10.5s, V5 14s
      maxCars: 5,
    });

    if (!result) {
      addLog("System", 0, "❌ Không tìm được lộ trình an toàn cho tất cả xe!");
      setIsRunningTogether(false);
      return;
    }

    // start theo delay
    for (const v of vehicles) {
      const amount = parseInt(cargoAmounts[v.id]);
      const pack = result[v.id];
      if (!pack) continue;

      const startFn = () => {
        moveVehicleById(v.id, (prev) => ({
          ...prev,
          path: pack.fullPath.slice(1),
          status: "moving",
          deliveries: prev.deliveries + 1,
          tripLog: pack.fullPath,
          activeCargo: amount,
        }));
        saveTripLog(v.id, v.pos, v.endPos, amount, pack.fullPath);
        addLog(v.id, (v.deliveries || 0) + 1, pack.fullPath);
      };

      if (pack.delayMs > 0) setTimeout(startFn, pack.delayMs);
      else startFn();
    }

    // clear cargo
    const cleared = {};
    for (const v of vehicles) cleared[v.id] = "";
    setCargoAmounts((prev) => ({ ...prev, ...cleared }));
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
          const nextStatus = vehicle.path.length === 1 ? "idle" : "moving";

          return {
            ...vehicle,
            prevPos: vehicle.pos,
            pos: nextPos,
            path: nextPath,
            status: nextStatus,
            activeCargo: currentCargo,
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [vehicles]);

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

    if (maxCommon > 2 && pair) setAlertMessage(`CẢNH BÁO: ${pair[0]} & ${pair[1]} trùng ${maxCommon - 2} bước!`);
    else setAlertMessage("");
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
  
    if (v.status === "moving") {
      alert(`Xe ${vehicleId} đang chạy, không thể xóa.`);
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
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <ClockDisplay />

      <h1
        style={{
          textAlign: "center",
          margin: "20px 0 40px",
          fontSize: "3rem",
          fontWeight: 800,
          background: "linear-gradient(45deg, #60a5fa, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: "0 0 30px rgba(96,165,250,0.35)",
        }}
      >
        AUTOMATION CAR DELIVERY
      </h1>

      <div
        style={{
          display: "flex",
          gap: 30,
          justifyContent: "center",
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        {/* CỘT 1: BẢN ĐỒ */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <MapGrid v1={v1} v2={v2} vehicles={vehicles} />
          <div style={{ marginTop: 18 }}>
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
    overflowY: "auto",
    paddingRight: 8,
  }}
>
{vehicles.map((v) => (
 <div key={v.id} style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
   <div style={{ fontWeight: 900, color: "#0f172a" }}>{v.id}</div>

   <button
     onClick={() => handleRemoveVehicle(v.id)}
     disabled={v.id === "V1" || v.id === "V2"}
     style={{
       padding: "6px 10px",
       borderRadius: 10,
       border: "1px solid rgba(239,68,68,0.35)",
       background: v.id === "V1" || v.id === "V2" ? "#e2e8f0" : "rgba(239,68,68,0.12)",
       color: v.id === "V1" || v.id === "V2" ? "#64748b" : "#b91c1c",
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
    <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
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
        border: "1px solid #cbd5e1",
        outline: "none",
        fontSize: 14,
        boxSizing: "border-box",
      }}
      disabled={v.status === "moving"}
    />

    <div style={{ marginTop: 8, color: "#334155", fontSize: 12, lineHeight: 1.35 }}>
      • Điểm về ưu tiên: 1.1 <br />
      • Xe sau xuất phát theo delay (V2 sau V1, V3 sau V2...)
    </div>
  </div>
))}

</div>

            {/* Start Together */}
            <button
              onClick={handleStartTogetherSafeMulti}
              disabled={isRunningTogether}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(96,165,250,0.55)",
                background: isRunningTogether
                  ? "linear-gradient(135deg, rgba(148,163,184,0.35), rgba(148,163,184,0.25))"
                  : "linear-gradient(135deg, rgba(37,99,235,0.85), rgba(14,165,233,0.65))",
                color: "#e2e8f0",
                fontWeight: 900,
                letterSpacing: "0.4px",
                cursor: isRunningTogether ? "not-allowed" : "pointer",
                boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
              }}
            >
              {isRunningTogether ? "ĐANG CHẠY..." : "CHẠY CÙNG LÚC (V1→V5, delay tuần tự)"}
            </button>

            {alertMessage && (
              <div style={{ marginTop: 15, width: "100%" }}>
                <CollisionAlert message={alertMessage} />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ marginTop: 20, display: "flex", gap: 12, flexDirection: "column" }}>
              <button
                onClick={handleManualTest}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(34,197,94,0.35)",
                  background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(96,165,250,0.15))",
                  color: "#e2e8f0",
                  fontWeight: 800,
                  letterSpacing: "0.4px",
                  cursor: "pointer",
                  boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
                }}
              >
                ✅ Test nhập kho (+10 vào 5.1)
              </button>

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
                  border: "1px solid rgba(239,68,68,0.45)",
                  background: "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(239,68,68,0.12))",
                  color: "#fee2e2",
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
