// src/components/Sidebar.jsx
import { useNavigate, useLocation } from "react-router-dom";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: "/", label: "Trang chủ" },
    { path: "/statistics", label: "Lịch sử giao hàng" },
    { path: "/real-time", label: "Thời gian thực" },
    { path: "/alert", label: "Cảnh báo" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div
      style={{
        width: 280,
        background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
        padding: "30px 20px",
        borderRight: "1px solid #334155",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 900,
        boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
      }}
    >
      <nav>
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              width: "100%",
              padding: "16px 20px",
              marginBottom: 10,

              // ⭐ nền mặc định + active
              background: isActive(item.path)
                ? "rgba(96, 165, 250, 0.25)"
                : "rgba(96, 165, 250, 0.08)",

              // ⭐ viền mặc định + active
              border: isActive(item.path)
                ? "1px solid #60a5fa"
                : "1px solid rgba(96,165,250,0.3)",

              borderRadius: 12,
              color: "#e2e8f0",
              fontSize: "1.1rem",
              fontWeight: isActive(item.path) ? "bold" : "500",
              display: "flex",
              alignItems: "center",
              gap: 14,
              transition: "all 0.3s",
              cursor: "pointer",
            }}

            // ⭐ hover hiệu ứng
            onMouseOver={(e) =>
              (e.target.style.background = isActive(item.path)
                ? "rgba(96,165,250,0.3)"
                : "rgba(96,165,250,0.15)")
            }
            onMouseOut={(e) =>
              (e.target.style.background = isActive(item.path)
                ? "rgba(96,165,250,0.25)"
                : "rgba(96,165,250,0.08)")
            }
          >
            <span style={{ fontSize: "1.4rem" }}></span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
