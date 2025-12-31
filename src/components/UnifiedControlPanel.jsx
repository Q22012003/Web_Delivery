// src/components/UnifiedControlPanel.jsx
import React from "react";

const DELIVERY_POINTS = [
  { label: "5.1  ([5,1])", value: [5, 1] },
  { label: "5.2  ([5,2])", value: [5, 2] },
  { label: "5.3  ([5,3])", value: [5, 3] },
  { label: "5.4  ([5,4])", value: [5, 4] },
  { label: "5.5  ([5,5])", value: [5, 5] },
];

export default function UnifiedControlPanel({
  v1,
  v2,
  cargoAmounts,
  setCargoAmounts,
  onChange,
  onStart,
  onStartTogether,
}) {
  const renderVehicleControl = (vehicle) => {
    const isV1 = vehicle.id === "V1";
    const headerColor = isV1 ? "#2563eb" : "#0891b2";
    const bgColor = isV1 ? "#eff6ff" : "#ecfeff";

    const currentEndVal = vehicle.endPos ? JSON.stringify(vehicle.endPos) : JSON.stringify([5, 1]);

    return (
      <div
        style={{
          background: bgColor,
          padding: "18px",
          borderRadius: "12px",
          border: `1px solid ${isV1 ? "#bfdbfe" : "#cffafe"}`,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3
            style={{
              margin: 0,
              color: headerColor,
              fontSize: "1.1rem",
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            XE {vehicle.id}
          </h3>
          <span
            style={{
              fontSize: "0.85rem",
              background: headerColor,
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "6px",
              fontWeight: "bold",
            }}
          >
            {vehicle.status === "moving" ? "MOVING" : "IDLE"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 15 }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
              Vị trí hiện tại
            </label>
            <div
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px dashed #94a3b8",
                background: "#f1f5f9",
                fontSize: "0.95rem",
                color: "#334155",
                fontWeight: 700,
                boxSizing: "border-box",
              }}
            >
              [{vehicle.pos?.[0]}, {vehicle.pos?.[1]}]
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
              Kết thúc (5.1 → 5.5)
            </label>
            <select
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontSize: "0.95rem",
                color: "#334155",
                cursor: "pointer",
              }}
              value={currentEndVal}
              onChange={(e) => onChange(vehicle.id, "endPos", JSON.parse(e.target.value))}
              disabled={vehicle.status === "moving"}
            >
              {DELIVERY_POINTS.map((opt) => (
                <option key={opt.label} value={JSON.stringify(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 15 }}>
          <input
            type="number"
            min="1"
            placeholder={`Nhập số hàng ${vehicle.id}...`}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.95rem",
              boxSizing: "border-box",
            }}
            value={cargoAmounts[vehicle.id] ?? ""}
            onChange={(e) => setCargoAmounts((prev) => ({ ...prev, [vehicle.id]: e.target.value }))}
            disabled={vehicle.status === "moving"}
          />
        </div>

        <div style={{ fontSize: "0.85rem", color: "#475569", marginBottom: 10 }}>
          • Điểm về mặc định: <b>1.1</b>
          <br />
          • Khi chạy 2 xe: xe về sau tự chọn bến <b>1.2 → 1.5</b> (không về 1.1)
        </div>

        <button
          onClick={() => onStart(vehicle.id)}
          disabled={vehicle.status === "moving"}
          style={{
            width: "100%",
            padding: "12px",
            background: isV1 ? "#3b82f6" : "#06b6d4",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: vehicle.status === "moving" ? "not-allowed" : "pointer",
            fontWeight: "bold",
            fontSize: "0.95rem",
            opacity: vehicle.status === "moving" ? 0.6 : 1,
            transition: "all 0.2s",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          {vehicle.status === "moving" ? "Đang chạy..." : `Bắt đầu ${vehicle.id}`}
        </button>
      </div>
    );
  };

  return (
    <div
      style={{
        background: "#ffffff",
        padding: "30px",
        borderRadius: "20px",
        boxShadow: "0 15px 35px -5px rgba(0, 0, 0, 0.15)",
        minWidth: "420px",
        flex: 1,
        maxWidth: "500px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "20px",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          color: "#1e293b",
          margin: "0 0 10px 0",
          fontSize: "1.4rem",
          fontWeight: "800",
          letterSpacing: "1px",
          textTransform: "uppercase",
        }}
      >
        Bảng Điều Khiển
      </h2>

      {renderVehicleControl(v1)}
      {renderVehicleControl(v2)}

      <div style={{ marginTop: "10px" }}>
        <button
          onClick={onStartTogether}
          style={{
            width: "100%",
            padding: "16px",
            background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "1.2rem",
            textTransform: "uppercase",
            boxShadow: "0 10px 20px -5px rgba(37, 99, 235, 0.4)",
            letterSpacing: "1px",
          }}
        >
          CHẠY CÙNG LÚC (V1 trước, V2 delay 3–4s)
        </button>
      </div>
    </div>
  );
}
