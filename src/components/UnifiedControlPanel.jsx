// src/components/UnifiedControlPanel.jsx
export default function UnifiedControlPanel({
  v1,
  v2,
  onChange,
  onStart,
  onStartTogether,
  disableAll = false, // ← NEW: khóa toàn bộ khi chạy đôi hoặc có xe đang chạy
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

  // Tắt toàn bộ nếu đang chạy đôi hoặc có xe đang chạy
  const isAnyMoving = v1.status === "moving" || v2.status === "moving";
  const allDisabled = disableAll || isAnyMoving;

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
        opacity: allDisabled ? 0.85 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      <h3
        style={{
          margin: "0 0 16px",
          color: "#1976d2",
          textAlign: "center",
          fontSize: "1.5rem",
          fontWeight: "bold",
        }}
      >
        BẢNG ĐIỀU KHIỂN XE GIAO HÀNG
      </h3>

      {/* === XE V1 === */}
      <div style={{ borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
        <h4
          style={{ margin: "0 0 12px", color: "#ff4444", fontWeight: "bold" }}
        >
          XE V1
        </h4>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontWeight: "bold",
              color: "#1565c0",
              display: "block",
              marginBottom: 4,
              textShadow: "0 1px 1px rgba(0,0,0,0.15)",
            }}
          >
            Xuất phát:
          </label>

          <select
            value={v1.startPos.join(",")}
            onChange={(e) =>
              onChange("V1", "startPos", e.target.value.split(",").map(Number))
            }
            disabled={allDisabled}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
          >
            {startPoints.map((p) => (
              <option key={p.join(",")} value={p.join(",")}>
                [{p.join(", ")}]
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontWeight: "bold",
              color: "#1565c0",
              display: "block",
              marginBottom: 4,
              textShadow: "0 1px 1px rgba(0,0,0,0.15)",
              letterSpacing: "0.3px",
            }}
          >
            Kết thúc:
          </label>

          <select
            value={v1.endPos.join(",")}
            onChange={(e) =>
              onChange("V1", "endPos", e.target.value.split(",").map(Number))
            }
            disabled={allDisabled}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
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
          disabled={allDisabled}
          style={{
            width: "100%",
            padding: 11,
            fontSize: 15,
            background: allDisabled ? "#999" : "#ff4444",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: "bold",
            cursor: allDisabled ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {v1.status === "moving" ? "V1 Đang giao hàng..." : "Bắt đầu V1"}
        </button>
      </div>

      {/* === XE V2 === */}
      <div>
        <h4
          style={{ margin: "0 0 12px", color: "#00C853", fontWeight: "bold" }}
        >
          XE V2
        </h4>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontWeight: "bold",
              color: "#1565c0",
              display: "block",
              marginBottom: 4,
              textShadow: "0 1px 1px rgba(0,0,0,0.15)",
            }}
          >
            Xuất phát:
          </label>

          <select
            value={v2.startPos.join(",")}
            onChange={(e) =>
              onChange("V2", "startPos", e.target.value.split(",").map(Number))
            }
            disabled={allDisabled}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
          >
            {startPoints.map((p) => (
              <option key={p.join(",")} value={p.join(",")}>
                [{p.join(", ")}]
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontWeight: "bold",
              color: "#1565c0",
              display: "block",
              marginBottom: 4,
              textShadow: "0 1px 1px rgba(0,0,0,0.15)",
              letterSpacing: "0.3px",
            }}
          >
            Kết thúc:
          </label>

          <select
            value={v2.endPos.join(",")}
            onChange={(e) =>
              onChange("V2", "endPos", e.target.value.split(",").map(Number))
            }
            disabled={allDisabled}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
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
          disabled={allDisabled}
          style={{
            width: "100%",
            padding: 11,
            fontSize: 15,
            background: allDisabled ? "#999" : "#00C853",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: "bold",
            cursor: allDisabled ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {v2.status === "moving" ? "V2 Đang giao hàng..." : "Bắt đầu V2"}
        </button>
      </div>

      {/* === NÚT CHẠY CÙNG LÚC === */}
      <button
        onClick={onStartTogether}
        disabled={allDisabled}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          background: allDisabled
            ? "#999"
            : "linear-gradient(135deg, #1976d2, #42a5f5)",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontWeight: "bold",
          cursor: allDisabled ? "not-allowed" : "pointer",
          boxShadow: allDisabled ? "none" : "0 4px 15px rgba(25,118,210,0.4)",
          transition: "all 0.3s ease",
          marginTop: 8,
        }}
      >
        {allDisabled ? "Đang thực hiện chuyến đi..." : "CHẠY CÙNG LÚC "}
      </button>

      {allDisabled && (
        <div
          style={{
            textAlign: "center",
            color: "#d32f2f",
            fontSize: "0.9rem",
            fontWeight: "bold",
            marginTop: 8,
            padding: "8px",
            background: "#ffebee",
            borderRadius: 6,
            border: "1px solid #ffcdd2",
          }}
        >
          Vui lòng chờ xe hoàn thành chuyến đi!
        </div>
      )}
    </div>
  );
}
