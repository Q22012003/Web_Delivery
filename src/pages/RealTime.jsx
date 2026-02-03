// src/pages/RealTime.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

import MapGrid from "../components/MapGrid";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import ControlPanel from "../components/ControlPanel";

import { planMultiCarsRoute, pathToMcuCommands } from "../utils/routePlanner";

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
  const SIDEBAR_W = 280; // đúng bằng width sidebar của bạn
  const PAGE_GAP = 20;
  
const HOME = [1, 1];
const START_SPOTS = [
  [1, 1], // V1
  [1, 2], // V2
  [1, 3], // V3
  [1, 4], // V4
  [1, 5], // V5
];

const makeVehicle = (id, pos, endPos) => ({
  id,
  pos,
  endPos,
  status: "idle",
  tripLog: [],
  delayMs: 0,
});

const buildDefaultVehicles = () => ([
  makeVehicle("V1", START_SPOTS[0], [5, 3]),
  makeVehicle("V2", START_SPOTS[1], [5, 5]),
]);

const buildDefaultCargo = () => ({ V1: "", V2: "" });

export default function RealTime() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  
    // ===== REAL WORLD SYNC (IMPORTANT) =====
    // Thay vì delay theo ms (UI nhanh/chậm khác thực tế), ta dùng "gate theo progress":
    // Ví dụ: V2 chỉ bắt đầu khi V1 đã đi được N node (N = delayTicks).
    const runGateRef = useRef({
      running: false,
      leadId: "V1",
      progress: {}, // { V1: 0, ... }  số lần đổi node
      lastPos: {},  // { V1: "1,1", ... } để chống đếm trùng
      waiting: {},  // { V2: { leadTicks, path, cargo } }
    });
  const [vehicles, setVehicles] = useState(buildDefaultVehicles());
  const [cargoAmounts, setCargoAmounts] = useState(buildDefaultCargo());
  const [alertMessage, setAlertMessage] = useState("");
  const [blink, setBlink] = useState(false);
  const [logs, setLogs] = useState([]);
  const [deliveryCounters, setDeliveryCounters] = useState({ V1: 0, V2: 0 });
  const [isRunningTogether, setIsRunningTogether] = useState(false);

  const v1 = vehicles.find((v) => v.id === "V1");
  const v2 = vehicles.find((v) => v.id === "V2");

  const addPathLog = (vehicleId, path) => {
    if (!Array.isArray(path) || path.length === 0) return;
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const pathStr = path.map((p) => `${p[0]}.${p[1]}`).join(" → ");
    setLogs((prev) => [`[${now}] Xe ${vehicleId}: ${pathStr}`, ...prev].slice(0, 200));
  };

  const addLog = (vehicleId, cargo, ok) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const message = `[${now}] ${vehicleId}: ${ok ? "✅" : "❌"} cargo=${cargo || "Chưa nhập"}`;
    setLogs((prev) => [message, ...prev].slice(0, 200));
  };

  const updateVehicle = (id, field, value) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const getNextDeliveryId = (vehicleId) => {
    const current = deliveryCounters[vehicleId] || 0;
    const next = current + 1;
    setDeliveryCounters((prev) => ({ ...prev, [vehicleId]: next }));
    return next;
  };
