// src/components/Sidebar.jsx
import { useNavigate, useLocation } from "react-router-dom";

// Icon SVG (giữ nguyên như bạn)
const Icons = {
  Home: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  ),
  History: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
  RealTime: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  Alert: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  ),
  Logo: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#60a5fa" }}>
      <rect x="1" y="3" width="15" height="13"></rect>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
      <circle cx="5.5" cy="18.5" r="2.5"></circle>
      <circle cx="18.5" cy="18.5" r="2.5"></circle>
    </svg>
  ),
  Inventory: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  ),
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: "/", label: "Trang chủ", icon: <Icons.Home /> },
    { path: "/inventory", label: "Quản lý kho", icon: <Icons.Inventory /> },
    { path: "/statistics", label: "Lịch sử giao hàng", icon: <Icons.History /> },
    { path: "/real-time", label: "Thời gian thực", icon: <Icons.RealTime /> },
    { path: "/alert", label: "Cảnh báo", icon: <Icons.Alert /> },
  ];

  return (
    <aside className="sidebar">
      <style>{`
        .sidebar{
          width: 250px;
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          background: #0b1220;
          border-right: 1px solid rgba(148,163,184,0.15);
          padding: 18px 14px;
          display: flex;
          flex-direction: column;
          font-family: Segoe UI, system-ui, -apple-system, sans-serif;
        }

        .brand{
          display:flex;
          align-items:center;
          gap:10px;
          padding: 6px 8px 14px 8px;
          margin-bottom: 10px;
          border-bottom: 1px solid rgba(148,163,184,0.12);
        }
        .brand h1{
          margin:0;
          font-size: 1rem;
          color:#e2e8f0;
          letter-spacing: .4px;
          font-weight: 800;
        }
        .brand span{
          display:block;
          margin-top: 2px;
          font-size: .72rem;
          color:#94a3b8;
          letter-spacing: .9px;
          text-transform: uppercase;
        }

        .section-title{
          font-size: .72rem;
          color: rgba(148,163,184,0.85);
          letter-spacing: 1px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 10px 10px 6px 10px;
        }

        .nav-btn{
          width:100%;
          display:flex;
          align-items:center;
          gap:10px;
          padding: 12px 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: #cbd5e1;
          cursor:pointer;
          font-size: .95rem;
          font-weight: 600;
          transition: background .15s ease, border-color .15s ease;
        }
        .nav-btn:hover{
          background: rgba(148,163,184,0.08);
          border-color: rgba(148,163,184,0.10);
        }
        .nav-btn.active{
          background: rgba(96,165,250,0.15);
          border-color: rgba(96,165,250,0.25);
          color: #93c5fd;
        }

        .footer{
          margin-top:auto;
          padding: 10px 10px;
          border-top: 1px solid rgba(148,163,184,0.12);
          color: rgba(148,163,184,0.8);
          font-size: .78rem;
        }
      `}</style>

      <div className="brand">
        <Icons.Logo />
        <div>
          <h1>LOGISTICS</h1>
          <span>Management</span>
        </div>
      </div>

      <div className="section-title">Menu chính</div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-btn ${active ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="footer">v1.0</div>
    </aside>
  );
}
