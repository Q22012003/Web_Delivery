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
      <h2
        style={{
          color: "#60a5fa",        // 🔵 Màu đồng bộ với header chính
          marginBottom: 15,
          fontSize: "1.8rem",
          fontWeight: "bold",
          textShadow: "0 0 10px rgba(96,165,250,0.5)",
        }}
      >
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
          <p style={{ color: "#60a5fa", fontStyle: "italic", opacity: 0.7 }}>
            Chưa có chuyến giao hàng nào...
          </p>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                color: "#93c5fd", // 🔹 xanh nhạt cho log
              }}
            >
              {log}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          marginTop: 15,
          color: "#60a5fa",   // 🔵 Màu thống nhất
          fontSize: "1.1rem",
          textAlign: "center",
          fontWeight: "bold",
        }}
      >
        V1: <strong style={{ color: "#60a5fa" }}>{v1Deliveries}</strong> lần giao  |  
        V2: <strong style={{ color: "#60a5fa" }}>{v2Deliveries}</strong> lần giao
      </div>
    </div>
  );
}
