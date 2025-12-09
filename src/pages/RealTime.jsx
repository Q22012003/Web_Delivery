// src/pages/RealTime.jsx
import { useState, useEffect, useRef } from "react";
import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import DeliveryLog from "../components/DeliveryLog"; 
import io from "socket.io-client";
import { aStarSearch } from "../utils/aStar";

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function RealTime() {
  // === LOGIC GIỮ NGUYÊN ===
  const [vehicles, setVehicles] = useState({
    V1: { id: "V1", pos: [1, 1], status: "idle" },
    V2: { id: "V2", pos: [1, 1], status: "idle" },
  });

  const [cargoAmounts, setCargoAmounts] = useState({ V1: "", V2: "" });
  const [alertMessage, setAlertMessage] = useState("");
  const [blink, setBlink] = useState(false);
  const socketRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [deliveryCounters, setDeliveryCounters] = useState({ V1: 0, V2: 0 });

  const getNextDeliveryId = () => {
    const counter = parseInt(localStorage.getItem("realDeliveryCounter") || "0") + 1;
    localStorage.setItem("realDeliveryCounter", counter);
    return `DH${String(counter).padStart(4, "0")}`;
  };

  const addLog = (vehicleId, cargo, success = true) => {
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
    const deliveryId = getNextDeliveryId();
    const statusText = success ? "Đã gửi lộ trình" : "Lỗi gửi lệnh";
    const cargoText = cargo ? `${cargo} hàng` : "Không có hàng";
    setLogs((prev) => [...prev, `[${now}] ${vehicleId} | ${deliveryId} | ${cargoText} | ${statusText}`]);
    if (success && vehicleId) {
      setDeliveryCounters((prev) => ({ ...prev, [vehicleId]: prev[vehicleId] + 1 }));
    }
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL);
    socketRef.current.on("connect", () => console.log("RealTime connected"));
    socketRef.current.on("car:position", (data) => {
      const targetVehicle = data.device_id.includes("01") ? "V1" : "V2";
      setVehicles((prev) => ({
        ...prev,
        [targetVehicle]: { ...prev[targetVehicle], pos: data.position, status: "moving" },
      }));
      setTimeout(() => {
        setVehicles((prev) => ({
          ...prev,
          [targetVehicle]: { ...prev[targetVehicle], status: "idle" },
        }));
      }, 3000);
    });
    return () => socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setBlink((prev) => !prev), 1500);
    return () => clearInterval(interval);
  }, []);

  const sendPathToBackend = async (vehicleId, cargo, customStart = null, customGoal = null) => {
    const startPos = customStart || vehicles[vehicleId].pos;
    const goalPos = customGoal || [5, 3]; 

    console.log(`Tính A* từ [${startPos}] đến [${goalPos}]`);

    const rawPath = aStarSearch(startPos, goalPos);
    const pathToSend = rawPath.length > 0 ? rawPath.slice(1) : [];

    if (pathToSend.length === 0) {
      setAlertMessage("Đang ở đích hoặc không tìm thấy đường!");
      return;
    }

    const formattedPath = pathToSend.map(p => `${p[0]},${p[1]}`);

    try {
      await fetch("http://localhost:5000/api/car/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            vehicle_id: vehicleId,
            path: formattedPath,
            cargo: cargo 
        }),
      });

      addLog(vehicleId, cargo, true);
      setAlertMessage(`${vehicleId} bắt đầu chạy từ ${startPos} đến ${goalPos}!`);
    } catch (err) {
      console.error("Lỗi gửi lệnh:", err);
      addLog(vehicleId, cargo, false);
      setAlertMessage("Lỗi kết nối Backend!");
    } finally {
      setTimeout(() => setAlertMessage(""), 5000);
    }
  };

  const handleStart = (id, startInput, endInput) => {
    const parsePos = (str) => {
        if (!str) return null;
        // Kiểm tra xem input là mảng hay string (vì component UnifiedControlPanel trả về string JSON)
        if (Array.isArray(str)) return str; 
        if (typeof str === 'string' && str.includes('[')) return JSON.parse(str); 
        // Fallback cũ nếu cần
        return str ? str.split(',').map(Number) : null;
    };

    // UnifiedControlPanel mới trả về object hoặc array, cần đảm bảo đúng format
    const sPos = parsePos(startInput) || vehicles[id].pos;
    const ePos = parsePos(endInput) || [5, 3];
    
    const cargo = cargoAmounts[id] || "0";

    if (vehicles[id].status === "moving") {
      setAlertMessage(`${id} đang di chuyển!`);
      return;
    }
    sendPathToBackend(id, cargo, sPos, ePos);
  };

  const handleStartTogether = () => {
    const v1Cargo = cargoAmounts.V1 || "0";
    const v2Cargo = cargoAmounts.V2 || "0";
    if (vehicles.V1.status === "moving" || vehicles.V2.status === "moving") {
      setAlertMessage("Có xe đang chạy!");
      return;
    }
    sendPathToBackend("V1", v1Cargo);
    setTimeout(() => sendPathToBackend("V2", v2Cargo), 1000);
    setCargoAmounts({ V1: "", V2: "" });
  };

  const updateVehicle = (id, field, value) => {
    setVehicles((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // === PHẦN LAYOUT UI ĐƯỢC CẬP NHẬT ===
  return (
    <div style={{
        padding: "30px 40px",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
        overflowX: "hidden"
      }}>
      <ClockDisplay />
      
      <h1 style={{
          textAlign: "center", margin: "20px 0 40px", color: "#60a5fa",
          fontSize: "3rem", fontWeight: "bold", textShadow: "0 0 30px rgba(96,165,250,0.6)",
        }}>
        CHẾ ĐỘ THỰC TẾ
      </h1>

      {/* --- COPY CẤU TRÚC LAYOUT TỪ HOME.JSX --- */}
      <div 
        style={{ 
          display: "flex", 
          gap: 30, 
          justifyContent: "center", 
          alignItems: "stretch", // Quan trọng: Kéo giãn chiều cao bằng nhau
          flexWrap: "wrap" 
        }}
      >
        {/* CỘT 1: BẢN ĐỒ */}
        <div style={{ flex: "0 0 auto" }}>
          <MapGrid v1={vehicles.V1} v2={vehicles.V2} />
        </div>

        {/* CỘT 2: CONTROLS & LOG (Xếp ngang) */}
        <div style={{ 
            display: "flex", 
            flexDirection: "row",
            gap: 25, 
        }}>
           {/* Nhóm A: Bảng điều khiển + Alert */}
           <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <UnifiedControlPanel
                v1={vehicles.V1}
                v2={vehicles.V2}
                cargoAmounts={cargoAmounts}
                setCargoAmounts={setCargoAmounts}
                onChange={updateVehicle}
                onStart={handleStart}
                onStartTogether={handleStartTogether}
              />
              
              {/* Alert nằm ngay dưới bảng điều khiển giống Home */}
              {alertMessage && (
                 <div style={{ marginTop: 15, width: "100%", maxWidth: "500px" }}>
                    <CollisionAlert message={alertMessage} />
                 </div>
              )}
           </div>

           {/* Nhóm B: Nhật ký */}
           <div>
              <DeliveryLog 
                logs={logs} 
                v1Deliveries={deliveryCounters.V1} 
                v2Deliveries={deliveryCounters.V2} 
              />
           </div>
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <PageSwitchButtons />
      </div>
    </div>
  );
}