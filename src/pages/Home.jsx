// src/pages/Home.jsx
import { useState, useEffect } from "react";
import MapGrid from "../components/MapGrid";
import UnifiedControlPanel from "../components/UnifiedControlPanel";
import ClockDisplay from "../components/ClockDisplay";
import DeliveryLog from "../components/DeliveryLog";
import PageSwitchButtons from "../components/PageSwitchButtons";
import CollisionAlert from "../components/CollisionAlert";
import { useNavigate } from "react-router-dom";

import { aStarSearch } from "../utils/aStar";
import { findSafePathWithReturn } from "../utils/smartPathfinding";

const loadSavedState = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  try {
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export default function Home() {
  const [isRunningTogether, setIsRunningTogether] = useState(false);
  const [cargoAmounts, setCargoAmounts] = useState({ V1: "", V2: "" });
  const [alertMessage, setAlertMessage] = useState("");

  const navigate = useNavigate();

  // ===== RULES =====
  const HOME = [1, 1];
  const PARKING_SPOTS = [
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
  ];
  const samePos = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

  const pickParkingSpot = (occupied = []) => {
    const occ = new Set(occupied.map((p) => `${p[0]},${p[1]}`));
    for (const p of PARKING_SPOTS) {
      if (!occ.has(`${p[0]},${p[1]}`)) return p;
    }
    return PARKING_SPOTS[PARKING_SPOTS.length - 1];
  };

  // === State xe V1 ===
  const [v1, setV1] = useState(() =>
    loadSavedState("home_v1_state", {
      id: "V1",
      startPos: [1, 1], // không dùng để set nữa, giữ để tương thích state cũ
      endPos: [5, 3],
      pos: [1, 1],
      path: [],
      status: "idle",
      deliveries: 0,
      tripLog: null,
      activeCargo: 0,
    })
  );

  // === State xe V2 ===
  const [v2, setV2] = useState(() =>
    loadSavedState("home_v2_state", {
      id: "V2",
      startPos: [1, 1], // không dùng để set nữa
      endPos: [5, 5],
      pos: [1, 1],
      path: [],
      status: "idle",
      deliveries: 0,
      tripLog: null,
      activeCargo: 0,
    })
  );

  const [logs, setLogs] = useState(() => loadSavedState("home_logs", []));

  useEffect(() => {
    localStorage.setItem("home_v1_state", JSON.stringify(v1));
    localStorage.setItem("home_v2_state", JSON.stringify(v2));
    localStorage.setItem("home_logs", JSON.stringify(logs));
  }, [v1, v2, logs]);

  const addLog = (id, deliveries, pathOrMessage) => {
    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let message;
    if (typeof pathOrMessage === "string") {
      message = `[${now}] ${id === "System" ? "HỆ THỐNG" : id}: ${pathOrMessage}`;
    } else {
      const pathStr = pathOrMessage.map((p) => `${p[0]}.${p[1]}`).join(" → ");
      message = `[${now}] Xe ${id}: ${pathStr}`;
    }
    setLogs((prev) => [...prev, message]);
  };

  const getNextDeliveryId = () => {
    const counter = parseInt(localStorage.getItem("deliveryCounter") || "0") + 1;
    localStorage.setItem("deliveryCounter", counter);
    return `DH${String(counter).padStart(4, "0")}`;
  };

  const saveTripLog = async (id, startPos, endPos, cargo, path) => {
    const deliveryId = getNextDeliveryId();
    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    const logEntry = {
      deliveryId,
      vehicleId: id,
      route: `${startPos[0]},${startPos[1]} → ${endPos[0]},${endPos[1]}`,
      cargo: cargo || "Chưa nhập",
      time: now,
      path: path.map((p) => `${p[0]},${p[1]}`).join(" → "),
    };

    const existing = JSON.parse(localStorage.getItem("tripLogs") || "[]");
    localStorage.setItem("tripLogs", JSON.stringify([...existing, logEntry]));
  };

  // ===== giữ nguyên logic nhập kho của bạn =====
  const updateInventoryStorage = (destinationPos, amount, vehicleId) => {
    const destKey = `${destinationPos[0]},${destinationPos[1]}`;
    const qty = parseInt(amount);
    if (!qty || qty <= 0) return;

    const validWarehouses = ["5,1", "5,2", "5,3", "5,4", "5,5"];
    if (validWarehouses.includes(destKey)) {
      let currentStock = JSON.parse(localStorage.getItem("warehouse_stock") || "{}");
      const oldQty = currentStock[destKey] || 0;
      const newQty = oldQty + qty;
      currentStock[destKey] = newQty;

      localStorage.setItem("warehouse_stock", JSON.stringify(currentStock));

      const msg = `✅ Đã nhập kho [${destKey}]: +${qty} (Tổng: ${newQty})`;
      console.log(msg);
      addLog("System", 0, msg);
    }
  };

  const handleManualTest = () => {
    if (confirm("Test: Sẽ cộng thêm 10 đơn vị vào kho 5,1. Bạn có muốn thử không?")) {
      updateInventoryStorage([5, 1], 10, "TESTER");
      alert("Đã gửi dữ liệu! Hãy qua trang Quản lý kho kiểm tra.");
    }
  };

  // =========================
  // START 1 XE
  // - start = vị trí hiện tại
  // - return ưu tiên 1.1
  // - nếu xe còn lại idle ở 1.1 => đẩy sang 1.2..1.5 để tránh va chạm
  // =========================
  const handleStart = (id, delay = 0) => {
    setTimeout(() => {
      const vehicle = id === "V1" ? v1 : v2;
      const setVehicle = id === "V1" ? setV1 : setV2;

      const other = id === "V1" ? v2 : v1;
      const setOther = id === "V1" ? setV2 : setV1;

      const amount = parseInt(cargoAmounts[id]);
      if (!amount || amount <= 0) {
        alert(`⚠️ Vui lòng nhập số lượng hàng cho xe ${id} > 0`);
        return;
      }
      if (vehicle.status === "moving") return;

      const startNow = vehicle.pos;

      // Nếu xe còn lại đang đứng yên ở 1.1 thì đẩy sang bến để tránh đụng lúc xe này quay về
      if (other.status !== "moving" && samePos(other.pos, HOME)) {
        const park = pickParkingSpot([startNow]);
        const parkPath = aStarSearch(other.pos, park, false);
        if (parkPath && parkPath.length > 1) {
          setOther((prev) => ({
            ...prev,
            path: parkPath.slice(1),
            status: "moving",
            tripLog: parkPath,
            activeCargo: 0,
          }));
          addLog(other.id, 0, `Di chuyển sang bến đỗ ${park[0]}.${park[1]} để tránh va chạm`);
        }
      }

      // đi giao xong -> quay về 1.1
      const fullPath = aStarSearch(startNow, vehicle.endPos, true, HOME);
      if (!fullPath || fullPath.length < 2) {
        alert(`Xe ${id}: Không tìm thấy đường!`);
        return;
      }

      setVehicle((prev) => ({
        ...prev,
        path: fullPath.slice(1),
        status: "moving",
        deliveries: prev.deliveries + 1,
        tripLog: fullPath,
        activeCargo: amount,
      }));

      saveTripLog(id, startNow, vehicle.endPos, amount, fullPath);
      addLog(id, vehicle.deliveries + 1, fullPath);
    }, delay);
  };

// =========================
// START 2 XE (ổn định)
// - V1 vẫn chạy trước (delay cho V2 giữ nguyên 3–4s)
// - Nhưng: AI VỀ 1.1 SỚM HƠN => được đỗ 1.1
// - Xe còn lại => phải đỗ 1.2..1.5
// - Cấm đi vào cell của xe đang delay (tránh tông ngay lúc xuất phát)
// =========================
const handleStartTogetherSafe = () => {
  const amount1 = parseInt(cargoAmounts.V1);
  const amount2 = parseInt(cargoAmounts.V2);

  if (!amount1 || amount1 <= 0) {
    alert("⚠️ Vui lòng nhập số lượng cho V1 > 0");
    return;
  }
  if (!amount2 || amount2 <= 0) {
    alert("⚠️ Vui lòng nhập số lượng cho V2 > 0");
    return;
  }
  if (v1.status === "moving" || v2.status === "moving") {
    alert("Xe đang chạy, vui lòng chờ.");
    return;
  }

  setIsRunningTogether(true);

  const v1StartNow = v1.pos;
  const v2StartNow = v2.pos;

  const v2DelayTicks = 4; // tick = 1s => ~4s
  const v2DelayMs = 3500;

  // ===== Helper: reserve cell X trong [0..delayTicks] =====
  const buildDelayReserved = (pos, delayTicks) => {
    const s = new Set();
    for (let t = 1; t <= delayTicks; t++) {
      s.add(`${pos[0]},${pos[1]}@${t}`);
    }
    return s;
  };

  // ===== Helper: nếu path đi qua blockedPos trong các tick đầu => chèn wait ở đầu =====
  // pathFull có dạng [start,...]
  const applyWaitToAvoidDelayCell = (pathFull, blockedPos, delayTicks) => {
    if (!pathFull || pathFull.length < 2) return pathFull;
    const start = pathFull[0];
    const isBlocked = (p) => p[0] === blockedPos[0] && p[1] === blockedPos[1];

    let wait = 0;
    // giả lập tick theo index: pathFull[t] là vị trí tại tick t
    // nếu trong t <= delayTicks mà rơi vào cell bị chiếm => tăng wait
    while (true) {
      let conflict = false;
      for (let t = 0; t <= delayTicks; t++) {
        const idx = t - wait;
        if (idx >= 0 && idx < pathFull.length) {
          const posAtT = idx === 0 ? start : pathFull[idx];
          if (isBlocked(posAtT)) {
            conflict = true;
            break;
          }
        }
      }
      if (!conflict) break;
      wait++;
      if (wait > 10) break; // tránh vòng lặp vô hạn (an toàn)
    }

    if (wait <= 0) return pathFull;
    // chèn wait bản chất là đứng im tại start trong vài tick
    const waits = Array.from({ length: wait }, () => start);
    return [start, ...waits, ...pathFull.slice(1)];
  };

  // ===== 1) Tính “ai về 1.1 sớm hơn” bằng đường naive =====
  // (không tránh nhau, chỉ để quyết định winner)
  const v1Naive = aStarSearch(v1StartNow, v1.endPos, true, HOME);
  const v2Naive = aStarSearch(v2StartNow, v2.endPos, true, HOME);

  if (!v1Naive || v1Naive.length < 2 || !v2Naive || v2Naive.length < 2) {
    addLog("System", 0, "Không tìm được đường naive cho 1 trong 2 xe!");
    setIsRunningTogether(false);
    return;
  }

  // thời gian về HOME (tick) ~ (length - 1), cộng delay cho V2
  const v1HomeETA = v1Naive.length - 1;
  const v2HomeETA = (v2Naive.length - 1) + v2DelayTicks;

  // Winner = ai ETA nhỏ hơn -> được về 1.1
  // hòa thì ưu tiên V1
  const winnerId = v2HomeETA < v1HomeETA ? "V2" : "V1";
  const loserId = winnerId === "V1" ? "V2" : "V1";

  addLog("System", 0, `Ưu tiên bến 1.1: ${winnerId} (ETA ${winnerId === "V1" ? v1HomeETA : v2HomeETA} tick)`);

  // ===== 2) Plan WINNER về 1.1 (nhưng phải né cell của xe đang delay) =====
  // - Vì V2 có delay, ta coi cell start của V2 bị chiếm trong [0..delayTicks]
  //   => nếu winner là V1 thì V1 phải né cell v2StartNow lúc đầu
  // - Nếu winner là V2 thì V1 vẫn đi trước, nhưng V2 về 1.1; V1 sẽ là LOSER và về parking
  let winnerStart = winnerId === "V1" ? v1StartNow : v2StartNow;
  let winnerEnd = winnerId === "V1" ? v1.endPos : v2.endPos;

// Reserve cell của V2 trong thời gian delay để winner né (kể cả lúc winner=V1)
const delayReserved = new Set();
for (let t = 0; t <= v2DelayTicks; t++) delayReserved.add(`${v2StartNow[0]},${v2StartNow[1]}@${t}`);

// WINNER cũng plan bằng time-aware + corridor-aware
const winnerTimeOffset = winnerId === "V2" ? v2DelayTicks : 0;

let winnerFullPath = findSafePathWithReturn(
  winnerStart,
  winnerEnd,
  delayReserved,          // reservedTimes
  winnerTimeOffset,       // timeOffset
  [],                     // otherPath (chưa có)
  0,
  winnerTimeOffset,
  HOME                    // returnTarget: winner về 1.1
);

if (!winnerFullPath || winnerFullPath.length < 2) {
  addLog("System", 0, `${winnerId} không tìm được đường time-aware về 1.1`);
  setIsRunningTogether(false);
  return;
}

  // ===== 3) Build reservation từ WINNER để LOSER né head-on + node collision =====
  const reserved = new Set();

  // reserve cell của V2 trong thời gian delay (để ai cũng né)
  // (đặc biệt tránh V1 đi xuyên qua V2 khi V2 đang delay)
  for (const token of buildDelayReserved(v2StartNow, v2DelayTicks)) reserved.add(token);

  // reserve theo timeline của winnerFullPath
  for (let t = 1; t < winnerFullPath.length; t++) {
    const pos = winnerFullPath[t];
    reserved.add(`${pos[0]},${pos[1]}@${t}`);
  }

  // ===== 4) Plan LOSER: đi giao xong -> về bến 1.2..1.5 (không về 1.1) =====
  const loserStart = loserId === "V1" ? v1StartNow : v2StartNow;
  const loserEnd = loserId === "V1" ? v1.endPos : v2.endPos;

  const loserDelayTicks = loserId === "V2" ? v2DelayTicks : 0;
  const loserDelayMs = loserId === "V2" ? v2DelayMs : 0;

  let loserFullPath = null;
  let chosenPark = null;

  for (const park of PARKING_SPOTS) {
    // tránh chọn trùng với HOME hoặc trùng winnerStart
    if (samePos(park, HOME)) continue;
    if (samePos(park, winnerStart)) continue;

    const candidate = findSafePathWithReturn(
      loserStart,
      loserEnd,
      reserved,
      loserDelayTicks,     // timeOffset
      winnerFullPath,      // "otherPath" để né head-on
      0,
      loserDelayTicks,
      park                 // returnTarget: parking
    );

    if (candidate && candidate.length >= 2) {
      loserFullPath = candidate;
      chosenPark = park;
      break;
    }
  }

  if (!loserFullPath) {
    addLog("System", 0, `${loserId} không tìm được đường an toàn + bến đỗ!`);
    setIsRunningTogether(false);
    return;
  }

  // ===== 5) Start thực tế: V1 luôn chạy trước, V2 delay 3–4s =====
  // - Nếu winnerId = V2, thì V2 vẫn delay, nhưng mục tiêu về HOME.
  // - Xe nào được đỗ 1.1 thì path về HOME; xe còn lại về chosenPark.
  const startVehicle = (id, pathFull, cargo, delayMs) => {
    const setter = id === "V1" ? setV1 : setV2;
    const endPos = id === "V1" ? v1.endPos : v2.endPos;
    const startPos = id === "V1" ? v1StartNow : v2StartNow;

    const run = () => {
      setter((prev) => ({
        ...prev,
        path: pathFull.slice(1),
        status: "moving",
        deliveries: prev.deliveries + 1,
        tripLog: pathFull,
        activeCargo: cargo,
      }));
      saveTripLog(id, startPos, endPos, cargo, pathFull);
      addLog(id, 0, pathFull);
    };

    if (delayMs > 0) setTimeout(run, delayMs);
    else run();
  };

  // V1 luôn start ngay; V2 start sau delay
  // -> nên nếu id là V2 thì delayMs = v2DelayMs, còn V1 delayMs=0
  const v1PathToUse = winnerId === "V1" ? winnerFullPath : loserFullPath;
  const v2PathToUse = winnerId === "V2" ? winnerFullPath : loserFullPath;

  startVehicle("V1", v1PathToUse, amount1, 0);
  startVehicle("V2", v2PathToUse, amount2, v2DelayMs);

  setCargoAmounts({ V1: "", V2: "" });

  if (chosenPark) addLog("System", 0, `${loserId} sẽ về bến đỗ ${chosenPark[0]}.${chosenPark[1]} (không về 1.1)`);
};


  // CHỈ CHO SET endPos, KHÔNG CHO SET startPos
  const updateVehicle = (id, field, value) => {
    if (field === "startPos") return; // khóa start
    const setVehicle = id === "V1" ? setV1 : setV2;
    setVehicle((prev) => ({ ...prev, [field]: value }));
  };

  // ===== Tick chạy xe =====
  useEffect(() => {
    const interval = setInterval(() => {
      [
        [v1, setV1],
        [v2, setV2],
      ].forEach(([vehicle, setVehicle]) => {
        if (vehicle.path.length > 0) {
          const nextPos = vehicle.path[0];
          const isAtDestination =
            nextPos[0] === vehicle.endPos[0] && nextPos[1] === vehicle.endPos[1];

          let currentCargo = vehicle.activeCargo;

          if (isAtDestination && currentCargo > 0) {
            updateInventoryStorage(nextPos, currentCargo, vehicle.id);
            currentCargo = 0;
          }

          setVehicle((prev) => ({
            ...prev,
            prevPos: prev.pos,
            pos: nextPos,
            path: prev.path.slice(1),
            status: prev.path.length === 1 ? "idle" : "moving",
            activeCargo: currentCargo,
          }));
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [v1.path, v2.path]);

  // cảnh báo trùng line (giữ lại)
  useEffect(() => {
    if (v1.tripLog && v2.tripLog) {
      const v1Cells = new Set(v1.tripLog.map((p) => `${p[0]},${p[1]}`));
      const v2Cells = new Set(v2.tripLog.map((p) => `${p[0]},${p[1]}`));
      const common = [...v1Cells].filter((c) => v2Cells.has(c));
      if (common.length > 2) setAlertMessage(`CẢNH BÁO: Trùng ${common.length - 2} bước di chuyển!`);
      else setAlertMessage("");
    }
  }, [v1.tripLog, v2.tripLog]);

  useEffect(() => {
    if (v1.status === "idle" && v2.status === "idle" && isRunningTogether) setIsRunningTogether(false);
  }, [v1.status, v2.status, isRunningTogether]);

  const handleResetApp = () => {
    if (confirm("Reset toàn bộ trạng thái về mặc định?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        padding: "30px 40px",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <ClockDisplay />

      <h1
        style={{
          textAlign: "center",
          margin: "20px 0 40px",
          fontSize: "3rem",
          fontWeight: 800,
          background: "linear-gradient(45deg, #60a5fa, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: "0 0 30px rgba(96,165,250,0.35)",
        }}
      >
        AUTOMATION CAR DELIVERY
      </h1>

      <div
        style={{
          display: "flex",
          gap: 30,
          justifyContent: "center",
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        {/* CỘT 1: BẢN ĐỒ */}
        <div style={{ flex: "0 0 auto" }}>
          <MapGrid v1={v1} v2={v2} />
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
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <UnifiedControlPanel
              v1={v1}
              v2={v2}
              cargoAmounts={cargoAmounts}
              setCargoAmounts={setCargoAmounts}
              onChange={updateVehicle}
              onStart={handleStart}
              onStartTogether={handleStartTogetherSafe}
            />

            {alertMessage && (
              <div style={{ marginTop: 15, width: "100%", maxWidth: "500px" }}>
                <CollisionAlert message={alertMessage} />
              </div>
            )}

            <div style={{ marginTop: 20, display: "flex", gap: 10, flexDirection: "column" }}>
              <button
                onClick={handleManualTest}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#22c55e",
                  color: "#0f172a",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Test nhập kho (+10 vào 5,1)
              </button>

              <button
                onClick={() => navigate("/warehouse")}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#60a5fa",
                  color: "#0f172a",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Qua trang Quản lý kho
              </button>

              <button
                onClick={handleResetApp}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Reset App
              </button>

              <div style={{ marginTop: 10 }}>
                <PageSwitchButtons onGoLog={() => navigate("/log")} />
              </div>
            </div>
          </div>

          {/* B. Log */}
          <div style={{ flex: 1, minWidth: 520 }}>
            <DeliveryLog logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
