// src/components/Vehicle.jsx
import CarIcon from "./CarIcon";

export default function Vehicle({ id, pos, nextPos, status, index = 0 }) {
  const [row, col] = pos || [1, 1];

  // Tính toán vị trí phần trăm chuẩn (giữa ô)
  let x = (col - 1) * 20 + 10; // 10% là giữa ô theo chiều ngang
  let y = (5 - row) * 20 + 10; // 10% là giữa ô theo chiều dọc

  // ĐẶC BIỆT: Nếu xe đang ở dòng 1 (dòng trên cùng) → căn sát đáy ô
  const isAtTopRow = row === 1;

  if (isAtTopRow) {
    y = 96; // sát đáy lưới (giống như khi ở 1.1)

    // Chỉnh vị trí ngang để 2 xe không chồng nhau khi cùng xuất phát ở dòng 1
    if (col === 1) {
      x = index === 0 ? 6 : 14; // 1.1: V1 bên trái, V2 bên phải
    } else {
      // Các ô 1.2, 1.3, 1.4, 1.5: căn giữa ô, nhưng lệch nhẹ để đẹp
      x = (col - 1) * 20 + 10 + (index === 0 ? -2 : 2); // V1 lệch trái, V2 lệch phải
    }
  }

  // Animation mượt khi di chuyển
  if (nextPos && status === "moving") {
    const [nr, nc] = nextPos;
    const targetX = nc === 1 && nr === 1 ? (index === 0 ? 6 : 14) : (nc - 1) * 20 + 10 + (nr === 1 ? (index === 0 ? -2 : 2) : 0);
    const targetY = nr === 1 ? 96 : (5 - nr) * 20 + 10;

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
        width: "12%",
        transform: isAtTopRow
          ? "translate(-50%, -33%)"  // căn sát đáy khi ở dòng 1
          : "translate(-50%, -50%)", // căn giữa các ô khác
        transition: "all 0.8s cubic-bezier(0.32, 0, 0.67, 0)",
        zIndex: isAtTopRow ? (index === 0 ? 15 : 20) : 10,
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
          fontSize: "1vw",
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