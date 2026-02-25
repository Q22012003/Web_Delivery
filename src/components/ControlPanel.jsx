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
        border: "1px solid rgba(148,163,184,0.14)",
        padding: 16,
        borderRadius: 10,
        background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))",
        border: "1px solid rgba(148,163,184,0.14)",
        color: "#e2e8f0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <h3 style={{ margin: "0 0 12px", color: "#67e8f9" }}>
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
            background: "rgba(2,6,23,0.35)",
            border: "1px solid rgba(148,163,184,0.18)",
            borderRadius: 6,
            color: "#e2e8f0",
          }}
        />
        <div style={{ fontSize: 12, marginTop: 6, color: "rgba(226,232,240,0.72)" }}>
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
          style={{ width: "100%", boxSizing: "border-box", padding: 8, marginTop: 4, background: "rgba(2,6,23,0.35)", color: "#e2e8f0", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 6 }}
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
          background: status === "moving" ? "rgba(148,163,184,0.25)" : "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))",
          color: "#e2e8f0",
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
