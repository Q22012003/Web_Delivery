// src/pages/FleetStatus.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
/**
 * UI “xịn” đồng bộ Home.jsx:
 * - Glass header + gradient nền giống Home
 * - Summary cards
 * - Cards theo từng xe (V1..V5)
 *
 * Dữ liệu:
 * - vehicles lấy từ localStorage("home_vehicles_state") để hiển thị deliveries
 * - MQTT/Battery hiện đang placeholder (battery = 100; mqtt = connected/lost giả lập)
 *   Sau này bạn chỉ cần replace mqttMap bằng dữ liệu backend (WS/MQTT bridge).
 */

const loadVehicles = () => {
  try {
    const raw = localStorage.getItem("home_vehicles_state");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const makeMqttMapPlaceholder = (vehicles) => {
  // Placeholder: xen kẽ connected/lost cho nhìn “pro”
  const map = {};
  vehicles.forEach((v, idx) => {
    map[v.id] = idx % 3 === 0 ? "lost" : "connected";
  });
  return map;
};


const BatteryIcon = ({
  level = 0,
  width = 86,
  height = 30,
  showPercent = true,
  onClick,
  title,
}) => {
  const pct = Math.max(0, Math.min(100, Number(level) || 0));
  const capW = Math.max(6, Math.round(height * 0.18));
  const bodyW = width - capW - 2;
  const pad = 3;
  const innerW = bodyW - pad * 2;
  const fillW = Math.max(0, Math.round((innerW * pct) / 100));

  const isLow = pct <= 20;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: bodyW,
          height,
          borderRadius: Math.round(height / 2),
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(2,6,23,0.35)",
          boxShadow: "inset 0 0 0 1px rgba(2,6,23,0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: pad,
            top: pad,
            height: height - pad * 2,
            width: fillW,
            borderRadius: Math.round((height - pad * 2) / 2),
            background: isLow
              ? "linear-gradient(90deg, rgba(239,68,68,0.85), rgba(251,113,133,0.55))"
              : "linear-gradient(90deg, rgba(34,197,94,0.80), rgba(103,232,249,0.55))",
          }}
        />
        {showPercent && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: Math.max(12, Math.round(height * 0.38)),
              fontWeight: 950,
              letterSpacing: 0.2,
              color: "rgba(226,232,240,0.92)",
              textShadow: "0 1px 10px rgba(2,6,23,0.55)",
            }}
          >
            {pct}%
          </div>
        )}
      </div>

      <div
        style={{
          width: capW,
          height: Math.round(height * 0.48),
          borderRadius: 999,
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(148,163,184,0.10)",
        }}
      />
    </div>
  );
};


