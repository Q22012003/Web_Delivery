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
          ? `drop-shadow(0 0 10px ${baseColor}88) drop-shadow(0 0 20px rgba(255,255,255,0.25))`
          : "drop-shadow(0 2px 10px rgba(0,0,0,0.35))",
        opacity: lightsOn ? 1 : 0.85,
      }}
    >
      {/* nền glow nhẹ dưới xe */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "62%",
          transform: "translate(-50%, -50%)",
          width: "70%",
          height: "28%",
          borderRadius: "999px",
          background: lightsOn
            ? `radial-gradient(circle at 50% 50%, ${baseColor}66 0%, rgba(0,0,0,0) 70%)`
            : "radial-gradient(circle at 50% 50%, rgba(148,163,184,0.18) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(6px)",
        }}
      />

      <CarIcon color={carColor} />

      {/* Label + badge */}
      <div
        style={{
          position: "absolute",
          top: "138%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(2,6,23,0.88)",
          border: `1px solid ${labelColor}AA`,
          boxShadow: "0 10px 24px rgba(0,0,0,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: lightsOn ? baseColor : "#94a3b8",
            boxShadow: lightsOn ? `0 0 10px ${baseColor}` : "none",
          }}
        />
        <span style={{ color: "#fff", fontWeight: 900, fontSize: "0.92vw", letterSpacing: "0.4px" }}>
          {id}
        </span>

        <span
          style={{
            fontSize: "0.72vw",
            fontWeight: 900,
            padding: "3px 8px",
            borderRadius: 999,
            color: lightsOn ? "#0b1220" : "#0b1220",
            background: lightsOn
              ? `linear-gradient(135deg, ${baseColor} 0%, rgba(255,255,255,0.85) 140%)`
              : "linear-gradient(135deg, #94a3b8 0%, rgba(255,255,255,0.75) 140%)",
          }}
        >
          {lightsOn ? "LIVE" : "WAIT"}
        </span>
      </div>
    </div>
  );

}