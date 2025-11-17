// src/components/MapGrid.jsx
import Vehicle from "./Vehicle";

export default function MapGrid({ v1, v2 }) {
  return (
    <div
      style={{
        width: "70vw",
        maxWidth: "850px",
        aspectRatio: "1 / 1",
        position: "relative",
        border: "12px solid #1a1a1a",
        background: "linear-gradient(135deg, #2c3e50 0%, #1a1a2f 100%)",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
      }}
    >
      {/* Lưới 5x5 – chỉ hiện số, ẩn nền ở các ô đường như cũ */}
      {Array.from({ length: 5 }, (_, i) => {
        const row = 5 - i;
        return Array.from({ length: 5 }, (_, j) => {
          const col = j + 1;
          const key = `${row},${col}`;

          // SỬA LỖI TẠI ĐÂY: thêm dấu ngoặc đóng bị thiếu!
          const isHidden = [
            "5,1", "5,2", "5,3", "5,4", "5,5",
            "1,5", "2,5", "3,5", "4,5"
          ].includes(key);

          return (
            <div
              key={key}
              style={{
                position: "absolute",
                left: `${j * 20}%`,
                top: `${i * 20}%`,
                width: "20%",
                height: "20%",
                border: isHidden ? "2px solid transparent" : "2px solid rgba(255,255,255,0.12)",
                background: isHidden ? "transparent" : "rgba(255,255,255,0.03)",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-start",
                padding: "6%",
                pointerEvents: "none",
              }}
            >
              <span style={{
                fontSize: "1.9vw",
                fontWeight: "bold",
                color: "#64748b",
                opacity: isHidden ? 0.6 : 0.9,
              }}>
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