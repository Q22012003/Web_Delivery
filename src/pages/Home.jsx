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

export default function Home() {
  const [isRunningTogether, setIsRunningTogether] = useState(false);
  const [cargoAmounts, setCargoAmounts] = useState({ V1: "", V2: "" });
  const [alertMessage, setAlertMessage] = useState("");

  const navigate = useNavigate();

  // === State xe V1 & V2 ===
  const [v1, setV1] = useState({
    id: "V1",
    startPos: [1, 1],
    endPos: [5, 3],
    pos: [1, 1],
    path: [],
    status: "idle",
    deliveries: 0,
    tripLog: null,
  });

  const [v2, setV2] = useState({
    id: "V2",
    startPos: [1, 1],
    endPos: [5, 5],
    pos: [1, 1],
    path: [],
    status: "idle",
    deliveries: 0,
    tripLog: null,
  });

  const [logs, setLogs] = useState([]);

  // === TẠO MÃ CHUYẾN HÀNG TỰ ĐỘNG (DH0001, DH0002...) ===
  const getNextDeliveryId = () => {
    const counter = parseInt(localStorage.getItem("deliveryCounter") || "0") + 1;
    localStorage.setItem("deliveryCounter", counter);
    return `DH${String(counter).padStart(4, "0")}`;
  };

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

    // Gửi backend với error handling
    try {
      await fetch("http://localhost:3000/car/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error("Lỗi gửi log đến backend:", error);
      // Optional: addLog("System", 0, "Lỗi kết nối backend!");
    }
  };

  const handleStart = (id, delay = 0) => {
    setTimeout(() => {
      const vehicle = id === "V1" ? v1 : v2;
      const setVehicle = id === "V1" ? setV1 : setV2;

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
      }));

      saveTripLog(id, vehicle.startPos, vehicle.endPos, cargoAmounts[id], fullPath);
      addLog(id, vehicle.deliveries + 1, fullPath); // Sửa: dùng vehicle.deliveries + 1
    }, delay);
  };

  const handleStartTogetherSafe = () => {
    if (v1.status === "moving" || v2.status === "moving") {
      addLog("System", 0, "Có xe đang chạy! Vui lòng chờ hết chuyến.");
      return;
    }
  
    setIsRunningTogether(true);
  
    const v1FullPath = aStarSearch(v1.startPos, v1.endPos, true);
    if (!v1FullPath || v1FullPath.length < 2) {
      alert("V1: Không tìm được đường!");
      setIsRunningTogether(false);
      return;
    }
  
    // Tạo reserved từ đường đi của V1
    const v1Reserved = new Set();
    for (let i = 1; i < v1FullPath.length; i++) {
      const pos = v1FullPath[i];
      const prev = v1FullPath[i - 1];
      const t = i;
      v1Reserved.add(`${pos[0]},${pos[1]}@${t}`);
      v1Reserved.add(`${prev[0]},${prev[1]}->${pos[0]},${pos[1]}@${t}`);
    }
  
    // Kiểm tra xem V2 có cùng điểm xuất phát với V1 không
    const sameStartPos = v2.startPos[0] === v1.startPos[0] && v2.startPos[1] === v1.startPos[1];
  
    // Nếu cùng điểm xuất phát → delay V2 để tránh chồng xe ban đầu
    // Nếu khác điểm → cho chạy ngay (timeOffset = 0)
    const v2TimeOffset = sameStartPos ? 17 : 0; // 17 ticks ~ 1700ms
  
    const v2FullPath = findSafePathWithReturn(
      v2.startPos,
      v2.endPos,
      v1Reserved,
      v2TimeOffset,        // <-- Đây là thay đổi chính
      v1FullPath,
      0,
      17
    );
  
    if (!v2FullPath || v2FullPath.length < 2) {
      addLog("System", 0, "V2 không tìm được đường an toàn!");
      setIsRunningTogether(false);
      return;
    }
  
    // === V1 luôn chạy ngay ===
    setV1((prev) => ({
      ...prev,
      pos: v1.startPos,
      path: v1FullPath.slice(1),
      status: "moving",
      deliveries: prev.deliveries + 1,
      tripLog: v1FullPath,
    }));
  
    // === V2 chạy ngay hoặc delay tùy trường hợp ===
    const v2DelayMs = sameStartPos ? 1700 : 0;
  
    setTimeout(() => {
      setV2((prev) => ({
        ...prev,
        pos: v2.startPos,
        path: v2FullPath.slice(1),
        status: "moving",
        deliveries: prev.deliveries + 1,
        tripLog: v2FullPath,
      }));
    }, v2DelayMs);
  
    // Ghi log
    saveTripLog("V1", v1.startPos, v1.endPos, cargoAmounts.V1, v1FullPath);
    setTimeout(() => {
      saveTripLog("V2", v2.startPos, v2.endPos, cargoAmounts.V2, v2FullPath);
    }, v2DelayMs);
  
    addLog("V1", v1.deliveries + 1, v1FullPath);
    setTimeout(() => addLog("V2", v2.deliveries + 1, v2FullPath), v2DelayMs + 100);
  
    // Reset cargo sau khi xong
    setCargoAmounts({ V1: "", V2: "" });
  };

  const updateVehicle = (id, field, value) => {
    const setVehicle = id === "V1" ? setV1 : setV2;
    setVehicle((prev) => {
      const updates = { ...prev, [field]: value };
      if (field === "startPos") updates.pos = value;
      if (field === "endPos" && prev.status !== "moving") updates.pos = prev.startPos;
      if (prev.status !== "moving") {
        updates.path = [];
        updates.status = "idle";
        updates.tripLog = null;
      }
      return updates;
    });
  };

  // === DI CHUYỂN XE (SỬA SYNTAX LỖI ITERABLE) ===
  useEffect(() => {
    const interval = setInterval(() => {
      [[v1, setV1], [v2, setV2]].forEach(([vehicle, setVehicle]) => {
        if (vehicle.path.length > 0) {
          const nextPos = vehicle.path[0];
          setVehicle((prev) => ({
            ...prev,
            prevPos: prev.pos,
            pos: nextPos,
            path: prev.path.slice(1),
            status: prev.path.length === 1 ? "idle" : "moving",
          }));
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [v1.path, v2.path]);

  // === FIX: CẢNH BÁO VA CHẠM MỖI LẦN CHẠY CÙNG NHAU ===
  useEffect(() => {
    if (v1.tripLog && v2.tripLog) {
      const v1Cells = new Set(v1.tripLog.map((p) => `${p[0]},${p[1]}`));
      const v2Cells = new Set(v2.tripLog.map((p) => `${p[0]},${p[1]}`));
      const common = [...v1Cells].filter((c) => v2Cells.has(c));

      if (common.length > 2) {
        setAlertMessage(`CẢNH BÁO VA CHẠM! Trùng ${common.length - 2} ô chung (ngoài đầu/cuối)!`);
      } else {
        setAlertMessage("");
      }
    }
  }, [v1.tripLog, v2.tripLog]);

  // Reset khi xong
  useEffect(() => {
    if (v1.status === "idle" && v2.status === "idle" && isRunningTogether) {
      setIsRunningTogether(false);
      setCargoAmounts({ V1: "", V2: "" });
    }
  }, [v1.status, v2.status, isRunningTogether]);

  return (
    <div
      style={{
        padding: "30px 40px",
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
          margin: "20px 0 40px",
          color: "#60a5fa",
          fontSize: "3rem",
          fontWeight: "bold",
          textShadow: "0 0 30px rgba(96,165,250,0.6)",
        }}
      >
        XE GIAO HÀNG TỰ ĐỘNG
      </h1>

      <div style={{ display: "flex", gap: 60, justifyContent: "center", flexWrap: "wrap" }}>
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

      <CollisionAlert message={alertMessage} />

      <DeliveryLog logs={logs} v1Deliveries={v1.deliveries} v2Deliveries={v2.deliveries} />

      {/* Nút chuyển qua trang Real-time */}
      <PageSwitchButtons />
    </div>
  );
}
