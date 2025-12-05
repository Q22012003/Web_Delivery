// src/components/Vehicle.jsx
import CarIcon from "./CarIcon";

export default function Vehicle({ id, pos,prevPos, status, index = 0 }) {
  if (!pos) return null;
  const [row, col] = pos;

  const isV1 = id === "V1";
  const isV2 = id === "V2";

  // Chỉ bật đèn khi xe thực sự đang di chuyển (status === "moving")
  const stopped = prevPos && prevPos[0] === row && prevPos[1] === col;
  const lightsOn = status === "moving" && !stopped;
  


  // Màu cơ bản của xe
  const baseColor = isV1 ? "#ff4444" : "#00C853";

  // Màu xe + nhãn: bật đèn → màu sáng, tắt đèn → xám
  const carColor = lightsOn ? baseColor : "#666666";
  const labelColor = lightsOn ? baseColor : "#888888";

  // Tính vị trí như cũ
  let x = (col - 1) * 20 + 10;
  let y = (5 - row) * 20 + 10;

  if (col === 2) x = (col - 1) * 20 + 4;
  if (col === 3) x = (col - 1) * 20 + 4;
  if (col === 4) x = (col - 1) * 20 + 4;
  if (col === 5) x = (col - 1) * 20 + 4;

  if (row === 1) y = 94.8;
  if (row === 5) y = (5 - 5) * 20 + 15.2;
  if (row >= 2 && row <= 4) {
    const rowOffsets = { 2: 6.5, 3: 4.5, 4: 4.3 };
    y += rowOffsets[row] || 0;
  }

  // Trường hợp đặc biệt ô [1,1] – 2 xe chồng lên nhau
  if (row === 1 && col === 1) {
    y = 94.8;
    if (index === 0) x = 3.8;   // V1 sát trái
    if (index === 1) x = 10.5;  // V2 chồng sau
  }
  if (col === 1 && status === "moving") {
    x = (col - 1) * 20 + 3.8;
  }
  y += 2.8; // Hạ xe xuống cho bánh chạm đất

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: "11.5%",
        transform: "translate(-50%, -50%)",
        transition: "all 0.88s cubic-bezier(0.32, 0.08, 0.24, 1)",
        zIndex: row === 1 ? 50 : row === 5 ? 48 : 30,
        pointerEvents: "none",
        filter: lightsOn
          ? "drop-shadow(0 0 12px rgba(255,255,255,0.6))"
          : "none",
        opacity: lightsOn ? 1 : 0.75,
      }}
    >
      <CarIcon color={carColor} />

      <div
        style={{
          position: "absolute",
          top: "140%",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.95)",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "0.95vw",
          padding: "4px 11px",
          borderRadius: "10px",
          border: `2.5px solid ${labelColor}`,
          whiteSpace: "nowrap",
          boxShadow: "0 6px 16px rgba(0,0,0,0.8)",
          opacity: lightsOn ? 1 : 0.7,
          transition: "all 0.4s",
        }}
      >
        {id} {lightsOn ? "" : "(đang chờ)"}
      </div>
    </div>
  );
}