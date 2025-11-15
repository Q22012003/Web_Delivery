// Vehicle.jsx
import CarIcon from "./CarIcon";

export default function Vehicle({ id, pos, nextPos, status, index = 0 }) {
  const cellSize = 1000 / 6;
  const carWidth = 82;
  const carHeight = 100;

  const [row, col] = pos;
  let x = (col - 1) * cellSize + (cellSize - carWidth) / 2;
  let y = (6 - row) * cellSize - 85;

  if (index === 0) y += 16;
  x += index * 26;
  y += index * 14;

  // Animation mượt khi di chuyển
  if (nextPos) {
    const [nr, nc] = nextPos;
    const dx = (nc - col) * cellSize;
    const dy = (nr - row) * -cellSize;
    const t = 0.5;
    x += dx * t;
    y += dy * t;
  }

  const color = id === "V1" ? "#ff4444" : "#00C853";

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: carWidth,
        height: carHeight,
        transition: "all 0.8s cubic-bezier(0.32, 0, 0.67, 0)",
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      <CarIcon color={status === "idle" ? "#666" : color} />
      <div
        style={{
          position: "absolute",
          bottom: -36,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.9)",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "15px",
          padding: "6px 14px",
          borderRadius: "10px",
          border: "1px solid #4ade80",
          boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        }}
      >
        {id}
      </div>
    </div>
  );
}