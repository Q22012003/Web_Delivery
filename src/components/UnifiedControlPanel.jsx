// src/components/UnifiedControlPanel.jsx (New component)
export default function UnifiedControlPanel({
  v1,
  v2,
  onChange,
  onStart,
  onStartTogether,
}) {
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
        padding: 24,
        borderRadius: 12,
        background: "#fff",
        width: 400,
        boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <h3
        style={{
          margin: "0 0 16px",
          color: "#1976d2",
          textAlign: "center",
          fontSize: "1.5rem",
        }}
      >
        BẢNG ĐIỀU KHIỂN XE GIAO HÀNG
      </h3>

      {/* Phần cho V1 */}
      <div style={{ borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
        <h4 style={{ margin: "0 0 12px", color: "#ff4444" }}>XE V1</h4>
        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Xuất phát:</strong>
          </label>
          <select
            value={v1.startPos.join(",")}
            onChange={(e) =>
              onChange("V1", "startPos", e.target.value.split(",").map(Number))
            }
            disabled={v1.status === "moving"}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          >
            {startPoints.map((p) => (
              <option key={p.join(",")} value={p.join(",")}>
                [{p.join(", ")}]
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Kết thúc:</strong>
          </label>
          <select
            value={v1.endPos.join(",")}
            onChange={(e) =>
              onChange("V1", "endPos", e.target.value.split(",").map(Number))
            }
            disabled={v1.status === "moving"}
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
          onClick={() => onStart("V1")}
          disabled={v1.status === "moving"}
          style={{
            width: "100%",
            padding: 10,
            fontSize: 14,
            background: v1.status === "moving" ? "#999" : "#ff4444",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: "bold",
          }}
        >
          {v1.status === "moving" ? "Đang giao hàng..." : "Bắt đầu V1"}
        </button>
      </div>

      {/* Phần cho V2 */}
      <div>
        <h4 style={{ margin: "0 0 12px", color: "#00C853" }}>XE V2</h4>
        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Xuất phát:</strong>
          </label>
          <select
            value={v2.startPos.join(",")}
            onChange={(e) =>
              onChange("V2", "startPos", e.target.value.split(",").map(Number))
            }
            disabled={v2.status === "moving"}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          >
            {startPoints.map((p) => (
              <option key={p.join(",")} value={p.join(",")}>
                [{p.join(", ")}]
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            <strong>Kết thúc:</strong>
          </label>
          <select
            value={v2.endPos.join(",")}
            onChange={(e) =>
              onChange("V2", "endPos", e.target.value.split(",").map(Number))
            }
            disabled={v2.status === "moving"}
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
          onClick={() => onStart("V2")}
          disabled={v2.status === "moving"}
          style={{
            width: "100%",
            padding: 10,
            fontSize: 14,
            background: v2.status === "moving" ? "#999" : "#00C853",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: "bold",
          }}
        >
          {v2.status === "moving" ? "Đang giao hàng..." : "Bắt đầu V2"}
        </button>
      </div>

      {/* Nút chạy cùng lúc */}
      <button
        onClick={onStartTogether}
        disabled={v1.status === "moving" || v2.status === "moving"}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          background:
            v1.status === "moving" || v2.status === "moving"
              ? "#999"
              : "#1976d2",
          color: "white",
          border: "none",
          borderRadius: 6,
          fontWeight: "bold",
          marginTop: 16,
        }}
      >
        Chạy Cùng Lúc
      </button>
    </div>
  );
}
