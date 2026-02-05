export default function ControlPanel({ vehicle, onChange, onStart }) {
  const { id, endPos, status } = vehicle;

  const getDefaultStartPos = (vehicleId) => {
    // V1 -> [1,1], V2 -> [1,2], ...
    const m = String(vehicleId ?? "").match(/\d+/);
    const n = m ? Number(m[0]) : 1;
    const y = Math.min(5, Math.max(1, n));
    return [1, y];
  };

  // ✅ Vị trí xuất phát: chỉ hiển thị (user không được chỉnh)
  // Ưu tiên startPos (Home), fallback pos (RealTime), fallback theo id.
  const startPos = Array.isArray(vehicle.startPos)
    ? vehicle.startPos
    : Array.isArray(vehicle.pos)
    ? vehicle.pos
    : getDefaultStartPos(id);

  const safeEndPos = Array.isArray(endPos) ? endPos : [5, 1];

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

      {/* ===== START POSITION (READ-ONLY) ===== */}
      <div style={{ marginBottom: 12 }}>
        <label>
          <strong>Xuất phát (tự động):</strong>
        </label>
        <input
          value={`${startPos[0]}.${startPos[1]}`}
          readOnly
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 8,
            marginTop: 4,
            background: "#f3f3f3",
            border: "1px solid #ccc",
            borderRadius: 6,
            color: "#333",
          }}
        />
        <div style={{ fontSize: 12, marginTop: 6, color: "#666" }}>
          Bạn chỉ xem vị trí xuất phát. Hệ thống sẽ tự cập nhật nếu xe về bến đỗ khác.
        </div>
      </div>

      {/* ===== END POSITION ===== */}
      <div style={{ marginBottom: 16 }}>
        <label>
          <strong>Kết thúc giao hàng:</strong>
        </label>
        <select
          value={safeEndPos.join(",")}
          onChange={(e) =>
            onChange("endPos", e.target.value.split(",").map(Number))
          }
          disabled={status === "moving"}
          style={{ width: "100%", boxSizing: "border-box", padding: 8, marginTop: 4 }}
        >
          {endPoints.map((p) => (
            <option key={p.join(",")} value={p.join(",")}>
              [{p.join(", ")}]
            </option>
          ))}
        </select>
      </div>

      {/* ===== START BUTTON ===== */}
      <button
        onClick={onStart}
        disabled={status === "moving"}
        style={{
          width: "100%",
          boxSizing: "border-box",
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
