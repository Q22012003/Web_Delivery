// src/components/UnifiedControlPanel.jsx
export default function UnifiedControlPanel({
  v1,
  v2,
  onChange,
  onStart,
  onStartTogether,
  cargoAmounts = { V1: "", V2: "" },
  setCargoAmounts = () => {},
  disableAll = false,
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

  const isAnyMoving = v1.status === "moving" || v2.status === "moving";

  const allDisabled = disableAll || isAnyMoving;

  // ==== BOX INPUT NHẬP SỐ HÀNG ====
  const renderCargoInput = (label, key) => (
    <div style={{ marginBottom: 10 }}>
      <label style={styles.label}>{label}</label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="Nhập số hàng"
        value={cargoAmounts[key]}
        onChange={(e) =>
          setCargoAmounts({
            ...cargoAmounts,
            [key]: e.target.value.replace(/[^0-9]/g, ""),
          })
        }
        disabled={allDisabled}
        style={{
          ...styles.input,
          MozAppearance: "textfield", // Firefox
        }}
        onKeyDown={(e) => {
          // Ngăn mũi tên lên/xuống thay đổi giá trị
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
          }
        }}
      />
    </div>
  );

  const renderSelect = (value, onChange, options) => (
    <select
      value={value}
      onChange={onChange}
      disabled={allDisabled}
      style={styles.select}
    >
      {options.map((p) => (
        <option key={p.join(",")} value={p.join(",")}>
          [{p.join(", ")}]
        </option>
      ))}
    </select>
  );

  return (
    <div style={styles.panel}>
      <h3 style={styles.title}>BẢNG ĐIỀU KHIỂN XE GIAO HÀNG</h3>

      {/* ==== XE V1 ==== */}
      <div style={styles.vehicleBox}>
        <h4 style={{ ...styles.vehicleTitle, color: "#ff4444" }}>XE V1</h4>

        <label style={styles.label}>Xuất phát:</label>
        {renderSelect(
          v1.startPos.join(","),
          (e) =>
            onChange("V1", "startPos", e.target.value.split(",").map(Number)),
          startPoints
        )}

        <label style={styles.label}>Kết thúc:</label>
        {renderSelect(
          v1.endPos.join(","),
          (e) =>
            onChange("V1", "endPos", e.target.value.split(",").map(Number)),
          endPoints
        )}

        {renderCargoInput("Số hàng V1:", "V1")}

        <button
          onClick={() => onStart("V1")}
          disabled={allDisabled}
          style={{ ...styles.button, background: "#ff4444" }}
        >
          {v1.status === "moving" ? "V1 đang chạy..." : "Bắt đầu V1"}
        </button>
      </div>

      {/* ==== XE V2 ==== */}
      <div style={styles.vehicleBox}>
        <h4 style={{ ...styles.vehicleTitle, color: "#00C853" }}>XE V2</h4>

        <label style={styles.label}>Xuất phát:</label>
        {renderSelect(
          v2.startPos.join(","),
          (e) =>
            onChange("V2", "startPos", e.target.value.split(",").map(Number)),
          startPoints
        )}

        <label style={styles.label}>Kết thúc:</label>
        {renderSelect(
          v2.endPos.join(","),
          (e) =>
            onChange("V2", "endPos", e.target.value.split(",").map(Number)),
          endPoints
        )}

        {renderCargoInput("Số hàng V2:", "V2")}

        <button
          onClick={() => onStart("V2")}
          disabled={allDisabled}
          style={{ ...styles.button, background: "#00C853" }}
        >
          {v2.status === "moving" ? "V2 đang chạy..." : "Bắt đầu V2"}
        </button>
      </div>

      {/* ==== CHẠY CÙNG ==== */}
      <button
        onClick={onStartTogether}
        disabled={allDisabled}
        style={styles.togetherBtn}
      >
        {allDisabled ? "Đang thực hiện chuyến đi..." : "CHẠY CÙNG LÚC"}
      </button>
    </div>
  );
}

// ================= STYLES =================
const styles = {
  panel: {
    border: "2px solid #000",
    padding: 20,
    borderRadius: 12,
    background: "#fff",
    width: 360,
    boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  title: {
    margin: 0,
    color: "#1976d2",
    textAlign: "center",
    fontSize: "1.3rem",
    fontWeight: "bold",
  },
  vehicleBox: {
    borderBottom: "1px solid #ddd",
    paddingBottom: 12,
  },
  vehicleTitle: {
    margin: "0 0 8px",
    fontWeight: "bold",
  },
  label: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1565c0",
    marginTop: 6,
    display: "block",
  },
  select: {
    width: "100%",
    padding: 6,
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    width: "70%",
    padding: "5px 8px",
    fontSize: 13,
    borderRadius: 4,
    border: "1px solid #aaa",
    outline: "none",
  },
  button: {
    width: "100%",
    marginTop: 6,
    padding: 8,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontWeight: "bold",
    cursor: "pointer",
  },
  togetherBtn: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "none",
    fontWeight: "bold",
    background: "linear-gradient(135deg, #1976d2, #42a5f5)",
    color: "#fff",
  },
};
