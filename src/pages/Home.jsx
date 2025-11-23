// src/pages/Home.jsx
import { useState, useEffect } from "react";
import MapGrid from "../components/MapGrid";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";

import { aStarSearch } from "../utils/aStar";
import {
  findSafePathWithReturn,
} from "../utils/smartPathfinding";

export default function Home() {
  // === State xe V1 & V2 ===
  const [v1, setV1] = useState({
    id: "V1", startPos: [1, 1], endPos: [5, 3], pos: [1, 1],
    path: [], waitingAtEnd: false, status: "idle", deliveries: 0, tripLog: null,
  });

  const [v2, setV2] = useState({
    id: "V2", startPos: [1, 1], endPos: [5, 5], pos: [1, 1],
    path: [], waitingAtEnd: false, status: "idle", deliveries: 0, tripLog: null,
  });

  const [logs, setLogs] = useState([]);
  const [tick, setTick] = useState(0);

  const addLog = (id, deliveries, pathOrMessage) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    let message;
    if (typeof pathOrMessage === "string") {
      message = `[${now}] System: ${pathOrMessage}`;
    } else {
      const pathStr = pathOrMessage.map(p => `${p[0]}.${p[1]}`).join(" → ");
      message = `[${now}] Xe ${id}: ${pathStr} (lần thứ ${deliveries})`;
    }
    setLogs(prev => [...prev, message]);
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
    }, delay);
  };

  const handleStartTogetherSafe = () => {
    if (v1.status === "moving" || v2.status === "moving") {
      addLog("System", 0, "Có xe đang chạy! Vui lòng chờ hết chuyến.");
      return;
    }

    const v1FullPath = aStarSearch(v1.startPos, v1.endPos, true);
    if (!v1FullPath || v1FullPath.length < 2) {
      alert("V1: Không tìm được đường!");
      return;
    }

    const reservedByV1 = new Set();
    v1FullPath.forEach((pos, t) => {
      if (t > 0) reservedByV1.add(`${pos[0]},${pos[1]}@${t}`);
    });

    const v2FullPath = findSafePathWithReturn(v2.startPos, v2.endPos, reservedByV1, 2);
    if (!v2FullPath || v2FullPath.length < 2) {
      addLog("System", 0, "V2 không tìm được đường an toàn để về nhà! Thử đổi đích.");
      return;
    }

    addLog("System", 0, "CHẠY ĐÔI THÀNH CÔNG – V2 CHẬM HƠN 2 BƯỚC, TỰ VỀ NHÀ ĐẸP!");

    setV1({ ...v1, pos: v1.startPos, path: v1FullPath.slice(1), status: "moving", deliveries: v1.deliveries + 1, tripLog: v1FullPath });

    setTimeout(() => {
      setV2({ ...v2, pos: v2.startPos, path: v2FullPath.slice(1), status: "moving", deliveries: v2.deliveries + 1, tripLog: v2FullPath });
    }, 1600);

    setTimeout(() => {
      addLog("V1", v1.deliveries + 1, v1FullPath);
      addLog("V2", v2.deliveries + 1, v2FullPath);
    }, 1800);
  };

  const updateVehicle = (id, field, value) => {
    const setVehicle = id === "V1" ? setV1 : setV2;
    setVehicle(prev => {
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

  // Di chuyển mỗi 1s
  useEffect(() => {
    const interval = setInterval(() => setTick(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    [v1, setV1, v2, setV2].forEach((vehicle, i) => {
      const setter = i === 0 ? setV1 : i === 2 ? setV2 : null;
      if (!setter || vehicle.path.length === 0) return;
      const nextPos = vehicle.path[0];
      const newPath = vehicle.path.slice(1);
      const status = newPath.length === 0 ? "waiting_at_end" : "moving";
      setter(prev => ({ ...prev, pos: nextPos, path: newPath, status }));
    });
  }, [tick]);

  return (
    <div style={{
      padding: 30,
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      minHeight: "100vh",
      fontFamily: "Segoe UI, sans-serif",
      color: "#e2e8f0",
    }}>
      <ClockDisplay />

      <h1 style={{
        textAlign: "center",
        marginBottom: 30,
        color: "#60a5fa",
        fontSize: "2.8rem",
        fontWeight: "bold",
        textShadow: "0 0 30px rgba(96,165,250,0.6)",
      }}>
        XE GIAO HÀNG TỰ ĐỘNG
      </h1>

      <div style={{ display: "flex", gap: 60, justifyContent: "center", flexWrap: "wrap" }}>
        <MapGrid v1={v1} v2={v2} />
        <UnifiedControlPanel
          v1={v1}
          v2={v2}
          onChange={updateVehicle}
          onStart={handleStart}
          onStartTogether={handleStartTogetherSafe}
        />
      </div>

      <PageSwitchButtons />

      <DeliveryLog
        logs={logs}
        v1Deliveries={v1.deliveries}
        v2Deliveries={v2.deliveries}
      />
    </div>
  );
}