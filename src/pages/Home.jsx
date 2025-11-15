// src/pages/Home.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MapGrid from "../components/MapGrid";
import ControlPanel from "../components/ControlPanel";
import { aStarSearch } from "../utils/aStar";

export default function Home() {
  // === Đồng hồ thời gian thực ===
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () => currentTime.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const formatDate = () => currentTime.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });

  // === State xe V1 ===
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

  // === State xe V2 ===
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

  const formatPos = (pos) => `${pos[0]}.${pos[1]}`;
  const getPathString = (path) => path.map(formatPos).join(" → ");

  const addLog = (id, deliveries, path) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const pathStr = getPathString(path);
    setLogs((prev) => [...prev, `[${now}] Xe ${id}: ${pathStr} (lần thứ ${deliveries})`]);
  };

  const handleStart = (id) => {
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
  };

  const updateVehicle = (id, field, value) => {
    const setVehicle = id === "V1" ? setV1 : setV2;
    setVehicle((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "startPos" && prev.status === "idle" ? { pos: value } : {}),
    }));
  };

  // === Di chuyển xe mỗi 800ms ===
  useEffect(() => {
    const interval = setInterval(() => {
      [v1, v2].forEach((vehicle, i) => {
        const setVehicle = i === 0 ? setV1 : setV2;

        setVehicle((prev) => {
          if (prev.status !== "moving" || prev.path.length === 0) {
            if (prev.tripLog && prev.pos[0] === 1 && prev.pos[1] === 1) {
              addLog(prev.id, prev.deliveries, prev.tripLog);
            }
            return { ...prev, status: "idle", tripLog: null };
          }

          const nextPos = prev.path[0];
          const remainingPath = prev.path.slice(1);

          return {
            ...prev,
            pos: nextPos,
            path: remainingPath,
            status: remainingPath.length > 0 ? "moving" : "idle",
          };
        });
      });
    }, 800);

    return () => clearInterval(interval);
  }, [v1, v2]);

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
        <div style={{ fontSize: "3.8rem", fontWeight: "bold", color: "#60a5fa", textShadow: "0 0 30px rgba(96,165,250,0.6)" }}>
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

      <div style={{ display: "flex", gap: 60, justifyContent: "center", flexWrap: "wrap" }}>
        <MapGrid v1={v1} v2={v2} />

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <ControlPanel vehicle={v1} onChange={(f, v) => updateVehicle("V1", f, v)} onStart={() => handleStart("V1")} />
          <ControlPanel vehicle={v2} onChange={(f, v) => updateVehicle("V2", f, v)} onStart={() => handleStart("V2")} />
        </div>
      </div>

      {/* 2 nút chuyển trang */}
      <div style={{ textAlign: "center", margin: "50px 0" }}>
        <Link to="/">
          <button
            style={{
              padding: "16px 40px",
              fontSize: "1.4rem",
              background: "#4ade80",
              color: "white",
              border: "none",
              borderRadius: 14,
              fontWeight: "bold",
              margin: "0 20px",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(74,222,128,0.4)",
            }}
          >
            MÔ PHỎNG A*
          </button>
        </Link>

        <Link to="/real-time">
          <button
            style={{
              padding: "16px 40px",
              fontSize: "1.4rem",
              background: "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: 14,
              fontWeight: "bold",
              margin: "0 20px",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(245,158,11,0.4)",
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
          V1: <strong style={{ color: "#ff6b6b" }}>{v1.deliveries}</strong> lần giao  |   V2:{" "}
          <strong style={{ color: "#51cf66" }}>{v2.deliveries}</strong> lần giao
        </div>
      </div>
    </div>
  );
}