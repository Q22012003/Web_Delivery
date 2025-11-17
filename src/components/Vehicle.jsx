// src/components/Vehicle.jsx
import CarIcon from "./CarIcon";

export default function Vehicle({ id, pos, nextPos, status, index = 0 }) {
  const [row, col] = pos || [1, 1];

  let x = (col - 1) * 20 + 10;
  let y = (5 - row) * 20 + 10;

  // KHI Ở 1.1 → ĐẬU SÁT MÉP DƯỚI HOÀN TOÀN
  if (row === 1 && col === 1) {
    y = 96; // Đẩy xuống gần sát đáy nhất có thể

    // V1 và V2 nằm cạnh nhau, sát đáy
    if (index === 0) {
      x = 7;   // V1 bên trái
    } else {
      x = 13;  // V2 bên phải
    }
  }

  // Animation mượt
  if (nextPos) {
    const [nr, nc] = nextPos;
    const targetX = (nc - 1) * 20 + 10;
    const targetY = (5 - nr) * 20 + 10;
    x += (targetX - x) * 0.5;
    y += (targetY - y) * 0.5;
  }

  const color = id === "V1" ? "#ff4444" : "#00C853";

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: "18%",
        // QUAN TRỌNG: Chỉ dịch Y xuống, không dịch lên nữa → xe sẽ chạm đáy
        transform: index === 0 && row === 1 && col === 1
          ? "translate(-50%, -30%)"   // V1: chỉ dịch xuống một chút
          : index === 1 && row === 1 && col === 1
          ? "translate(-50%, -35%)"   // V2: dịch xuống hơn tí để sát đáy
          : "translate(-50%, -50%)",  // Các vị trí khác: giữa ô bình thường
        transition: "all 0.8s cubic-bezier(0.32, 0, 0.67, 0)",
        zIndex: row === 1 && col === 1 ? (index === 0 ? 15 : 20) : 10,
        pointerEvents: "none",
      }}
    >
      <CarIcon color={status === "moving" ? color : "#666666"} />

      <div
        style={{
          position: "absolute",
          top: "110%",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.92)",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "1.1vw",
          padding: "3px 8px",
          borderRadius: "8px",
          border: `2px solid ${color}`,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
        }}
      >
        {id}
      </div>
    </div>
  );
}