// src/pages/RealTime.jsx
import ClockDisplay from "../components/ClockDisplay";
import PageSwitchButtons from "../components/PageSwitchButtons";

export default function RealTime() {
  return (
    <div
      style={{
        padding: 30,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Đồng hồ thời gian thực */}
      <ClockDisplay />

      {/* Tiêu đề */}
      <h1
        style={{
          fontSize: "3.8rem",
          fontWeight: "bold",
          color: "#34d399",
          margin: "60px 0 20px",
          textShadow: "0 0 40px rgba(52,211,153,0.5)",
          letterSpacing: "2px",
        }}
      >
        CHẾ ĐỘ THỜI GIAN THỰC
      </h1>

      <p
        style={{
          fontSize: "1.8rem",
          color: "#94a3b8",
          marginBottom: 80,
          fontStyle: "italic",
        }}
      >
        Đang phát triển... Sắp ra mắt cực chất!
      </p>

      {/* Icon hoặc hiệu ứng chờ (tùy chọn thêm sau) */}
      <div
        style={{
          width: 120,
          height: 120,
          border: "8px solid #1e293b",
          borderTop: "8px solid #34d399",
          borderRadius: "50%",
          animation: "spin 2s linear infinite",
          marginBottom: 80,
        }}
      />

      {/* 2 nút chuyển trang */}
      <PageSwitchButtons />

      {/* CSS animation cho vòng tròn loading */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}