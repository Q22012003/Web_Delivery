// src/pages/RealTime.jsx
import { useState, useEffect, useRef } from "react";
import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import DeliveryLog from "../components/DeliveryLog"; 
import io from "socket.io-client";
import { planTwoCarsRoute } from "../utils/routePlanner";


const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function RealTime() {
  const [vehicles, setVehicles] = useState({
    V1: { id: "V1", pos: [1, 1], endPos: [5, 3], status: "idle" },
    V2: { id: "V2", pos: [1, 1], endPos: [5, 5], status: "idle" },
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
  
  const updateVehicle = (id, field, value) => {
    // Realtime chỉ cho đổi endPos, KHÔNG cho đổi startPos
    if (field === "startPos") return;
  
    setVehicles((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
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
      const targetVehicle = data.vehicle_id
      ? data.vehicle_id
      : (data.device_id?.includes("01") ? "V1" : "V2");
      if (!targetVehicle || !Array.isArray(data.position)) return;
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

  const sendPathToBackend = async (vehicleId, fullPath, cargo) => {
    if (!fullPath || fullPath.length < 2) {
      setAlertMessage("Lộ trình không hợp lệ!");
      return;
    }
  
    const toCsv = (p) => `${p[0]},${p[1]}`;
  
    const formattedPath = fullPath.map(toCsv);
    const formattedStartPoint = toCsv(fullPath[0]);
  
    try {
      await fetch("http://localhost:5000/api/car/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          path: formattedPath,
          cargo: cargo,
          startPoint: formattedStartPoint,
        }),
      });
  
      addLog(vehicleId, cargo, true);
      setAlertMessage(`${vehicleId} đã gửi lộ trình thực tế`);
    } catch (err) {
      console.error("Lỗi gửi lệnh:", err);
      addLog(vehicleId, cargo, false);
      setAlertMessage("❌ Lỗi kết nối Backend!");
    } finally {
      setTimeout(() => setAlertMessage(""), 4000);
    }
  };

  const handleStart = (id, startInput, endInput) => {
    console.log(`[DEBUG UI] Bấm nút Start xe ${id}`);
    
    const parsePos = (str) => {
        if (!str) return null;
        if (Array.isArray(str)) return str; 
        if (typeof str === 'string' && str.trim().startsWith('[')) {
            try { return JSON.parse(str); } catch (e) { return null; }
        }
        if (typeof str === 'string' && str.includes(',')) {
            return str.split(',').map(n => parseInt(n.trim()));
        }
        return null;
    };

    let sPos = parsePos(startInput);
    const ePos = parsePos(endInput) || [5, 3];
    
    if (!sPos) {
        sPos = vehicles[id].pos;
        console.warn(`[WARN] Không đọc được startInput, dùng vị trí xe hiện tại: ${sPos}`);
    } else {
        console.log(`[OK] Đã nhận tọa độ xuất phát từ Input: ${sPos}`);
    }

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
  
    const result = planTwoCarsRoute({
      v1Start: vehicles.V1.pos,
      v2Start: vehicles.V2.pos,
      v1End: vehicles.V1.endPos,
      v2End: vehicles.V2.endPos,
      v2DelayMs: 3500,
      v2DelayTicks: 4,
    });
  
    if (!result) {
      setAlertMessage("❌ Không tìm được lộ trình an toàn!");
      return;
    }
  
    // ===== GỬI V1 NGAY =====
    sendPathToBackend("V1", result.V1.fullPath, v1Cargo);
  
    // ===== GỬI V2 SAU 3–4s =====
    setTimeout(() => {
      sendPathToBackend("V2", result.V2.fullPath, v2Cargo);
    }, result.V2.delayMs);
  
    setCargoAmounts({ V1: "", V2: "" });
  };
  

  return (
    <div style={{
        padding: "30px 40px",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
        overflowX: "hidden",
        boxSizing: "border-box" // Đảm bảo padding không làm vỡ layout
      }}>
      <ClockDisplay />
      
      <h1 style={{
          textAlign: "center", margin: "20px 0 40px", color: "#60a5fa",
          fontSize: "3rem", fontWeight: "bold", textShadow: "0 0 30px rgba(96,165,250,0.6)",
        }}>
        CHẾ ĐỘ THỰC TẾ
      </h1>

      <div 
        style={{ 
          display: "flex", 
          gap: 30, 
          justifyContent: "center", 
          alignItems: "stretch", 
          flexWrap: "wrap" 
        }}
      >
        {/* Cột 1: Bản đồ */}
        <div style={{ flex: "0 0 auto" }}>
          <MapGrid v1={vehicles.V1} v2={vehicles.V2} />
        </div>

        {/* Cột 2: Container chứa Điều khiển & Nhật ký */}
        {/* [FIX] Set chiều cao tính toán theo màn hình để 2 bảng luôn bằng nhau */}
        <div style={{ 
            display: "flex", 
            flexDirection: "row",
            gap: 25, 
            height: "calc(100vh - 180px)", // Chiều cao tự động theo màn hình
            minHeight: "720px",            // Chiều cao tối thiểu để không bị mất nội dung
            maxHeight: "900px"             // Giới hạn chiều cao trên màn hình quá lớn
        }}>
           
           {/* Bảng điều khiển */}
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
              
              {alertMessage && (
                 <div style={{ marginTop: 15, width: "100%", maxWidth: "500px" }}>
                    <CollisionAlert message={alertMessage} />
                 </div>
              )}
           </div>

           {/* Bảng Nhật ký [FIX] - Chiều cao 100% theo cha */}
           <div style={{
              height: "100%",        // Luôn cao bằng container cha (bằng Bảng điều khiển)
              overflowY: "auto",     // Tự động hiện thanh cuộn khi nội dung dài
              paddingRight: "5px",
              
              // CSS thanh cuộn đẹp
              scrollbarWidth: "thin",
              scrollbarColor: "#64748b #1e293b",
              
              // Giữ style bao quanh nếu cần (hoặc để component tự lo)
              borderRadius: "20px",
              display: "flex",       // Flex để DeliveryLog bung ra hết cỡ
              flexDirection: "column"
           }}>
              {/* Truyền style height 100% vào DeliveryLog nếu nó hỗ trợ, hoặc để div này lo */}
              <div style={{ flex: 1 }}> 
                  <DeliveryLog 
                    logs={logs} 
                    v1Deliveries={deliveryCounters.V1} 
                    v2Deliveries={deliveryCounters.V2} 
                  />
              </div>
           </div>
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <PageSwitchButtons />
      </div>
    </div>
  );
}