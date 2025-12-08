// src/pages/RealTime.jsx
import { useState, useEffect, useRef } from "react";
import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import UnifiedControlPanel from "../components/UnifiedControlPanel"; // Dùng chung với Home
import io from "socket.io-client";

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function RealTime() {
  const [vehicles, setVehicles] = useState({
    V1: { id: "V1", pos: [1, 1], status: "idle" },
    V2: { id: "V2", pos: [1, 1], status: "idle" },
  });

  const [cargoAmounts, setCargoAmounts] = useState({ V1: "", V2: "" });
  const [alertMessage, setAlertMessage] = useState("");
  const [blink, setBlink] = useState(false);
  const socketRef = useRef(null);

  // === Kết nối Socket.IO để nhận vị trí live từ xe thật ===
  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL);

    socketRef.current.on("connect", () => {
      console.log("RealTime - Đã kết nối Socket.IO server");
    });

    socketRef.current.on("car:position", (data) => {
      console.log("Vị trí thực tế nhận được:", data);

      const targetVehicle = data.device_id.includes("01") ? "V1" : "V2";

      setVehicles((prev) => ({
        ...prev,
        [targetVehicle]: {
          ...prev[targetVehicle],
          pos: data.position,
          status: "moving",
        },
      }));

      // Tự động về idle sau 3s nếu không có cập nhật mới
      setTimeout(() => {
        setVehicles((prev) => ({
          ...prev,
          [targetVehicle]: { ...prev[targetVehicle], status: "idle" },
        }));
      }, 3000);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Hiệu ứng nhấp nháy LIVE
  useEffect(() => {
    const interval = setInterval(() => setBlink((prev) => !prev), 1500);
    return () => clearInterval(interval);
  }, []);

  // === GỬI LỆNH ĐIỀU KHIỂN XUỐNG XE THẬT QUA BACKEND ===
  const sendCommandToCar = async (vehicleId, startPos, endPos, cargo) => {
    const command = {
      device_id: vehicleId === "V1" ? "car01" : "car02", // tùy theo định danh MCU của bạn
      command: "start_delivery",
      start_pos: startPos,
      end_pos: endPos,
      cargo: cargo || "0",
      timestamp: new Date().toISOString(),
    };

    try {
      // Gửi qua HTTP (nếu backend có API)
      await fetch("http://localhost:5000/api/car/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });

      // Gửi qua Socket.IO (nếu backend đang listen)
      socketRef.current?.emit("command:car", command);

      setAlertMessage(`${vehicleId} đã nhận lệnh giao hàng!`);
      setTimeout(() => setAlertMessage(""), 5000);
    } catch (err) {
      console.error("Lỗi gửi lệnh:", err);
      setAlertMessage("Lỗi kết nối đến xe!");
      setTimeout(() => setAlertMessage(""), 5000);
    }
  };

  // === XỬ LÝ NÚT BẮT ĐẦU RIÊNG LẺ ===
  const handleStart = (id) => {
    const vehicle = vehicles[id];
    const cargo = cargoAmounts[id] || "0";

    if (vehicle.status === "moving") {
      setAlertMessage(`${id} đang di chuyển!`);
      return;
    }

    sendCommandToCar(id, vehicle.pos, vehicle.pos, cargo); // hoặc dùng startPos/endPos từ panel
  };

  // === XỬ LÝ CHẠY CÙNG LÚC ===
  const handleStartTogether = () => {
    if (vehicles.V1.status === "moving" || vehicles.V2.status === "moving") {
      setAlertMessage("Có xe đang chạy! Vui lòng đợi.");
      setTimeout(() => setAlertMessage(""), 4000);
      return;
    }

    // Gửi lệnh cho cả 2 xe
    sendCommandToCar("V1", vehicles.V1.pos, vehicles.V1.pos, cargoAmounts.V1);
    setTimeout(() => {
      sendCommandToCar("V2", vehicles.V2.pos, vehicles.V2.pos, cargoAmounts.V2);
    }, 800); // Delay nhẹ để tránh xung đột lệnh

    setCargoAmounts({ V1: "", V2: "" });
  };

  // === CẬP NHẬT VỊ TRÍ XUẤT PHÁT / KẾT THÚC (chỉ để hiển thị, không dùng để mô phỏng) ===
  const updateVehicle = (id, field, value) => {
    setVehicles((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

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
      <ClockDisplay />

      <h1
        style={{
          textAlign: "center",
          margin: "40px 0 20px",
          color: "#34d399",
          fontSize: "3.4rem",
          fontWeight: "bold",
          textShadow: "0 0 40px rgba(52,211,153,0.5)",
        }}
      >
        CHẾ ĐỘ ĐIỀU KHIỂN THỰC TẾ
      </h1>

      <p style={{ textAlign: "center", fontSize: "1.5rem", color: "#94a3b8", marginBottom: 40 }}>
        Điều khiển xe thật trực tiếp • Vị trí cập nhật thời gian thực
      </p>

      {/* LIVE Indicator */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: blink ? "#ef4444" : "#991b1b",
          color: "white",
          padding: "12px 28px",
          borderRadius: 30,
          fontWeight: "bold",
          fontSize: "1.1rem",
          boxShadow: "0 0 30px rgba(239,68,68,0.8)",
          animation: blink ? "pulse 1.5s infinite" : "none",
        }}
      >
        ● LIVE
      </div>

      {/* Layout: Bản đồ + Bảng điều khiển */}
      <div style={{ display: "flex", gap: 60, justifyContent: "center", flexWrap: "wrap", marginTop: 30 }}>
        <MapGrid v1={vehicles.V1} v2={vehicles.V2} />

        {/* Dùng lại UnifiedControlPanel đẹp như trang Home */}
        <UnifiedControlPanel
          v1={vehicles.V1}
          v2={vehicles.V2}
          cargoAmounts={cargoAmounts}
          setCargoAmounts={setCargoAmounts}
          onChange={updateVehicle}
          onStart={handleStart}
          onStartTogether={handleStartTogether}
          disableAll={false} // Có thể thêm logic kiểm tra kết nối nếu cần
        />
      </div>

      {/* Trạng thái hiện tại */}
      <div
        style={{
          textAlign: "center",
          marginTop: 50,
          padding: "25px",
          background: "rgba(52,211,153,0.15)",
          borderRadius: 16,
          maxWidth: 800,
          margin: "50px auto",
          border: "1px solid rgba(52,211,153,0.3)",
        }}
      >
        <p style={{ fontSize: "1.4rem", color: "#94f0c5" }}>
          Trạng thái xe thật (cập nhật live)
        </p>
        <p style={{ color: "#cbd5e1", marginTop: 10 }}>
          V1: [{vehicles.V1.pos.join(", ")}] → {vehicles.V1.status === "moving" ? "Đang di chuyển" : "Dừng"}
          <br />
          V2: [{vehicles.V2.pos.join(", ")}] → {vehicles.V2.status === "moving" ? "Đang di chuyển" : "Dừng"}
        </p>
      </div>

      <CollisionAlert message={alertMessage} />
      <PageSwitchButtons />
    </div>
  );
}