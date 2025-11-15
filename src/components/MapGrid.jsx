// MapGrid.jsx - ĐÃ SỬA ĐÚNG THEO YÊU CẦU: ẨN Ô, CHỈ GIỮ SỐ
import Vehicle from "./Vehicle";

export default function MapGrid({ v1, v2 }) {
  // Các ô cần ẨN HOÀN TOÀN (nền + viền), chỉ giữ lại số
  const hiddenCells = new Set([
    "5,1", "5,2", "5,3", "5,4", "5,5",
    "1,5", "2,5", "3,5", "4,5"
  ]);

  return (
    <div
      style={{
        width: "833px",
        height: "833px",
        position: "relative",
        border: "12px solid #1a1a1a",
        background: "linear-gradient(135deg, #2c3e50 0%, #1a1a2f 100%)",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
      }}
    >
      {/* Lưới 5x5 */}
      {Array.from({ length: 5 }, (_, i) => {
        const row = 5 - i;
        return Array.from({ length: 5 }, (_, j) => {
          const col = j + 1;
          const key = `${row},${col}`;
          const isHidden = hiddenCells.has(key);

          return (
            <div
              key={key}
              style={{
                position: "absolute",
                left: j * 166.66,
                top: i * 166.66,
                width: 166.66,
                height: 166.66,
                // Nếu là ô cần ẩn → nền + viền trong suốt
                border: isHidden ? "2px solid transparent" : "2px solid rgba(255,255,255,0.12)",
                background: isHidden ? "transparent" : "rgba(255,255,255,0.03)",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-start",
                padding: 12,
                pointerEvents: "none",
              }}
            >
              {/* SỐ LUÔN HIỆN, kể cả ô bị ẩn */}
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#6b7280",
                  opacity: isHidden ? 0.7 : 1,
                }}
              >
                {row}.{col}
              </span>
            </div>
          );
        });
      })}

     

      <Vehicle id={v1.id} pos={v1.pos} status={v1.status} nextPos={v1.path[0]} index={0} />
      <Vehicle id={v2.id} pos={v2.pos} status={v2.status} nextPos={v2.path[0]} index={1} />
    </div>
  );
}