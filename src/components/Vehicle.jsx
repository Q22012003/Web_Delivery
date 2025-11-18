// src/components/Vehicle.jsx
import CarIcon from "./CarIcon";

export default function Vehicle({ id, pos, nextPos, status, index = 0 }) {
  const [row, col] = pos || [1, 1];

  // BẬT CHẾ ĐỘ NÉ TUYỆT ĐỐI KHI CHẠY CÙNG LÚC (do Home.jsx set)
  const isDualMode = window.isDualMode === true;

  // Tắt hoàn toàn transition khi chạy cùng
  const transition = isDualMode
    ? "none !important"
    : "all 0.8s cubic-bezier(0.32, 0, 0.67, 0)";

  // Tính vị trí chính xác
  let x = (col - 1) * 20 + 10;
  let y = row === 1 ? 96 : (5 - row) * 20 + 10;

  // Dòng 1: lệch nhẹ để 2 xe không chồng nhau
  if (row === 1) {
    if (col === 1) {
      x = index === 0 ? 6 : 14;
    } else {
      x = (col - 1) * 20 + 10 + (index === 0 ? -2 : 2);
    }
  }

  const color = id === "V1" ? "#ff4444" : "#00C853";

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: "12%",
        transform:
          row === 1 ? "translate(-50%, -33%)" : "translate(-50%, -50%)",
        transition, // Ở đây tắt mượt khi chạy cùng
        zIndex: row === 1 ? (index === 0 ? 15 : 20) : 10,
        pointerEvents: "none",
        // Thêm !important để chắc chắn override
        transitionProperty: isDualMode ? "none" : "all",
        transitionDuration: isDualMode ? "0s" : "0.8s",
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
