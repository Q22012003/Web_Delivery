// src/pages/Home.jsx
import { useState, useEffect } from "react";
import MapGrid from "../components/MapGrid";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import { useNavigate } from "react-router-dom";
import { planTwoCarsRoute } from "../utils/routePlanner";
import { aStarSearch } from "../utils/aStar";
import { findSafePathWithReturn } from "../utils/smartPathfinding";

const loadSavedState = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  try {
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export default function Home() {
  const [isRunningTogether, setIsRunningTogether] = useState(false);
  const [cargoAmounts, setCargoAmounts] = useState({ V1: "", V2: "" });
  const [alertMessage, setAlertMessage] = useState("");

  const navigate = useNavigate();

  // ===== RULES =====
  const HOME = [1, 1];
  const PARKING_SPOTS = [
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
  ];
  const samePos = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

  const pickParkingSpot = (occupied = []) => {
    const occ = new Set(occupied.map((p) => `${p[0]},${p[1]}`));
    for (const p of PARKING_SPOTS) {
      if (!occ.has(`${p[0]},${p[1]}`)) return p;
    }
    return PARKING_SPOTS[PARKING_SPOTS.length - 1];
  };

  // === State xe V1 ===
  const [v1, setV1] = useState(() =>
    loadSavedState("home_v1_state", {
      id: "V1",
      startPos: [1, 1], // không dùng để set nữa, giữ để tương thích state cũ
      endPos: [5, 3],
      pos: [1, 1],
      path: [],
      status: "idle",
      deliveries: 0,
      tripLog: null,
      activeCargo: 0,
    })
  );

  // === State xe V2 ===
  const [v2, setV2] = useState(() =>
    loadSavedState("home_v2_state", {
      id: "V2",
      startPos: [1, 1], // không dùng để set nữa
      endPos: [5, 5],
      pos: [1, 1],
      path: [],
      status: "idle",
      deliveries: 0,
      tripLog: null,
      activeCargo: 0,
    })
  );

  const [logs, setLogs] = useState(() => loadSavedState("home_logs", []));

  useEffect(() => {
    localStorage.setItem("home_v1_state", JSON.stringify(v1));
    localStorage.setItem("home_v2_state", JSON.stringify(v2));
    localStorage.setItem("home_logs", JSON.stringify(logs));
  }, [v1, v2, logs]);

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

  // =========================
  // START 1 XE
  // - start = vị trí hiện tại
  // - return ưu tiên 1.1
  // - nếu xe còn lại idle ở 1.1 => đẩy sang 1.2..1.5 để tránh va chạm
  // =========================
  const handleStart = (id, delay = 0) => {
    setTimeout(() => {
      const vehicle = id === "V1" ? v1 : v2;
      const setVehicle = id === "V1" ? setV1 : setV2;

      const other = id === "V1" ? v2 : v1;
      const setOther = id === "V1" ? setV2 : setV1;

      const amount = parseInt(cargoAmounts[id]);
      if (!amount || amount <= 0) {
        alert(`⚠️ Vui lòng nhập số lượng hàng cho xe ${id} > 0`);
        return;
      }
      if (vehicle.status === "moving") return;

      const startNow = vehicle.pos;

      // Nếu xe còn lại đang đứng yên ở 1.1 thì đẩy sang bến để tránh đụng lúc xe này quay về
      if (other.status !== "moving" && samePos(other.pos, HOME)) {
        const park = pickParkingSpot([startNow]);
        const parkPath = aStarSearch(other.pos, park, false);
        if (parkPath && parkPath.length > 1) {
          setOther((prev) => ({
            ...prev,
            path: parkPath.slice(1),
            status: "moving",
            tripLog: parkPath,
            activeCargo: 0,
          }));
          addLog(other.id, 0, `Di chuyển sang bến đỗ ${park[0]}.${park[1]} để tránh va chạm`);
        }
      }

      // đi giao xong -> quay về 1.1
      const fullPath = aStarSearch(startNow, vehicle.endPos, true, HOME);
      if (!fullPath || fullPath.length < 2) {
        alert(`Xe ${id}: Không tìm thấy đường!`);
        return;
      }

      setVehicle((prev) => ({
        ...prev,
        path: fullPath.slice(1),
        status: "moving",
        deliveries: prev.deliveries + 1,
        tripLog: fullPath,
        activeCargo: amount,
      }));

      saveTripLog(id, startNow, vehicle.endPos, amount, fullPath);
      addLog(id, vehicle.deliveries + 1, fullPath);
    }, delay);
  };

// =========================
// START 2 XE (ổn định)
// - V1 vẫn chạy trước (delay cho V2 giữ nguyên 3–4s)
// - Nhưng: AI VỀ 1.1 SỚM HƠN => được đỗ 1.1
// - Xe còn lại => phải đỗ 1.2..1.5
// - Cấm đi vào cell của xe đang delay (tránh tông ngay lúc xuất phát)
// =========================
const handleStartTogetherSafe = () => {
  const amount1 = parseInt(cargoAmounts.V1);
  const amount2 = parseInt(cargoAmounts.V2);

  if (!amount1 || amount1 <= 0) {
    alert("⚠️ Vui lòng nhập số lượng cho V1 > 0");
    return;
  }
  if (!amount2 || amount2 <= 0) {
    alert("⚠️ Vui lòng nhập số lượng cho V2 > 0");
    return;
  }
  if (v1.status === "moving" || v2.status === "moving") {
    alert("Xe đang chạy, vui lòng chờ.");
    return;
  }

  const result = planTwoCarsRoute({
    v1Start: v1.pos,
    v2Start: v2.pos,
    v1End: v1.endPos,
    v2End: v2.endPos,
    v2DelayMs: 3500,
    v2DelayTicks: 4,
  });

  if (!result) {
    addLog("System", 0, "❌ Không tìm được lộ trình an toàn!");
    return;
  }

  setIsRunningTogether(true);

  const v1FullPath = result.V1.fullPath;
  const v2FullPath = result.V2.fullPath;
  const v2DelayMs = result.V2.delayMs;

  // ===== START V1 (ngay) =====
  setV1((prev) => ({
    ...prev,
    path: v1FullPath.slice(1),
    status: "moving",
    deliveries: prev.deliveries + 1,
    tripLog: v1FullPath,
    activeCargo: amount1,
  }));

  // GIỮ NGUYÊN: lưu lịch sử giao + log
  saveTripLog("V1", v1.pos, v1.endPos, amount1, v1FullPath);
  addLog("V1", v1.deliveries + 1, v1FullPath);

  // ===== START V2 (delay 3–4s) =====
  setTimeout(() => {
    setV2((prev) => ({
      ...prev,
      path: v2FullPath.slice(1),
      status: "moving",
      deliveries: prev.deliveries + 1,
      tripLog: v2FullPath,
      activeCargo: amount2,
    }));

    // GIỮ NGUYÊN: lưu lịch sử giao + log
    saveTripLog("V2", v2.pos, v2.endPos, amount2, v2FullPath);
    addLog("V2", v2.deliveries + 1, v2FullPath);
  }, v2DelayMs);

  setCargoAmounts({ V1: "", V2: "" });
};

 


  // CHỈ CHO SET endPos, KHÔNG CHO SET startPos
  const updateVehicle = (id, field, value) => {
    if (field === "startPos") return; // khóa start
    const setVehicle = id === "V1" ? setV1 : setV2;
    setVehicle((prev) => ({ ...prev, [field]: value }));
  };

  // ===== Tick chạy xe =====
  useEffect(() => {
    const interval = setInterval(() => {
      [
        [v1, setV1],
        [v2, setV2],
      ].forEach(([vehicle, setVehicle]) => {
        if (vehicle.path.length > 0) {
          const nextPos = vehicle.path[0];
          const isAtDestination =
            nextPos[0] === vehicle.endPos[0] && nextPos[1] === vehicle.endPos[1];

          let currentCargo = vehicle.activeCargo;

          if (isAtDestination && currentCargo > 0) {
            updateInventoryStorage(nextPos, currentCargo, vehicle.id);
            currentCargo = 0;
          }

          setVehicle((prev) => ({
            ...prev,
            prevPos: prev.pos,
            pos: nextPos,
            path: prev.path.slice(1),
            status: prev.path.length === 1 ? "idle" : "moving",
            activeCargo: currentCargo,
          }));
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [v1.path, v2.path]);

  // cảnh báo trùng line (giữ lại)
  useEffect(() => {
    if (v1.tripLog && v2.tripLog) {
      const v1Cells = new Set(v1.tripLog.map((p) => `${p[0]},${p[1]}`));
      const v2Cells = new Set(v2.tripLog.map((p) => `${p[0]},${p[1]}`));
      const common = [...v1Cells].filter((c) => v2Cells.has(c));
      if (common.length > 2) setAlertMessage(`CẢNH BÁO: Trùng ${common.length - 2} bước di chuyển!`);
      else setAlertMessage("");
    }
  }, [v1.tripLog, v2.tripLog]);

  useEffect(() => {
    if (v1.status === "idle" && v2.status === "idle" && isRunningTogether) setIsRunningTogether(false);
  }, [v1.status, v2.status, isRunningTogether]);

  const handleResetApp = () => {
    if (confirm("Reset toàn bộ trạng thái về mặc định?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

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
{/* CỘT 1: BẢN ĐỒ */}
<div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
  <MapGrid v1={v1} v2={v2} />

  {/* 2 nút chuyển trang nằm dưới ma trận */}
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
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <UnifiedControlPanel
              v1={v1}
              v2={v2}
              cargoAmounts={cargoAmounts}
              setCargoAmounts={setCargoAmounts}
              onChange={updateVehicle}
              onStart={handleStart}
              onStartTogether={handleStartTogetherSafe}
            />

            {alertMessage && (
              <div style={{ marginTop: 15, width: "100%", maxWidth: "500px" }}>
                <CollisionAlert message={alertMessage} />
              </div>
            )}

{/* === Action Buttons (đồng bộ theme) === */}
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
            <DeliveryLog logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