export default function FleetStatus() {
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState(() => loadVehicles());
  const [mqttMap, setMqttMap] = useState(() => makeMqttMapPlaceholder(loadVehicles()));
  const [batteryFocus, setBatteryFocus] = useState(null); // { id, level, mqtt, deliveries, status }

  useEffect(() => {
    const sync = () => {
      const v = loadVehicles();
      setVehicles(v);
      setMqttMap((prev) => {
        // giữ trạng thái cũ nếu đã có, còn thiếu thì tạo placeholder
        const next = { ...prev };
        v.forEach((x, idx) => {
          if (!next[x.id]) next[x.id] = idx % 3 === 0 ? "lost" : "connected";
        });
        return next;
      });
    };

    // refresh nhẹ mỗi 1s để “realtime” theo deliveries
    const t = setInterval(sync, 1000);
    return () => clearInterval(t);
  }, []);

  const summary = useMemo(() => {
    const total = vehicles.length || 0;
    const connected = vehicles.filter((v) => mqttMap[v.id] === "connected").length;
    const delivered = vehicles.reduce((s, v) => s + (v.deliveries || 0), 0);
    const lost = total - connected;
    return { total, connected, lost, delivered };
  }, [vehicles, mqttMap]);

  const badgeStyle = (status) => {
    const isOn = status === "connected";
    return {
      padding: "6px 10px",
      borderRadius: 999,
      border: `1px solid ${isOn ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
      background: isOn ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
      color: isOn ? "rgba(187,247,208,0.95)" : "rgba(254,202,202,0.95)",
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.2,
      whiteSpace: "nowrap",
    };
  };

  return (
    <div
      style={{
        padding: "30px 40px",
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.25), rgba(2,6,23,1) 60%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* BATTERY MODAL (Pin to 100% + bố cục rõ ràng) */}
      {batteryFocus && (
        <div
          onClick={() => setBatteryFocus(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.68)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 18,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)",
              borderRadius: 18,
              border: "1px solid rgba(148,163,184,0.16)",
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.72))",
              boxShadow: "0 24px 60px rgba(2,6,23,0.55)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(148,163,184,0.12)",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 950, letterSpacing: 0.4 }}>
                  {batteryFocus.id} • BATTERY
                </div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, opacity: 0.75 }}>
                  Hiển thị 100% (scale) • Nhấn ngoài để đóng
                </div>
              </div>

              <button
                onClick={() => setBatteryFocus(null)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(2,6,23,0.35)",
                  color: "#e2e8f0",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: 16,
                display: "grid",
                // auto-fit để khi màn nhỏ sẽ tự xuống dòng (bố cục lại khi pin to)
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid rgba(148,163,184,0.12)",
                  background: "rgba(2,6,23,0.35)",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <BatteryIcon level={batteryFocus.level} width={280} height={92} />
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid rgba(148,163,184,0.12)",
                  background: "rgba(2,6,23,0.35)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Connection</div>
                    <div style={{ marginTop: 8 }}>
                      <span style={badgeStyle(batteryFocus.mqtt)}>
                        {batteryFocus.mqtt === "connected" ? "CONNECTED" : "DISCONNECTED"}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Delivered</div>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 950, color: "#a78bfa" }}>
                      {batteryFocus.deliveries}
                    </div>
                  </div>
                </div>

                <div style={{ height: 14 }} />

                <div
                  style={{
                    padding: "12px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,0.10)",
                    background: "linear-gradient(180deg, rgba(148,163,184,0.06), rgba(2,6,23,0.15))",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Mode</div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 950 }}>
                      {batteryFocus.status === "moving" ? "🚚 Moving" : "🅿️ Idle"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Battery level</div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 950 }}>
                      {Math.max(0, Math.min(100, Number(batteryFocus.level) || 0))}%
                    </div>
                  </div>
                </div>

                <div style={{ height: 12 }} />
                <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, lineHeight: 1.5 }}>
                  Tip: Có thể thay <b>level</b> bằng dữ liệu realtime (MQTT/WS).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          marginBottom: 22,
          padding: "12px 18px",
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,0.12)",
          background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))",
          backdropFilter: "blur(8px)",
          height: 74,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.6 }}>
            FLEET STATUS
          </div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, opacity: 0.75 }}>
            Connection • Battery • Delivered Orders (realtime)
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setVehicles(loadVehicles())}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "rgba(2,6,23,0.35)",
              color: "#e2e8f0",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
            }}
          >
            🔄 Refresh
          </button>

          <button
            onClick={() => navigate("/")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(96,165,250,0.55)",
              background: "linear-gradient(135deg, rgba(96,165,250,0.35), rgba(167,139,250,0.25))",
              color: "#e2e8f0",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
            }}
          >
            ← Home
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        {[
          { label: "Total Vehicles", value: summary.total, hint: "Số xe đang quản lý" },
          { label: "Connected", value: `${summary.connected}/${summary.total}`, hint: "Thiết bị online" },
          { label: "Disconnected", value: summary.lost, hint: "Mất kết nối" },
          { label: "Delivered Orders", value: summary.delivered, hint: "Tổng đơn đã giao" },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))",
              borderRadius: 14,
              padding: 14,
              border: "1px solid rgba(148,163,184,0.14)",
              boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, letterSpacing: 0.4 }}>
              {c.label}
            </div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 950, color: "#67e8f9" }}>
              {c.value}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
              {c.hint}
            </div>
          </div>
        ))}
      </div>

      {/* VEHICLE CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        {vehicles.map((v) => {
          const mqtt = mqttMap[v.id] || "lost";
          const battery = 100; // placeholder theo yêu cầu
          const deliveries = v.deliveries || 0;

          return (
            <div
              key={v.id}
              style={{
                background: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(2,6,23,0.55))",
                borderRadius: 14,
                padding: 14,
                border: "1px solid rgba(148,163,184,0.14)",
                boxShadow: "0 10px 22px rgba(2,6,23,0.35)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 950, fontSize: 16, letterSpacing: 0.4 }}>{v.id}</div>
                <span style={badgeStyle(mqtt)}>{mqtt === "connected" ? "CONNECTED" : "DISCONNECTED"}</span>
              </div>

              <div style={{ height: 12 }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Battery</div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                    <BatteryIcon
                      level={battery}
                      width={120}
                      height={40}
                      title="Click để phóng to"
                      onClick={() =>
                        setBatteryFocus({
                          id: v.id,
                          level: battery,
                          mqtt,
                          deliveries,
                          status: v.status,
                        })
                      }
                    />
                    <div style={{ fontSize: 12, fontWeight: 850, opacity: 0.65 }}>
                      Click to zoom
                    </div>
                  </div>

                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Delivered Orders</div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, color: "#a78bfa" }}>
                    {deliveries}
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, opacity: 0.7 }}>
                    Status
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 900 }}>
                    {v.status === "moving" ? "🚚 Đang chạy" : "🅿️ Idle"}
                  </div>
                </div>
              </div>

              <div style={{ height: 12 }} />
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.14)",
                  background: "rgba(2,6,23,0.35)",
                  fontSize: 12,
                  fontWeight: 800,
                  opacity: 0.8,
                  lineHeight: 1.35,
                }}
              >
                • Start: {v.startPos?.[0]}.{v.startPos?.[1]} <br />
                • Current: {v.pos?.[0]}.{v.pos?.[1]} <br />
                • End: {v.endPos?.[0]}.{v.endPos?.[1]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
