// src/pages/Home.jsx
import { useState, useEffect } from "react";
import MapGrid from "../components/MapGrid";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import { useNavigate } from "react-router-dom";

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

  // === State xe V1 ===
  const [v1, setV1] = useState(() =>
    loadSavedState("home_v1_state", {
      id: "V1",
      startPos: [1, 1],
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
      startPos: [1, 1],
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

  const updateInventoryStorage = (destinationPos, amount, vehicleId) => {
    const destKey = `${destinationPos[0]},${destinationPos[1]}`;
    const qty = parseInt(amount);

    if (!qty || qty <= 0) return;

    const validWarehouses = ["5,1", "5,2", "5,3", "5,4", "5,5"];

    if (validWarehouses.includes(destKey)) {
      let currentStock = JSON.parse(
        localStorage.getItem("warehouse_stock") || "{}"
      );
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
    if (
      confirm(
        "Test: Sẽ cộng thêm 10 đơn vị vào kho 5,1 (Điện tử). Bạn có muốn thử không?"
      )
    ) {
      updateInventoryStorage([5, 1], 10, "TESTER");
      alert("Đã gửi dữ liệu! Hãy qua trang Quản lý kho kiểm tra.");
    }
  };

  const getNextDeliveryId = () => {
    const counter =
      parseInt(localStorage.getItem("deliveryCounter") || "0") + 1;
    localStorage.setItem("deliveryCounter", counter);
    return `DH${String(counter).padStart(4, "0")}`;
  };

  const addLog = (id, deliveries, pathOrMessage) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let message;
    if (typeof pathOrMessage === "string") {
      message = `[${now}] ${
        id === "System" ? "HỆ THỐNG" : id
      }: ${pathOrMessage}`;
    } else {
      const pathStr = pathOrMessage.map((p) => `${p[0]}.${p[1]}`).join(" → ");
      message = `[${now}] Xe ${id}: ${pathStr}`;
    }
    setLogs((prev) => [...prev, message]);
  };

  const saveTripLog = async (id, startPos, endPos, cargo, path) => {
    const deliveryId = getNextDeliveryId();
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });

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

  const handleStart = (id, delay = 0) => {
    setTimeout(() => {
      const vehicle = id === "V1" ? v1 : v2;
      const setVehicle = id === "V1" ? setV1 : setV2;

      const amountInput = cargoAmounts[id];
      const amount = parseInt(amountInput);

      if (!amount || amount <= 0) {
        alert(`⚠️ Vui lòng nhập số lượng hàng cho xe ${id} > 0`);
        return;
      }

      if (vehicle.status === "moving") return;

      const fullPath = aStarSearch(vehicle.startPos, vehicle.endPos, true);
      if (!fullPath || fullPath.length < 2) {
        alert(`Xe ${id}: Không tìm thấy đường!`);
        return;
      }

      setVehicle((prev) => ({
        ...prev,
        pos: vehicle.startPos,
        path: fullPath.slice(1),
        status: "moving",
        deliveries: prev.deliveries + 1,
        tripLog: fullPath,
        activeCargo: amount,
      }));

      saveTripLog(id, vehicle.startPos, vehicle.endPos, amount, fullPath);
      addLog(id, vehicle.deliveries + 1, fullPath);
    }, delay);
  };

  const handleStartTogetherSafe = () => {
    if (!cargoAmounts.V1 || !cargoAmounts.V2) {
      alert("Vui lòng nhập số lượng cho CẢ 2 XE!");
      return;
    }
    if (v1.status === "moving" || v2.status === "moving") {
      alert("Xe đang chạy, vui lòng chờ.");
      return;
    }

    setIsRunningTogether(true);

    const v1FullPath = aStarSearch(v1.startPos, v1.endPos, true);
    if (!v1FullPath) return;

    const v1Reserved = new Set();
    for (let i = 1; i < v1FullPath.length; i++) {
      const pos = v1FullPath[i];
      v1Reserved.add(`${pos[0]},${pos[1]}@${i}`);
    }
    const sameStartPos =
      v2.startPos[0] === v1.startPos[0] && v2.startPos[1] === v1.startPos[1];
    const v2TimeOffset = sameStartPos ? 17 : 0;
    const v2FullPath = findSafePathWithReturn(
      v2.startPos,
      v2.endPos,
      v1Reserved,
      v2TimeOffset,
      v1FullPath,
      0,
      17
    );

    if (!v2FullPath) {
      addLog("System", 0, "V2 không tìm được đường an toàn!");
      setIsRunningTogether(false);
      return;
    }

    setV1((prev) => ({
      ...prev,
      pos: v1.startPos,
      path: v1FullPath.slice(1),
      status: "moving",
      deliveries: prev.deliveries + 1,
      tripLog: v1FullPath,
      activeCargo: parseInt(cargoAmounts.V1),
    }));

    const v2DelayMs = sameStartPos ? 1700 : 0;
    setTimeout(() => {
      setV2((prev) => ({
        ...prev,
        pos: v2.startPos,
        path: v2FullPath.slice(1),
        status: "moving",
        deliveries: prev.deliveries + 1,
        tripLog: v2FullPath,
        activeCargo: parseInt(cargoAmounts.V2),
      }));
    }, v2DelayMs);

    saveTripLog("V1", v1.startPos, v1.endPos, cargoAmounts.V1, v1FullPath);
    setTimeout(() => {
      saveTripLog("V2", v2.startPos, v2.endPos, cargoAmounts.V2, v2FullPath);
    }, v2DelayMs);

    addLog("V1", v1.deliveries + 1, v1FullPath);
    setTimeout(
      () => addLog("V2", v2.deliveries + 1, v2FullPath),
      v2DelayMs + 100
    );

    setCargoAmounts({ V1: "", V2: "" });
  };

  const updateVehicle = (id, field, value) => {
    const setVehicle = id === "V1" ? setV1 : setV2;
    setVehicle((prev) => {
      const updates = { ...prev, [field]: value };
      if (field === "startPos") updates.pos = value;
      return updates;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      [
        [v1, setV1],
        [v2, setV2],
      ].forEach(([vehicle, setVehicle]) => {
        if (vehicle.path.length > 0) {
          const nextPos = vehicle.path[0];
          const isLastStep = vehicle.path.length === 1;
          const isAtDestination =
            nextPos[0] === vehicle.endPos[0] &&
            nextPos[1] === vehicle.endPos[1];

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
            status: isLastStep ? "idle" : "moving",
            activeCargo: currentCargo,
          }));
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [v1.path, v2.path]);

  useEffect(() => {
    if (v1.tripLog && v2.tripLog) {
      const v1Cells = new Set(v1.tripLog.map((p) => `${p[0]},${p[1]}`));
      const v2Cells = new Set(v2.tripLog.map((p) => `${p[0]},${p[1]}`));
      const common = [...v1Cells].filter((c) => v2Cells.has(c));
      if (common.length > 2) {
        setAlertMessage(`CẢNH BÁO: Trùng ${common.length - 2} bước di chuyển!`);
      } else {
        setAlertMessage("");
      }
    }
  }, [v1.tripLog, v2.tripLog]);

  useEffect(() => {
    if (v1.status === "idle" && v2.status === "idle" && isRunningTogether) {
      setIsRunningTogether(false);
    }
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


      {/* --- PHẦN LAYOUT CHÍNH (ĐÃ SỬA) --- */}
      <div
        style={{
          display: "flex",
          gap: 30,
          justifyContent: "center",
          alignItems: "stretch", // QUAN TRỌNG: Ép các cột con phải cao bằng nhau (bằng chiều cao MapGrid)
          flexWrap: "wrap",
        }}
      >
        {/* CỘT 1: BẢN ĐỒ */}
        <div style={{ flex: "0 0 auto" }}>
          <MapGrid v1={v1} v2={v2} />
        </div>

        {/* CỘT 2: CONTROLS & LOG */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 25,
            alignItems: "stretch",
    height: "600px",
            // Đã xóa height: "600px" để nó tự stretch theo cột map
          }}
        >
          {/* A. Bảng điều khiển */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
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

            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 10,
                flexDirection: "column",
              }}
            >
              <button
                onClick={handleManualTest}
                style={{
                  padding: "10px",
                  background: "#3b82f6",
                  border: "none",
                  color: "white",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                🛠️ Test Kết Nối Kho
              </button>
              <button
                onClick={handleResetApp}
                style={{
                  padding: "10px",
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                🗑️ Reset Hệ Thống
              </button>
            </div>
          </div>

          {/* B. Nhật ký: Luôn full chiều cao của cột cha */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <DeliveryLog
              logs={logs}
              v1Deliveries={v1.deliveries}
              v2Deliveries={v2.deliveries}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <PageSwitchButtons />
      </div>
    </div>
  );
}
