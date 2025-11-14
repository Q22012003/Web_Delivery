// src/components/Vehicle.jsx
import CarIcon from "./CarIcon";

export default function Vehicle({ id, pos, nextPos, status, index = 0 }) {
  const cellSize = 1000 / 6; // 166.666...
  const carWidth = 82;
  const carHeight = 100;

  const [row, col] = pos; // row: 1-5, col: 1-5

  // Tọa độ gốc từ góc trên-trái của map-container (1000x1000)
  let x = (col - 1) * cellSize + (cellSize - carWidth) / 2;

  // QUAN TRỌNG: Đặt xe sát ĐƯỜNG DƯỚI của ô → nằm đúng trên LINE
  let y = (6 - row) * cellSize - 85;
  // Nếu là xe 1 → dịch xuống 14px cho sát đường line
  if (index === 0) {
    y += 14;
  }
  // 85px = từ đáy ô lên đến giữa xe → xe nằm gọn trên đường LINE

  // Di chuyển mượt giữa 2 ô
  if (nextPos) {
    const [nr, nc] = nextPos;
    const dx = (nc - col) * cellSize;
    const dy = (nr - row) * -cellSize; // row tăng = đi xuống
    const t = 0.5;
    x += dx * t;
    y += dy * t;
  }

  // 2 xe cùng ô → lệch nhẹ
  x += index * 22;
  y += index * 14;

  // Xác định hướng xe
  let direction = "down";
  if (nextPos) {
    const [nr, nc] = nextPos;
    if (nr > row) direction = "down";
    else if (nr < row) direction = "up";
    else if (nc > col) direction = "right";
    else if (nc < col) direction = "left";
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
      <CarIcon
        color={status === "idle" ? "#666" : color}
        direction={direction}
      />

      <div
        style={{
          position: "absolute",
          bottom: -32,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "15px",
          padding: "4px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.3)",
          whiteSpace: "nowrap",
        }}
      >
        {id}
      </div>
    </div>
  );
}
