// src/components/UnifiedControlPanel.jsx
import React from "react";

export default function UnifiedControlPanel({
  v1,
  v2,
  cargoAmounts,
  setCargoAmounts,
  onChange,
  onStart,
  onStartTogether,
}) {
  const coordinateOptions = [];
  for (let x = 1; x <= 5; x++) {
    for (let y = 1; y <= 5; y++) {
      coordinateOptions.push({
        label: `[${x}, ${y}]`,
        value: JSON.stringify([x, y]),
      });
    }
  }

  const renderVehicleControl = (vehicle) => {
    const isV1 = vehicle.id === "V1";
    const headerColor = isV1 ? "#2563eb" : "#0891b2";
    const bgColor = isV1 ? "#eff6ff" : "#ecfeff";

    const currentStartVal = vehicle.startPos ? JSON.stringify(vehicle.startPos) : JSON.stringify(vehicle.pos);
    const currentEndVal = vehicle.endPos ? JSON.stringify(vehicle.endPos) : JSON.stringify([5, 3]);

    return (
      <div 
        style={{ 
          background: bgColor,
          padding: "18px", 
          borderRadius: "12px",
          border: `1px solid ${isV1 ? "#bfdbfe" : "#cffafe"}`,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
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
               fontWeight: "bold"
             }}
          >
            {vehicle.status === "moving" ? "MOVING" : "IDLE"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 15 }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
              Xuất phát
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
                cursor: "pointer"
              }}
              value={currentStartVal}
              onChange={(e) => onChange(vehicle.id, "startPos", JSON.parse(e.target.value))}
              disabled={vehicle.status === "moving"}
            >
              {coordinateOptions.map((opt) => (
                <option key={opt.label} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
              Kết thúc
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
                cursor: "pointer"
              }}
              value={currentEndVal}
              onChange={(e) => onChange(vehicle.id, "endPos", JSON.parse(e.target.value))}
              disabled={vehicle.status === "moving"}
            >
              {coordinateOptions.map((opt) => (
                <option key={opt.label} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 15 }}>
          <input
            type="text"
            placeholder={`Nhập số hàng ${vehicle.id}...`}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.95rem",
              boxSizing: "border-box",
              transition: "border 0.2s"
            }}
            value={cargoAmounts[vehicle.id]}
            onChange={(e) =>
              setCargoAmounts((prev) => ({ ...prev, [vehicle.id]: e.target.value }))
            }
          />
        </div>

        <button
          onClick={() => onStart(vehicle.id, vehicle.startPos, vehicle.endPos)}
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
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
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
        boxSizing: "border-box"
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
          textTransform: "uppercase"
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
            transition: "transform 0.1s, box-shadow 0.2s",
            letterSpacing: "1px"
          }}
          onMouseEnter={(e) => e.target.style.transform = "translateY(-2px)"}
          onMouseLeave={(e) => e.target.style.transform = "translateY(0)"}
          onMouseDown={(e) => e.target.style.transform = "scale(0.98)"}
          onMouseUp={(e) => e.target.style.transform = "scale(1)"}
        >
          CHẠY CÙNG LÚC
        </button>
      </div>
    </div>
  );
}