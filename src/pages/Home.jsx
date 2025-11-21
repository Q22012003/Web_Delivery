// src/pages/Home.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MapGrid from "../components/MapGrid";
import UnifiedControlPanel from "../components/UnifiedControlPanel"; // Import new component
import { aStarSearch } from "../utils/aStar";
import {
  isValidCell,
  findSafePathWithTimeOffset,
  findSafePathFast,
  findSafePathWithReturn,
} from "../utils/smartPathfinding";

export default function Home() {
  // === Đồng hồ thời gian thực ===
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () =>
    currentTime.toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const formatDate = () =>
    currentTime.toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  // === State xe V1 ===
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
  });

  // === State xe V2 ===
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
  });

  const [logs, setLogs] = useState([]);
  const [tick, setTick] = useState(0);

  const formatPos = (pos) => `${pos[0]}.${pos[1]}`;
  const getPathString = (path) => path.map(formatPos).join(" → ");

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
    }, delay);
  };

  const handleStartTogetherSafe = () => {
    if (v1.status === "moving" || v2.status === "moving") {
      addLog("System", 0, "Có xe đang chạy! Vui lòng chờ hết chuyến.");
      return;
    }

    // BƯỚC 1: Tính đường KHỨ HỒI đầy đủ cho V1 (đi + về) bằng A* chuẩn
    const v1FullPath = aStarSearch(v1.startPos, v1.endPos, true);
    if (!v1FullPath || v1FullPath.length < 2) {
      alert("V1: Không tìm được đường!");
      return;
    }

    // Đánh dấu toàn bộ ô mà V1 chiếm theo thời gian (t=1 trở đi mới chiếm, t=0 cho phép chồng start)
    const reservedByV1 = new Set();
    v1FullPath.forEach((pos, t) => {
      if (t > 0) reservedByV1.add(`${pos[0]},${pos[1]}@${t}`);
    });

    // BƯỚC 2: V2 tìm đường KHỨ HỒI AN TOÀN với timeOffset = 2 → né tuyệt đối
    const v2FullPath = findSafePathWithReturn(
      v2.startPos,
      v2.endPos,
      reservedByV1,
      2
    );

    if (!v2FullPath || v2FullPath.length < 2) {
      addLog(
        "System",
        0,
        "V2 không tìm được đường an toàn để về nhà! Thử đổi đích."
      );
      return;
    }

    addLog(
      "System",
      0,
      "CHẠY ĐÔI THÀNH CÔNG – V2 CHẬM HƠN 2 BƯỚC, TỰ VỀ NHÀ ĐẸP!"
    );

    // Khởi động V1 ngay lập tức
    setV1({
      ...v1,
      pos: v1.startPos,
      path: v1FullPath.slice(1),
      status: "moving",
      deliveries: v1.deliveries + 1,
      tripLog: v1FullPath,
    });

    // V2 chạy chậm hơn 1600ms (2 bước ở tốc độ 800ms/bước → an toàn tuyệt đối)
    setTimeout(() => {
      setV2({
        ...v2,
        pos: v2.startPos,
        path: v2FullPath.slice(1),
        status: "moving",
        deliveries: v2.deliveries + 1,
        tripLog: v2FullPath,
      });
    }, 1600);

    // Ghi log đẹp
    setTimeout(() => {
      addLog("V1", v1.deliveries + 1, v1FullPath);
      addLog("V2", v2.deliveries + 1, v2FullPath);
    }, 1800);
  };

  // Thay hàm updateVehicle trong Home.jsx bằng cái này:
  const updateVehicle = (id, field, value) => {
    const setVehicle = id === "V1" ? setV1 : setV2;
    setVehicle((prev) => {
      const updates = { ...prev, [field]: value };

      // CẬP NHẬT pos NGAY LẬP TỨC nếu là startPos HOẶC endPos
      if (field === "startPos") {
        updates.pos = value;
      }
      if (field === "endPos" && prev.status !== "moving") {
        updates.pos = prev.startPos; // giữ nguyên nếu đang di chuyển
      }

      // Reset path nếu đang idle hoặc waiting_at_end
      if (prev.status !== "moving") {
        updates.path = [];
        updates.status = "idle";
        updates.tripLog = null;
      }

      return updates;
    });
  };

  // === Di chuyển xe mỗi 800ms ===

  useEffect(() => {
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Di chuyển V1
    setV1((prev) => {
      if (prev.path.length === 0) return prev;
      const nextPos = prev.path[0];
      const newPath = prev.path.slice(1);
      const status = newPath.length === 0 ? "waiting_at_end" : "moving";
      return { ...prev, pos: nextPos, path: newPath, status };
    });

    // Di chuyển V2
    setV2((prev) => {
      if (prev.path.length === 0) return prev;
      const nextPos = prev.path[0];
      const newPath = prev.path.slice(1);
      const status = newPath.length === 0 ? "waiting_at_end" : "moving";
      return { ...prev, pos: nextPos, path: newPath, status };
    });
  }, [tick]);

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
      {/* Đồng hồ thời gian thực */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          style={{
            fontSize: "3.8rem",
            fontWeight: "bold",
            color: "#60a5fa",
            textShadow: "0 0 30px rgba(96,165,250,0.6)",
          }}
        >
          {formatTime()}
        </div>
        <div style={{ fontSize: "1.6rem", color: "#94a3b8" }}>
          {formatDate()} • LINE Logistics System
        </div>
      </div>

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
          onChange={updateVehicle}
          onStart={handleStart}
          onStartTogether={handleStartTogetherSafe}
        />
      </div>

      {/* 2 nút chuyển trang – fix kích thước bằng nhau, responsive */}
      <div
        style={{
          textAlign: "center",
          margin: "50px 0",
          display: "flex",
          justifyContent: "center",
          gap: "40px",
          flexWrap: "wrap",
        }}
      >
        <Link to="/">
          <button
            style={{
              width: "clamp(180px, 22vw, 260px)",
              aspectRatio: "3 / 1",
              fontSize: "clamp(1rem, 1.4vw, 1.4rem)",
              background: "rgba(96,165,250,0.15)",
              color: "#60a5fa",
              border: "2px solid rgba(96,165,250,0.4)",
              borderRadius: 14,
              fontWeight: "bold",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              boxShadow: "0 0 25px rgba(96,165,250,0.25)",
              transition: "0.2s",
            }}
          >
            MÔ PHỎNG
          </button>
        </Link>

        <Link to="/real-time">
          <button
            style={{
              width: "clamp(180px, 22vw, 260px)",
              aspectRatio: "3 / 1",
              fontSize: "clamp(1rem, 1.4vw, 1.4rem)",
              background: "rgba(52,211,153,0.15)", // Xanh lá nhạt
              color: "#34d399", // Xanh lá chữ
              border: "2px solid rgba(52,211,153,0.4)", // Viền xanh lá nhạt
              borderRadius: 14,
              fontWeight: "bold",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              boxShadow: "0 0 25px rgba(52,211,153,0.25)", // Shadow xanh lá
              transition: "0.2s",
            }}
          >
            CHẠY THỜI GIAN THỰC
          </button>
        </Link>
      </div>

      {/* Nhật ký giao hàng */}
      <div
        style={{
          marginTop: 50,
          background: "#1e293b",
          padding: 25,
          borderRadius: 16,
          maxWidth: 1100,
          margin: "50px auto",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <h2 style={{ color: "#34d399", marginBottom: 15, fontSize: "1.8rem" }}>
          NHẬT KÝ GIAO HÀNG
        </h2>
        <div
          style={{
            background: "#0f172a",
            padding: 20,
            borderRadius: 12,
            fontFamily: "Consolas, monospace",
            height: 260,
            overflowY: "auto",
            border: "1px solid #334155",
          }}
        >
          {logs.length === 0 ? (
            <p style={{ color: "#94a3b8", fontStyle: "italic" }}>
              Chưa có chuyến giao hàng nào...
            </p>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ marginBottom: 8, color: "#a5f3fc" }}>
                {log}
              </div>
            ))
          )}
        </div>
        <div
          style={{
            marginTop: 15,
            color: "#94a3b8",
            fontSize: "1.1rem",
            textAlign: "center",
          }}
        >
          V1: <strong style={{ color: "#ff6b6b" }}>{v1.deliveries}</strong> lần
          giao  |   V2:{" "}
          <strong style={{ color: "#51cf66" }}>{v2.deliveries}</strong> lần giao
        </div>
      </div>
    </div>
  );
}
