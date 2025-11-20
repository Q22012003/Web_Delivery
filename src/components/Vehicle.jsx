// src/components/Vehicle.jsx
import CarIcon from "./CarIcon";

export default function Vehicle({ id, pos, status, index = 0 }) {
  if (!pos) return null;
  const [row, col] = pos;

  // Tính vị trí gốc (center của cell)
  let x = (col - 1) * 20 + 10;
  let y = (5 - row) * 20 + 10;

  // ===== ÉP SÁT THEO LINE CHUẨN =====

  // SÁT TRÁI CHO CỘT 1
  if (col === 1) {
    x = (col - 1) * 20 + 3.8; // 6.8% từ mép → sát line trái
  }

  if (col === 2) x = (col - 1) * 20 + 4; // lùi 1 tí giống 1.1
  if (col === 3) x = (col - 1) * 20 + 4;
  if (col === 4) x = (col - 1) * 20 + 4;

  // SÁT LINE TRÁI CỦA CỘT 5
  if (col === 5) {
    x = (col - 1) * 20 + 4; // 13.2% từ mép trái của group cột 5
  }

  // ===== HẠ TRỌNG TÂM THEO ROW =====

  // SÁT LINE DƯỚI (row 1)
  if (row === 1) {
    y = 94.8; // sát line dưới
  }

  // SÁT LINE TRÊN (row 5)
  if (row === 5) {
    y = (5 - 5) * 20 + 15.2; // sát line trên
  }

  // HÀNG 2–4: hạ nhẹ cho bánh chạm line
  if (row >= 2 && row <= 4) {
    y += 2.2;
  }

  // ===== CASE ĐẶC BIỆT CHO 1.1 (CHỒNG XE ĐẸP) =====
  if (row === 1 && col === 1) {
    y = 94.8;

    if (index === 0) x = 3.8; // V1 sát line trái
    if (index === 1) x = 10.5; // V2 chồng sau vừa đẹp
  }

  // 5. Hạ trọng tâm toàn bộ xe xuống thêm tí nữa cho bánh CHẠM ĐẤT
  y += 2.8; // ← CÁI NÀY LÀ CHÌA KHÓA VÀNG: hạ xe xuống để bánh chạm line

  const color = id === "V1" ? "#ff4444" : "#00C853";

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: "11.5%",
        transform: "translate(-50%, -50%)",
        transition: "all 0.8s cubic-bezier(0.32, 0, 0.67, 0)",
        zIndex: row === 1 ? 50 : row === 5 ? 48 : 30,
        pointerEvents: "none",
      }}
    >
      <CarIcon color={status === "moving" ? color : "#666666"} />

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
          padding: "4px 10px",
          borderRadius: "9px",
          border: `2.5px solid ${color}`,
          whiteSpace: "nowrap",
          boxShadow: "0 6px 16px rgba(0,0,0,0.8)",
        }}
      >
        {id}
      </div>
    </div>
  );
}
