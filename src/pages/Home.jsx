// src/pages/Home.jsx
import { useState, useEffect } from "react";
import MapGrid from "../components/MapGrid";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";
import StatisticsPage from "../components/StatisticsPage"; // Thêm mới
import CollisionAlert from "../components/CollisionAlert"; // Thêm mới

import { aStarSearch } from "../utils/aStar";
import { findSafePathWithReturn } from "../utils/smartPathfinding";

export default function Home() {
  const [isRunningTogether, setIsRunningTogether] = useState(false);
  const [currentPage, setCurrentPage] = useState("home"); // Thêm mới: switch giữa home và stats
  const [cargoAmounts, setCargoAmounts] = useState({ V1: "", V2: "" }); // Thêm mới: số lượng hàng
  const [alertMessage, setAlertMessage] = useState(""); // Thêm mới: cho cảnh báo va chạm

  // === State xe V1 & V2 ===
  const [v1, setV1] = useState({
    id: "V1",
    startPos: [1, 1],
    endPos: [5, 3],
    pos: [1, 1],
    path: [],
    waitingAtEnd: false,
    status: "idle",
    deliveries: 0,
    tripLog: null,
    prevPos: null,

  });

  const [v2, setV2] = useState({
    id: "V2",
    startPos: [1, 1],
    endPos: [5, 5],
    pos: [1, 1],
    path: [],
    waitingAtEnd: false,
    status: "idle",
    deliveries: 0,
    tripLog: null,
    prevPos: null,

  });

  const [logs, setLogs] = useState([]);
  const [tick, setTick] = useState(0);

  const addLog = (id, deliveries, pathOrMessage) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let message;
    if (typeof pathOrMessage === "string") {
      message = `[${now}] System: ${pathOrMessage}`;
    } else {
      const pathStr = pathOrMessage.map((p) => `${p[0]}.${p[1]}`).join(" → ");
      message = `[${now}] Xe ${id}: ${pathStr} (lần thứ ${deliveries})`;
    }
    setLogs((prev) => [...prev, message]);
  };

  const handleStart = (id, delay = 0) => {
    setTimeout(() => {
      const vehicle = id === "V1" ? v1 : v2;
      const setVehicle = id === "V1" ? setV1 : setV2;

      if (vehicle.status === "moving") return;

      const fullPath = aStarSearch(vehicle.startPos, vehicle.endPos, true);
      if (fullPath.length === 0) {
        alert(`Xe ${id}: Không tìm thấy đường đi!`);
        return;
      }

      setVehicle({
        ...vehicle,
        pos: vehicle.startPos,
        path: fullPath.slice(1),
        status: "moving",
        deliveries: vehicle.deliveries + 1,
        tripLog: fullPath,
      });
      // Thêm mới: Lưu log
      saveTripLog(
        id,
        vehicle.startPos,
        vehicle.endPos,
        cargoAmounts[id],
        fullPath
      );
      addLog(id, vehicle.deliveries + 1, fullPath); // Giữ addLog nếu cần
    }, delay);
  };

  const handleStartTogetherSafe = () => {
    if (v1.status === "moving" || v2.status === "moving") {
      addLog("System", 0, "Có xe đang chạy! Vui lòng chờ hết chuyến.");
      return;
    }

    setIsRunningTogether(true);

    // B1: Tính đường đầy đủ cho V1 (đi + về)
    const v1FullPath = aStarSearch(v1.startPos, v1.endPos, true);
    if (!v1FullPath || v1FullPath.length < 2) {
      alert("V1: Không tìm được đường!");
      setIsRunningTogether(false);
      return;
    }

    // B2: Reserve toàn bộ đường đi + về của V1, bắt đầu từ tick 0
    const v1Reserved = new Set();
    for (let i = 1; i < v1FullPath.length; i++) {
      const pos = v1FullPath[i];
      const prev = v1FullPath[i - 1];
      const t = i; // V1 đến vị trí i vào tick i
      v1Reserved.add(`${pos[0]},${pos[1]}@${t}`);
      v1Reserved.add(`${prev[0]},${prev[1]}->${pos[0]},${pos[1]}@${t}`);
    }

    // B3: V2 tìm đường an toàn, biết trước toàn bộ V1
    //     V2 thực sự xuất phát sau 17 tick → v1StartTime = 0, nhưng V2 bắt đầu đi ở tick 17
    const v2FullPath = findSafePathWithReturn(
      v2.startPos,
      v2.endPos,
      v1Reserved,
      17, // timeOffset = 0 → V2 tính từ tick 0
      v1FullPath, // biết trước đường V1
      0, // v1StartTime = 0
      17
    );

    if (!v2FullPath || v2FullPath.length < 2) {
      addLog("System", 0, "V2 không tìm được đường an toàn!");
      setIsRunningTogether(false);
      return;
    }

    // === CẢNH BÁO VA CHẠM MẠNH MẼ HƠN ===
    const v1Cells = new Set(v1FullPath.map((p) => `${p[0]},${p[1]}`));
    const v2Cells = new Set(v2FullPath.map((p) => `${p[0]},${p[1]}`));

    const commonCells = [...v1Cells].filter((cell) => v2Cells.has(cell));

    if (commonCells.length > 2) {
      // chỉ tính điểm đầu và điểm cuối là bình thường
      setAlertMessage(
        `CẢNH BÁO VA CHẠM! Hai xe đi qua cùng ${
          commonCells.length - 2
        } ô chung!`
      );
    } else if (commonCells.length > 0) {
      // Chỉ đi chung điểm đầu/cuối → vẫn an toàn
      setAlertMessage("");
    } else {
      setAlertMessage("");
    }

    // Gửi V1 đi ngay
    setV1({
      ...v1,
      pos: v1.startPos,
      path: v1FullPath.slice(1),
      status: "moving",
      deliveries: v1.deliveries + 1,
      tripLog: v1FullPath,
    });

    // Gửi V2 đi sau đúng 1700ms = 17 tick
    setTimeout(() => {
      setV2({
        ...v2,
        pos: v2.startPos,
        path: v2FullPath.slice(1),
        status: "moving",
        deliveries: v2.deliveries + 1,
        tripLog: v2FullPath,
      });
    }, 1700);

    // Log sau chút để đẹp
    setTimeout(() => {
      addLog("V1", v1.deliveries + 1, v1FullPath);
      addLog("V2", v2.deliveries + 1, v2FullPath);
    }, 1500);

    // Thêm mới: Lưu logs
    saveTripLog("V1", v1.startPos, v1.endPos, cargoAmounts.V1, v1FullPath);
    saveTripLog("V2", v2.startPos, v2.endPos, cargoAmounts.V2, v2FullPath);
  };

  const updateVehicle = (id, field, value) => {
    const setVehicle = id === "V1" ? setV1 : setV2;
    setVehicle((prev) => {
      const updates = { ...prev, [field]: value };
      if (field === "startPos") updates.pos = value;
      if (field === "endPos" && prev.status !== "moving")
        updates.pos = prev.startPos;
      if (prev.status !== "moving") {
        updates.path = [];
        updates.status = "idle";
        updates.tripLog = null;
      }
      return updates;
    });
  };

  // Di chuyển mỗi 1s
  useEffect(() => {
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Thay toàn bộ useEffect tick hiện tại bằng:
  useEffect(() => {
    const moveVehicle = (setter, path, setVehicle) => {
      if (path.length > 0) {
        const nextPos = path[0];
        const newPath = path.slice(1);
        const status = newPath.length === 0 ? "idle" : "moving";

        setter((prev) => ({
          ...prev,
          prevPos: prev.pos,   // <— LƯU VỊ TRÍ TRƯỚC ĐÓ
          pos: nextPos,
          path: newPath,
          status,
        }));
        
      }
    };

    const v1Interval = setInterval(
      () => moveVehicle(setV1, v1.path, setV1),
      1000
    );
    const v2Interval = setInterval(
      () => moveVehicle(setV2, v2.path, setV2),
      1000
    );

    return () => {
      clearInterval(v1Interval);
      clearInterval(v2Interval);
    };
  }, [v1.path, v2.path]);

  useEffect(() => {
    if (v1.status !== "moving" && v2.status !== "moving" && isRunningTogether) {
      setIsRunningTogether(false);

      setCargoAmounts({ V1: "", V2: "" });
    }
  }, [v1.status, v2.status, isRunningTogether]);

  // Thêm mới: Function lưu log vào localStorage và gọi BE để publish lên AWS IoT
  const saveTripLog = async (id, startPos, endPos, cargo, path) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const logEntry = {
      id,
      route: `${startPos[0]},${startPos[1]} → ${endPos[0]},${endPos[1]}`,
      cargo,
      time: now,
      path: path.map((p) => `${p[0]},${p[1]}`).join(" → "),
    };

    // Lưu localStorage cho frontend persist
    const existingLogs = JSON.parse(localStorage.getItem("tripLogs") || "[]");
    localStorage.setItem(
      "tripLogs",
      JSON.stringify([...existingLogs, logEntry])
    );

    // Gọi BE để publish lên AWS IoT
    try {
      await fetch("http://localhost:3000/car/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      });
    } catch (err) {
      console.error("Lỗi lưu log lên AWS IoT:", err);
    }
  };

  return (
    <div
      style={{
        padding: 30,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
      }}
    >
      <ClockDisplay />

      <h1
        style={{
          textAlign: "center",
          marginBottom: 30,
          color: "#60a5fa",
          fontSize: "2.8rem",
          fontWeight: "bold",
          textShadow: "0 0 30px rgba(96,165,250,0.6)",
        }}
      >
        XE GIAO HÀNG TỰ ĐỘNG
      </h1>

      <div
        style={{
          display: "flex",
          gap: 60,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <MapGrid v1={v1} v2={v2} />
        <UnifiedControlPanel
          v1={v1}
          v2={v2}
          cargoAmounts={cargoAmounts}
          setCargoAmounts={setCargoAmounts}
          onChange={updateVehicle}
          onStart={handleStart}
          onStartTogether={handleStartTogetherSafe}
        />
      </div>

      {/* Thêm mới: Alert component */}
      <CollisionAlert message={alertMessage} />

      <PageSwitchButtons />

      <DeliveryLog
        logs={logs}
        v1Deliveries={v1.deliveries}
        v2Deliveries={v2.deliveries}
      />
    </div>
  );
}
