import Vehicle from "./Vehicle";

export default function MapGrid({ v1, v2 }) {
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
      {/* Lưới 5x5 đồng bộ 1 màu */}
      {Array.from({ length: 5 }, (_, i) => {
        const row = 5 - i;
        return Array.from({ length: 5 }, (_, j) => {
          const col = j + 1;
          return (
            <div
              key={`${row}-${col}`}
              style={{
                position: "absolute",
                left: j * 166.66,
                top: i * 166.66,
                width: 166.66,
                height: 166.66,
                border: "2px solid rgba(255,255,255,0.12)",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-start",
                padding: 12,
                fontSize: "16px",
                fontWeight: "bold",
                color: "#6b7280",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {row}.{col}
            </div>
          );
        });
      })}

      {/* 2 xe */}
      <Vehicle
        id={v1.id}
        pos={v1.pos}
        status={v1.status}
        nextPos={v1.path[0]}
        index={0}
      />
      <Vehicle
        id={v2.id}
        pos={v2.pos}
        status={v2.status}
        nextPos={v2.path[0]}
        index={1}
      />
    </div>
  );
}
