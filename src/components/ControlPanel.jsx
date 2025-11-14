export default function ControlPanel({ vehicle, onChange, onStart }) {
  const { id, startPos, endPos, status } = vehicle;

  const startPoints = [
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
  ];
  const endPoints = [
    [5, 1],
    [5, 2],
    [5, 3],
    [5, 4],
    [5, 5],
  ];

  return (
    <div
      style={{
        border: "2px solid #000",
        padding: 16,
        borderRadius: 10,
        background: "#fff",
        width: 320,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <h3 style={{ margin: "0 0 12px", color: "#1976d2" }}>
        XE {id} – GIAO HÀNG
      </h3>

      <div style={{ marginBottom: 12 }}>
        <label>
          <strong>Xuất phát:</strong>
        </label>
        <select
          value={startPos.join(",")}
          onChange={(e) =>
            onChange("startPos", e.target.value.split(",").map(Number))
          }
          disabled={status === "moving"}
          style={{ width: "100%", padding: 8, marginTop: 4 }}
        >
          {startPoints.map((p) => (
            <option key={p.join(",")} value={p.join(",")}>
              [{p.join(", ")}]
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>
          <strong>Kết thúc giao hàng:</strong>
        </label>
        <select
          value={endPos.join(",")}
          onChange={(e) =>
            onChange("endPos", e.target.value.split(",").map(Number))
          }
          disabled={status === "moving"}
          style={{ width: "100%", padding: 8, marginTop: 4 }}
        >
          {endPoints.map((p) => (
            <option key={p.join(",")} value={p.join(",")}>
              [{p.join(", ")}]
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onStart}
        disabled={status === "moving"}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          background: status === "moving" ? "#999" : "#1976d2",
          color: "white",
          border: "none",
          borderRadius: 6,
          fontWeight: "bold",
        }}
      >
        {status === "moving" ? "Đang giao hàng..." : `Bắt đầu ${id}`}
      </button>
    </div>
  );
}
