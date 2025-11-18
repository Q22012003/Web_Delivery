// src/components/MapGrid.jsx
import Vehicle from "./Vehicle";

export default function MapGrid({ v1, v2 }) {
  const labels = [
    { text: "1.1", row: 1, line: 2 },
    { text: "1.2", row: 1, line: 3 },
    { text: "1.3", row: 1, line: 4 },
    { text: "1.4", row: 1, line: 5 },
    { text: "2.1", row: 2, line: 2 },
    { text: "2.2", row: 2, line: 3 },
    { text: "2.3", row: 2, line: 4 },
    { text: "2.4", row: 2, line: 5 },
    { text: "3.1", row: 3, line: 2 },
    { text: "3.2", row: 3, line: 3 },
    { text: "3.3", row: 3, line: 4 },
    { text: "3.4", row: 3, line: 5 },
    { text: "4.1", row: 4, line: 2 },
    { text: "4.2", row: 4, line: 3 },
    { text: "4.3", row: 4, line: 4 },
    { text: "4.4", row: 4, line: 5 },
    { text: "5.1", row: 5, line: 2 },
    { text: "5.2", row: 5, line: 3 },
    { text: "5.3", row: 5, line: 4 },
    { text: "5.4", row: 5, line: 5 },
  ];

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
      {/* Vẽ lưới ĐẦY ĐỦ 5x5 (5 LINE dọc x 5 LINE ngang) - đẹp và đồng bộ */}
      {Array.from({ length: 5 }, (_, i) =>
        Array.from({ length: 5 }, (_, j) => (
          <div
            key={`${i}-${j}`}
            style={{
              position: "absolute",
              left: `${j * 20}%`,
              top: `${i * 20}%`,
              width: "20%",
              height: "20%",
              border: "2px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.015)",
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          />
        ))
      )}

      {/* Nhãn đúng trên LINE thứ 2-5 */}
      {labels.map((label, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            left: `${(label.line - 1) * 20 - 18}%`, // sát mép trái
            top: `${(5 - label.row) * 20 + 18}%`, // sát mép dưới
            transform: "translate(-50%, -50%)",
            fontSize: "0.9vw",
            fontWeight: "bold",
            color: "#a5b4fc",
            textShadow: "0 0 12px rgba(0,0,0,0.9)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {label.text}
        </div>
      ))}

      <Vehicle
        id={v1.id}
        pos={v1.pos}
        status={v1.status}
        nextPos={v1.path?.[0]}
        index={0}
      />
      <Vehicle
        id={v2.id}
        pos={v2.pos}
        status={v2.status}
        nextPos={v2.path?.[0]}
        index={1}
      />
    </div>
  );
}
