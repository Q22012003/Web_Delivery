// src/pages/Home.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MapGrid from "../components/MapGrid";
import UnifiedControlPanel from "../components/UnifiedControlPanel"; // Import new component
import { aStarSearch } from "../utils/aStar";
import {
  isValidCell,
  findSafePathWithTimeOffset,
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

  // Trong handleStartTogether()
  // THAY TOÀN BỘ hàm handleStartTogether() trong Home.jsx bằng cái này:
  const handleStartTogether = () => {
    if (v1.status === "moving" || v2.status === "moving") {
      addLog("System", 0, "Đang có xe chạy rồi! Chờ chút nhé...");
      return;
    }
  
    addLog("System", 0, "HOÀN HẢO TUYỆT ĐỐI: V2 dừng ở 5.1 chờ V1 đến 5.3 → V2 đi tiếp → Cả 2 về an toàn!");
  
    // BƯỚC 1: Lấy đường đi đầy đủ (đi + về) như chạy riêng
    const v1FullPath = aStarSearch(v1.startPos, v1.endPos, true);
    const v2FullPath = aStarSearch(v2.startPos, v2.endPos, true);
  
    if (!v1FullPath || !v2FullPath || v1FullPath.length < 4 || v2FullPath.length < 4) {
      alert("Không tìm được đường!");
      return;
    }
  
    // BƯỚC 2: Tìm thời điểm V1 đến đích (5.3)
    const v1ArriveIdx = v1FullPath.findIndex(p => p[0] === v1.endPos[0] && p[1] === v1.endPos[1]);
    if (v1ArriveIdx === -1) return alert("Lỗi V1");
  
    // BƯỚC 3: Kiểm tra xem V2 có đi ngang dòng 5 và cắt qua đích của V1 không?
    const v2EndCol = v2.endPos[1];
    const v1EndCol = v1.endPos[1];
    const v2GoesThroughBottomRow = v2FullPath.some(p => p[0] === 5);
    const v2CrossesV1Dest = v2EndCol > v1EndCol; // V2 đi từ trái sang phải, cắt qua cột của V1
  
    let v1FinalPath = [...v1FullPath];
    let v2FinalPath = [...v2FullPath];
    let v2WaitAt51 = 0;
  
    if (v2GoesThroughBottomRow && v2CrossesV1Dest && v1EndCol >= 2 && v1EndCol <= 4) {
      // TRƯỜNG HỢP NGUY HIỂM: V2 đi ngang dòng 5 và cắt qua đích V1 (ví dụ 5.1 → 5.4, V1 đang ở 5.3)
      addLog("System", 0, "PHÁT HIỆN NGUY HIỂM: V2 đi ngang cắt V1 → BẮT V2 DỪNG Ở 5.1 ĐỢI!");
  
      // Tìm thời điểm V2 đến ô 5.1
      const v2At51Index = v2FullPath.findIndex(p => p[0] === 5 && p[1] === 1);
      if (v2At51Index === -1) {
        // Nếu không có 5.1 thì dừng ở ô đầu dòng 5
        const firstBottom = v2FullPath.findIndex(p => p[0] === 5);
        if (firstBottom !== -1) v2At51Index = firstBottom;
      }
  
      if (v2At51Index !== -1) {
        // V2 phải DỪNG ở 5.1 cho đến khi V1 đến đích
        v2WaitAt51 = Math.max(0, v1ArriveIdx - v2At51Index + 2); // +2 để chắc chắn V1 đã "đóng" 5.3
  
        const waitPos = v2FullPath[v2At51Index];
        const waitingSegment = Array(v2WaitAt51).fill(waitPos);
  
        // Chèn đoạn chờ vào đúng vị trí
        v2FinalPath = [
          ...v2FullPath.slice(0, v2At51Index + 1),
          ...waitingSegment,
          ...v2FullPath.slice(v2At51Index + 1)
        ];
  
        addLog("System", 0, `V2 dừng ${v2WaitAt51} bước tại ${formatPos(waitPos)} → nhường V1 đến ${formatPos(v1.endPos)} trước`);
      }
    }
  
    // BƯỚC 4: Đồng bộ thời gian khởi động
    const v1StartTime = v1ArriveIdx;
    const v2EffectiveTime = v2FinalPath.findIndex(p => 
      p[0] === v2.endPos[0] && p[1] === v2.endPos[1]
    );
  
    const offset = Math.max(0, v1StartTime - (v2EffectiveTime - v2WaitAt51));
  
    // Log
    addLog("V1", v1.deliveries + 1, v1FinalPath);
    addLog("V2", v2.deliveries + 1, v2FinalPath);
  
    // KHỞI ĐỘNG
    setV1(prev => ({
      ...prev,
      pos: v1.startPos,
      path: v1FinalPath.slice(1),
      status: "moving",
      tripLog: v1FinalPath,
      deliveries: prev.deliveries + 1,
    }));
  
    setTimeout(() => {
      setV2(prev => ({
        ...prev,
        pos: v2.startPos,
        path: v2FinalPath.slice(1),
        status: "moving",
        tripLog: v2FinalPath,
        deliveries: prev.deliveries + 1,
      }));
    }, offset * 800);
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
          onStartTogether={handleStartTogether}
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