useEffect(() => {
  socketRef.current = io(SOCKET_SERVER_URL);

  socketRef.current.on("car:position", (payload) => {
    // backend có thể gửi: { vehicle_id | vehicleId | id, position: [row,col], status }
    const vid = payload?.vehicle_id || payload?.vehicleId || payload?.id;
    const pos = payload?.position;
    if (!vid || !Array.isArray(pos) || pos.length !== 2) return;

    // DONE/IDLE là kết thúc (OK có thể chỉ ACK từng node)
    const rawStatus = String(payload?.status || "").toUpperCase();
    const isTerminal = rawStatus === "DONE" || rawStatus === "IDLE";

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vid
          ? {
              ...v,
              pos: [pos[0], pos[1]],
              ...(isTerminal ? { status: "idle", tripLog: [] } : null),
            }
          : v
      )
    );
    
        // ===== Gate progress: start xe sau khi xe lead đi được N node (delayTicks) =====
        const gate = runGateRef.current;
       if (gate?.running) {
          const key = `${pos[0]},${pos[1]}`;
          const last = gate.lastPos?.[vid];
    
          // chỉ đếm khi xe thực sự đổi node (tránh spam cùng 1 QR)
          if (key !== last) {
            gate.lastPos[vid] = key;
            gate.progress[vid] = (gate.progress[vid] || 0) + 1;
    
            // Khi lead xe (thường là V1) đã đi đủ leadTicks -> mở gate cho xe đang chờ
            if (vid === gate.leadId) {
              for (const [waitVid, w] of Object.entries(gate.waiting || {})) {
                const need = Number(w?.leadTicks || 0);
                if (gate.progress[gate.leadId] >= need) {
                  setVehicles((prev) =>
                    prev.map((x) =>
                      x.id === waitVid ? { ...x, status: "moving", tripLog: w.path || [] } : x
                    )
                  );
                  sendPathToBackend(waitVid, w.path, w.cargo);
                  delete gate.waiting[waitVid];
                }
              }
            }
          }
        }    
  });

  // ✅ FIX: hỗ trợ nhiều kiểu key khi backend emit xong job
  socketRef.current.on("car:reached", (payload) => {
    const vehicleId = payload?.vehicleId || payload?.vehicle_id || payload?.id;
    if (!vehicleId) return;

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId ? { ...v, status: "idle", tripLog: [] } : v
      )
    );
  });

  socketRef.current.on("car:error", (payload) => {
    const vehicleId = payload?.vehicleId || payload?.vehicle_id || payload?.id;
    const message = payload?.message;
    if (!vehicleId) return;

    setAlertMessage(`${vehicleId}: ${message || "Lỗi không rõ"}`);
    setTimeout(() => setAlertMessage(""), 4000);

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId ? { ...v, status: "idle", tripLog: [] } : v
      )
    );
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
      setTimeout(() => setAlertMessage(""), 4000);
      return;
    }
  
    const toCsv = (p) => `${p[0]},${p[1]}`;
    const formattedPath = fullPath.map(toCsv);
    const formattedStartPoint = toCsv(fullPath[0]);
  
    const { commands } = pathToMcuCommands(fullPath, { normalizeAtEnd: true });
  
    try {
      const res = await fetch("http://localhost:5000/api/car/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          path: formattedPath,
          cargo,
          startPoint: formattedStartPoint,
          commands,
        }),
      });
  
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
  
      const data = await res.json();
  
      // log debug 1 dòng rõ ràng
      const now = new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLogs((prev) => [`[${now}] ✅ ${vehicleId} backend OK: ${data?.message || "sent"}`, ...prev].slice(0, 200));
  
      // log giao hàng như bạn đang dùng
      addLog(vehicleId, cargo, true);
      setAlertMessage(`${vehicleId} đã gửi lộ trình thực tế`);
    } catch (err) {
      console.error("Lỗi gửi lệnh:", err);
      addLog(vehicleId, cargo, false);
      setAlertMessage(`❌ Backend lỗi: ${err?.message || "unknown"}`);
    } finally {
      setTimeout(() => setAlertMessage(""), 4000);
    }
  };
  

  const handleAddVehicle = () => {
    setVehicles((prev) => {
      if (prev.length >= 5) return prev;

      const nextIndex = prev.length; // 0..4
      const id = `V${nextIndex + 1}`;
      const newV = makeVehicle(id, START_SPOTS[nextIndex], [5, 1]);

      return [...prev, newV];
    });

    setCargoAmounts((prev) => {
      const count = Object.keys(prev).length;
      if (count >= 5) return prev;
      const id = `V${count + 1}`;
      return { ...prev, [id]: "" };
    });
  };

  const handleRemoveVehicle = (vehicleId) => {
    if (vehicleId === "V1" || vehicleId === "V2") {
      alert("Không thể xóa V1/V2.");
      return;
    }
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
    if (v.status === "moving") {
      alert(`Xe ${vehicleId} đang chạy, không thể xóa.`);
      return;
    }

    if (!confirm(`Bạn chắc chắn muốn xóa xe ${vehicleId} không?`)) return;

    setVehicles((prev) => prev.filter((x) => x.id !== vehicleId));
    setCargoAmounts((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
  };

  const handleStartTogetherSafeMulti = () => {
      const active = vehicles
        .filter((v) => v.endPos)
        .filter((v) => v.id === "V1" || v.id === "V2") // ✅ cứng 2 xe (nếu muốn mở rộng thì bỏ dòng này)
        .map((v) => ({
          id: v.id,
          startPos: v.pos,
          endPos: v.endPos,
        }));

  if (active.length === 0) {
    setAlertMessage("⚠️ Chưa chọn xe / chưa có điểm đến!");
    setTimeout(() => setAlertMessage(""), 4000);
    return;
  }

  const result = planMultiCarsRoute({
    vehicles: active,
    baseDelayTicks: 4,
    baseDelayMs: 3500,
    maxCars: 2,
  });

  if (!result) {
    setAlertMessage("❌ Không tìm được lộ trình an toàn cho tất cả xe!");
    setTimeout(() => setAlertMessage(""), 5000);
    return;
  }

    setIsRunningTogether(true);
  
    // ===== Gate reset =====
    const gate = runGateRef.current;
    const leadId = active.some((x) => x.id === "V1") ? "V1" : active[0].id;
  
    gate.running = true;
    gate.leadId = leadId;
    gate.progress = {};
    gate.lastPos = {};
    gate.waiting = {};
  
    // init chống đếm trùng ngay node start
    const leadStart =
      result?.[leadId]?.fullPath?.[0] || active.find((x) => x.id === leadId)?.startPos;
    if (leadStart) gate.lastPos[leadId] = `${leadStart[0]},${leadStart[1]}`;
    gate.progress[leadId] = 0;
  
    // ===== Start lead ngay, xe còn lại sẽ start khi lead đi đủ delayTicks =====
    active.forEach((v) => {
      const res = result[v.id];
      const fullPath = res?.fullPath;
  
      if (!fullPath || fullPath.length < 2) {
        setAlertMessage(`❌ ${v.id}: Lộ trình không hợp lệ!`);
        setTimeout(() => setAlertMessage(""), 5000);
        return;
      }
  
      addPathLog(v.id, fullPath);
  
      const cargo = cargoAmounts[v.id] ?? "";
  
      if (v.id === leadId) {
        setVehicles((prev) =>
          prev.map((x) => (x.id === v.id ? { ...x, status: "moving", tripLog: fullPath } : x))
        );
        sendPathToBackend(v.id, fullPath, cargo);
        return;
      }
  
      const leadTicks = Number(res?.delayTicks ?? 4);
  
      if (leadTicks <= 0) {
        setVehicles((prev) =>
          prev.map((x) => (x.id === v.id ? { ...x, status: "moving", tripLog: fullPath } : x))
        );
        sendPathToBackend(v.id, fullPath, cargo);
        return;
      }
  
      gate.waiting[v.id] = { leadTicks, path: fullPath, cargo };
    });
  };

  // ===== UI =====
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.25), rgba(2,6,23,1) 60%)",
        padding: 20,
        paddingLeft: SIDEBAR_W + PAGE_GAP, // ✅ chừa chỗ cho sidebar fixed
        color: "#e2e8f0",
        boxSizing: "border-box",
      }}
    >
{/* HEADER – title bên trái, thời gian ở giữa (nhỏ vừa khung) */}
<div
  style={{
    position: "relative",
    marginBottom: 22,
    padding: "12px 18px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))",
    backdropFilter: "blur(8px)",
    height: 74, // ✅ thấp hơn để giống “khung xanh” ban đầu
  }}
