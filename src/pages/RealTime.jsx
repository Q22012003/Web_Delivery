// src/pages/RealTime.jsx
import { useState, useEffect, useRef } from "react";
import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import io from "socket.io-client";

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function RealTime() {
  const [vehicles, setVehicles] = useState({
    V1: { id: "V1", pos: [1, 1], status: "idle" },
    V2: { id: "V2", pos: [1, 1], status: "idle" },
  });

  const [blink, setBlink] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Kết nối Socket.IO
    socketRef.current = io(SOCKET_SERVER_URL);

    socketRef.current.on("connect", () => {
      console.log("Frontend connected to Socket.IO server");
    });

    // Nhận vị trí mới từ xe thật
    socketRef.current.on("car:position", (data) => {
      console.log("NHẬN ĐƯỢC VỊ TRÍ TỪ BACKEND:", data);
      console.log("Real-time position update:", data);

      // Xác định xe nào đang gửi (có thể mở rộng sau)
      const targetVehicle = data.device_id.includes("01") ? "V1" : "V2";

      setVehicles(prev => ({
        ...prev,
        [targetVehicle]: {
          ...prev[targetVehicle],
          pos: data.position,
          status: "moving",
        }
      }));

      // Tự động chuyển về idle sau 2s (tùy chọn)
      setTimeout(() => {
        setVehicles(prev => ({
          ...prev,
          [targetVehicle]: { ...prev[targetVehicle], status: "idle" }
        }));
      }, 2000);
    });

    // Cleanup
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Hiệu ứng nhấp nháy LIVE
  useEffect(() => {
    const interval = setInterval(() => setBlink(prev => !prev), 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      padding: 30,
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      minHeight: "100vh",
      fontFamily: "Segoe UI, sans-serif",
      color: "#e2e8f0",
      position: "relative",
    }}>
      <ClockDisplay />

      <h1 style={{
        textAlign: "center",
        margin: "40px 0 20px",
        color: "#34d399",
        fontSize: "3.2rem",
        fontWeight: "bold",
        textShadow: "0 0 40px rgba(52,211,153,0.5)",
      }}>
        CHẾ ĐỘ THỜI GIAN THỰC
      </h1>

      <p style={{ textAlign: "center", fontSize: "1.5rem", color: "#94a3b8", marginBottom: 40 }}>
        Đang nhận vị trí trực tiếp từ xe thật
      </p>

      {/* LIVE indicator */}
      <div style={{
        position: "absolute",
        top: 20,
        right: 20,
        background: blink ? "#ef4444" : "#991b1b",
        color: "white",
        padding: "10px 20px",
        borderRadius: 30,
        fontWeight: "bold",
        fontSize: "1rem",
        boxShadow: "0 0 30px rgba(239,68,68,0.8)",
        animation: blink ? "pulse 1.5s infinite" : "none",
      }}>
        ● LIVE
      </div>

      {/* Bản đồ với vị trí live */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
        <MapGrid v1={vehicles.V1} v2={vehicles.V2} />
      </div>

      {/* Thông báo trạng thái */}
      <div style={{
        textAlign: "center",
        marginTop: 50,
        padding: "25px",
        background: "rgba(52,211,153,0.15)",
        borderRadius: 16,
        maxWidth: 700,
        margin: "50px auto",
        border: "1px solid rgba(52,211,153,0.3)",
      }}>
        <p style={{ fontSize: "1.4rem", color: "#94f0c5" }}>
          Đang nhận dữ liệu vị trí thời gian thực từ xe
        </p>
        <p style={{ color: "#94a3b8", marginTop: 10 }}>
          Vị trí hiện tại: {vehicles.V1.pos.join(", ")} → {vehicles.V2.pos.join(", ")}
        </p>
      </div>

      <PageSwitchButtons />
      <CollisionAlert message="" />
    </div>
  );
}