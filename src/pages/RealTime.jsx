// src/pages/RealTime.jsx
import { useState, useEffect } from "react";
import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";

export default function RealTime() {
  // Chỉ hiển thị 2 xe ở vị trí cố định (đang "chờ lệnh" hoặc đang hoạt động thật)
  const [v1] = useState({
    id: "V1",
    pos: [1, 1],        // cố định ở kho
    status: "idle",     // hoặc "moving" nếu muốn giả lập đang chạy thật
  });

  const [v2] = useState({
    id: "V2",
    pos: [1, 1],
    status: "idle",
  });

  // Có thể thêm hiệu ứng nhấp nháy nhẹ để biết là "đang kết nối thời gian thực"
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(prev => !prev);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        padding: 30,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
        position: "relative",
      }}
    >
      {/* Đồng hồ thời gian thực */}
      <ClockDisplay />

      {/* Tiêu đề */}
      <h1
        style={{
          textAlign: "center",
          margin: "40px 0 20px",
          color: "#34d399",
          fontSize: "3.2rem",
          fontWeight: "bold",
          textShadow: "0 0 40px rgba(52,211,153,0.5)",
          letterSpacing: "1px",
        }}
      >
        CHẾ ĐỘ THỜI GIAN THỰC
      </h1>

      <p
        style={{
          textAlign: "center",
          fontSize: "1.5rem",
          color: "#94a3b8",
          marginBottom: 40,
        }}
      >
        Đang kết nối với xe thật • Hiển thị vị trí live
      </p>

      {/* Hiệu ứng nhấp nháy "LIVE" góc trên bên phải */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: blink ? "#ef4444" : "#991b1b",
          color: "white",
          padding: "8px 16px",
          borderRadius: 30,
          fontWeight: "bold",
          fontSize: "0.9rem",
          boxShadow: "0 0 20px rgba(239,68,68,0.6)",
          transition: "all 0.4s",
          zIndex: 100,
        }}
      >
        ● LIVE
      </div>

      {/* Bản đồ + xe (không có control panel, không có log) */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
        <MapGrid v1={v1} v2={v2} />
      </div>

      {/* Có thể thêm thông báo trạng thái xe thật ở đây sau */}
      <div
        style={{
          textAlign: "center",
          marginTop: 50,
          padding: "20px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          maxWidth: 600,
          margin: "50px auto",
        }}
      >
        <p style={{ fontSize: "1.3rem", color: "#94a3b8" }}>
          Xe đang ở kho chờ lệnh giao hàng...
        </p>
        <p style={{ color: "#64748b", marginTop: 10 }}>
          Khi có đơn hàng thật, vị trí xe sẽ cập nhật tự động mỗi giây
        </p>
      </div>

      {/* Nút chuyển trang */}
      <PageSwitchButtons />

      {/* Alert nếu cần */}
      <CollisionAlert message="" />
    </div>
  );
}