>
  {/* LEFT: REALTIME + sub */}
  <div
    style={{
      position: "absolute",
      left: 18,
      top: "50%",
      transform: "translateY(-50%)",
      textAlign: "left",
      lineHeight: 1.1,
    }}
  >
    <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.8 }}>
      REALTIME
    </div>
    <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 600, opacity: 0.75 }}>
      Điều khiển thực tế qua Backend
    </div>
  </div>

  {/* CENTER: time + system (nhỏ vừa khung) */}
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}
  >
    <div style={{ fontSize: 22, fontWeight: 900, color: "#67e8f9", lineHeight: 1 }}>
      <ClockDisplay />
    </div>
  </div>
</div>

      {/* Body: 2 cột giống Home */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 25,
          alignItems: "flex-start",
        }}
      >
        {/* CỘT 1: MAP */}
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <MapGrid v1={v1} v2={v2} vehicles={vehicles} />
          <div style={{ marginTop: 18 }}>
            <PageSwitchButtons />
          </div>
        </div>

        {/* CỘT 2: CONTROLS & LOG */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 25,
            height: "calc(100vh - 180px)",
            minHeight: "720px",
            maxHeight: "900px",
          }}
        >
          {/* A. Bảng điều khiển */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              width: "clamp(720px, 52vw, 980px)",
            }}
          >
            <button
              onClick={handleAddVehicle}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(96,165,250,0.45)",
                background:
                  "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))",
                color: "#e2e8f0",
                fontWeight: 900,
                letterSpacing: "0.4px",
                cursor: "pointer",
                boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
                marginBottom: 14,
              }}
            >
              ➕ Thêm xe (tối đa 5)
            </button>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                gap: 16,
                width: "100%",
                alignItems: "stretch",
                overflowY: "auto",
                paddingRight: 8,
              }}
            >
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  style={{ background: "#fff", borderRadius: 14, padding: 14 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#0f172a" }}>
                      {v.id}
                    </div>

                    <button
                      onClick={() => handleRemoveVehicle(v.id)}
                      disabled={v.id === "V1" || v.id === "V2"}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.35)",
                        background:
                          v.id === "V1" || v.id === "V2"
                            ? "#e2e8f0"
                            : "rgba(239,68,68,0.12)",
                        color:
                          v.id === "V1" || v.id === "V2"
                            ? "#64748b"
                            : "#b91c1c",
                        fontWeight: 800,
                        cursor:
                          v.id === "V1" || v.id === "V2"
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      ✖ Xóa
                    </button>
                  </div>

                  <ControlPanel
                    vehicle={v}
                    onChange={(field, value) => updateVehicle(v.id, field, value)}
                    onStart={() => {
                      // chạy 1 xe: plan riêng rồi gửi
                      const result = planMultiCarsRoute({
                        vehicles: [{ id: v.id, startPos: v.pos, endPos: v.endPos }],
                        baseDelayTicks: 2,
                        baseDelayMs: 3500,
                        maxCars: 2,
                      });
                      const fullPath = result?.[v.id]?.fullPath;
                      setVehicles((prev) =>
                        prev.map((x) =>
                          x.id === v.id
                            ? { ...x, status: "moving", tripLog: fullPath || [] }
                            : x
                        )
                      );
                      addPathLog(v.id, fullPath);
                      const cargo = cargoAmounts[v.id] ?? "";
                      sendPathToBackend(v.id, fullPath, cargo);
                    }}
                  />

                  <div style={{ height: 10 }} />

                  <div
                    style={{
                      fontWeight: 800,
                      color: "#0f172a",
                      marginBottom: 6,
                    }}
                  >
                    Nhập số hàng {v.id}...
                  </div>

                  <input
                    value={cargoAmounts[v.id] ?? ""}
                    onChange={(e) =>
                      setCargoAmounts((prev) => ({
                        ...prev,
                        [v.id]: e.target.value,
                      }))
                    }
                    placeholder={`Nhập số hàng ${v.id}...`}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      outline: "none",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                    disabled={v.status === "moving"}
                  />

                  <div
                    style={{
                      marginTop: 8,
                      color: "#334155",
                      fontSize: 12,
                      lineHeight: 1.35,
                    }}
                  >
                    • Điểm về ưu tiên: 1.1 <br />
                    • Xe sau xuất phát theo delay (V2 sau V1, V3 sau V2...)
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartTogetherSafeMulti}
              disabled={isRunningTogether}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid rgba(96,165,250,0.55)",
                background: isRunningTogether
                  ? "linear-gradient(135deg, rgba(148,163,184,0.35), rgba(148,163,184,0.25))"
                  : "linear-gradient(135deg, rgba(37,99,235,0.85), rgba(14,165,233,0.65))",
                color: "#e2e8f0",
                fontWeight: 900,
                letterSpacing: "0.4px",
                cursor: isRunningTogether ? "not-allowed" : "pointer",
                boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
              }}
            >
              {isRunningTogether ? "ĐANG CHẠY..." : "CHẠY CÙNG LÚC (V1→V5, delay tuần tự)"}
            </button>

            {alertMessage && (
              <div style={{ marginTop: 15, width: "100%" }}>
                <CollisionAlert message={alertMessage} />
              </div>
            )}
          </div>

          {/* B. Log */}
          <div style={{ width: 430 }}>
            <DeliveryLog logs={logs} blink={blink} />
          </div>
        </div>
      </div>
    </div>
  );
}
