// src/pages/RealTime.jsx
import { useState, useEffect, useRef } from "react";
import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import DeliveryLog from "../components/DeliveryLog"; 
import io from "socket.io-client";
// THÊM: Import A* để tính toán lộ trình trước khi gửi
import { aStarSearch } from "../utils/aStar";

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

  // === GỬI LỆNH LỘ TRÌNH (MODIFIED) ===
  const sendPathToBackend = async (vehicleId, cargo, customStart = null, customGoal = null) => {
    
    // 1. Ưu tiên lấy điểm từ input, nếu không có mới lấy vị trí hiện tại của xe
    const startPos = customStart || vehicles[vehicleId].pos;
    const goalPos = customGoal || [5, 3]; // Mặc định hoặc lấy từ input

    console.log(`Tính A* từ [${startPos}] đến [${goalPos}]`);

    // 2. Tính A*
    const rawPath = aStarSearch(startPos, goalPos);
    
    // 3. QUAN TRỌNG: Loại bỏ điểm đầu tiên (Start) khỏi danh sách gửi đi
    // Vì A* trả về [[1,2], [1,3]...] -> Nếu gửi cả [1,2] thì xe đang ở 1.2 sẽ nhận lệnh đi tới 1.2 (vô nghĩa)
    const pathToSend = rawPath.length > 0 ? rawPath.slice(1) : [];

    if (pathToSend.length === 0) {
      setAlertMessage("Đang ở đích hoặc không tìm thấy đường!");
      return;
    }

    // Convert sang dạng string ["1,2", "1,3"...]
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
    // startInput ví dụ: "1,2" -> cần convert sang mảng [1, 2]
    // endInput ví dụ: "5,3" -> cần convert sang mảng [5, 3]

    const parsePos = (str) => {
        if (!str) return null;
        return str.split(',').map(Number);
    };

    const sPos = parsePos(startInput); // Ví dụ bạn nhập "1,2"
    const ePos = parsePos(endInput);   // Ví dụ bạn nhập "5,3"
    
    const cargo = cargoAmounts[id] || "0";

    if (vehicles[id].status === "moving") {
      setAlertMessage(`${id} đang di chuyển!`);
      return;
    }

    // Gọi hàm gửi với tọa độ tùy chỉnh
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
    setTimeout(() => sendPathToBackend("V2", v2Cargo), 1000); // Delay xe 2 chút
    setCargoAmounts({ V1: "", V2: "" });
  };

  const updateVehicle = (id, field, value) => {
    setVehicles((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

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
          textAlign: "center", margin: "40px 0 20px", color: "#60a5fa",
          fontSize: "3.4rem", fontWeight: "bold", textShadow: "0 0 0 40px rgba(52,211,153,0.5)",
        }}>
        CHẾ ĐỘ ĐIỀU KHIỂN THỰC TẾ
      </h1>
      <p style={{ textAlign: "center", fontSize: "1.5rem", color: "#94a3b8", marginBottom: 40 }}>
        Điều khiển xe thật trực tiếp • Vị trí cập nhật thời gian thực
      </p>

      <div style={{ display: "flex", gap: 60, justifyContent: "center", flexWrap: "wrap", marginTop: 30 }}>
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

      <DeliveryLog logs={logs} v1Deliveries={deliveryCounters.V1} v2Deliveries={deliveryCounters.V2} />
      <CollisionAlert message={alertMessage} />
      <PageSwitchButtons />
    </div>
  );
}