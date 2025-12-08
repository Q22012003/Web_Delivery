// src/pages/RealTime.jsx
import { useState, useEffect, useRef } from "react";
import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import DeliveryLog from "../components/DeliveryLog"; // Thêm component này
import io from "socket.io-client";

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function RealTime() {
  const [vehicles, setVehicles] = useState({
    V1: { id: "V1", pos: [1, 1], status: "idle" },
    V2: { id: "V2", pos: [1, 1], status: "idle" },
  });

  const [cargoAmounts, setCargoAmounts] = useState({ V1: "", V2: "" });
  const [alertMessage, setAlertMessage] = useState("");
  const [blink, setBlink] = useState(false);
  const socketRef = useRef(null);

  // === NHẬT KÝ GIAO HÀNG (giống Home) ===
  const [logs, setLogs] = useState([]);
  const [deliveryCounters, setDeliveryCounters] = useState({ V1: 0, V2: 0 });

  // Tạo mã DH0001, DH0002...
  const getNextDeliveryId = () => {
    const counter =
      parseInt(localStorage.getItem("realDeliveryCounter") || "0") + 1;
    localStorage.setItem("realDeliveryCounter", counter);
    return `DH${String(counter).padStart(4, "0")}`;
  };

  const addLog = (vehicleId, cargo, success = true) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const deliveryId = getNextDeliveryId();
    const statusText = success ? "Đã gửi lệnh giao hàng" : "Gửi lệnh thất bại";
    const cargoText = cargo ? `${cargo} hàng` : "Không có hàng";

    const message = `[${now}] ${vehicleId} | ${deliveryId} | ${cargoText} | ${statusText}`;

    setLogs((prev) => [...prev, message]);

    if (success && vehicleId) {
      setDeliveryCounters((prev) => ({
        ...prev,
        [vehicleId]: prev[vehicleId] + 1,
      }));
    }
  };

  // === Kết nối Socket.IO ===
  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL);

    socketRef.current.on("connect", () => {
      console.log("RealTime - Đã kết nối Socket.IO server");
    });

    socketRef.current.on("car:position", (data) => {
      const targetVehicle = data.device_id.includes("01") ? "V1" : "V2";

      setVehicles((prev) => ({
        ...prev,
        [targetVehicle]: {
          ...prev[targetVehicle],
          pos: data.position,
          status: "moving",
        },
      }));

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

  // === GỬI LỆNH XUỐNG XE THẬT ===
  const sendCommandToCar = async (vehicleId, cargo) => {
    const command = {
      device_id: vehicleId === "V1" ? "car01" : "car02",
      command: "start_delivery",
      cargo: cargo || "0",
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch("http://localhost:5000/api/car/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });

      socketRef.current?.emit("command:car", command);

      // Ghi log thành công
      addLog(vehicleId, cargo, true);
      setAlertMessage(`${vehicleId} đã nhận lệnh giao hàng!`);
    } catch (err) {
      console.error("Lỗi gửi lệnh:", err);
      addLog(vehicleId, cargo, false);
      setAlertMessage("Lỗi kết nối đến xe thật!");
    } finally {
      setTimeout(() => setAlertMessage(""), 5000);
    }
  };

  const handleStart = (id) => {
    const cargo = cargoAmounts[id] || "0";
    if (vehicles[id].status === "moving") {
      setAlertMessage(`${id} đang di chuyển!`);
      setTimeout(() => setAlertMessage(""), 4000);
      return;
    }
    sendCommandToCar(id, cargo);
  };

  const handleStartTogether = () => {
    const v1Cargo = cargoAmounts.V1 || "0";
    const v2Cargo = cargoAmounts.V2 || "0";

    if (vehicles.V1.status === "moving" || vehicles.V2.status === "moving") {
      setAlertMessage("Có xe đang chạy! Vui lòng đợi.");
      setTimeout(() => setAlertMessage(""), 4000);
      return;
    }

    sendCommandToCar("V1", v1Cargo);
    setTimeout(() => sendCommandToCar("V2", v2Cargo), 800);

    setCargoAmounts({ V1: "", V2: "" });
  };

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
          color: "#60a5fa",
          fontSize: "3.4rem",
          fontWeight: "bold",
          textShadow: "0 0 0 40px rgba(52,211,153,0.5)",
        }}
      >
        CHẾ ĐỘ ĐIỀU KHIỂN THỰC TẾ
      </h1>

      <p
        style={{
          textAlign: "center",
          fontSize: "1.5rem",
          color: "#94a3b8",
          marginBottom: 40,
        }}
      >
        Điều khiển xe thật trực tiếp • Vị trí cập nhật thời gian thực
      </p>

      <div
        style={{
          display: "flex",
          gap: 60,
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: 30,
        }}
      >
        <MapGrid v1={vehicles.V1} v2={vehicles.V2} />

        <UnifiedControlPanel
          v1={vehicles.V1}
          v2={vehicles.V2}
          cargoAmounts={cargoAmounts}
          setCargoAmounts={setCargoAmounts}
          onChange={updateVehicle}
          onStart={handleStart}
          onStartTogether={handleStartTogether}
          disableAll={false}
        />
      </div>

      {/* NHẬT KÝ GIAO HÀNG THỰC TẾ */}
      <DeliveryLog
        logs={logs}
        v1Deliveries={deliveryCounters.V1}
        v2Deliveries={deliveryCounters.V2}
      />

      <CollisionAlert message={alertMessage} />
      <PageSwitchButtons />
    </div>
  );
}
