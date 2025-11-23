// src/components/DeliveryLog.jsx
export default function DeliveryLog({ logs, v1Deliveries, v2Deliveries }) {
    return (
      <div
        style={{
          marginTop: 50,
          background: "#1e293b",
          padding: 25,
          borderRadius: 16,
          maxWidth: 1100,
          margin: "50px auto",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <h2 style={{ color: "#34d399", marginBottom: 15, fontSize: "1.8rem" }}>
          NHẬT KÝ GIAO HÀNG
        </h2>
        <div
          style={{
            background: "#0f172a",
            padding: 20,
            borderRadius: 12,
            fontFamily: "Consolas, monospace",
            height: 260,
            overflowY: "auto",
            border: "1px solid #334155",
          }}
        >
          {logs.length === 0 ? (
            <p style={{ color: "#94a3b8", fontStyle: "italic" }}>
              Chưa có chuyến giao hàng nào...
            </p>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ marginBottom: 8, color: "#a5f3fc" }}>
                {log}
              </div>
            ))
          )}
        </div>
        <div
          style={{
            marginTop: 15,
            color: "#94a3b8",
            fontSize: "1.1rem",
            textAlign: "center",
          }}
        >
          V1: <strong style={{ color: "#ff6b6b" }}>{v1Deliveries}</strong> lần giao  |   V2:{" "}
          <strong style={{ color: "#51cf66" }}>{v2Deliveries}</strong> lần giao
        </div>
      </div>
    );
  }