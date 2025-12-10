// src/components/Sidebar.jsx
import { useNavigate, useLocation } from "react-router-dom";

// Bộ Icon SVG (Nhúng trực tiếp để không cần cài thư viện)
const Icons = {
  Home: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
  ),
  History: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
  ),
  RealTime: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
  ),
  Alert: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
  ),
  Logo: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#60a5fa'}}><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
  ),
  Inventory: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
  ),
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: "/", label: "Trang chủ", icon: <Icons.Home /> },
    { path: "/inventory", label: "Quản lý kho", icon: <Icons.Inventory /> }, // <-- Thêm dòng này
    { path: "/statistics", label: "Lịch sử giao hàng", icon: <Icons.History /> },
    { path: "/real-time", label: "Thời gian thực", icon: <Icons.RealTime /> },
    { path: "/alert", label: "Cảnh báo", icon: <Icons.Alert /> },
  ];

  return (
    <div className="sidebar-container">
      {/* CSS Styles nội bộ */}
      <style>{`
        .sidebar-container {
          width: 280px;
          background: #0f172a; /* Slate 900 */
          border-right: 1px solid #1e293b;
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          z-index: 900;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          font-family: 'Segoe UI', sans-serif;
          box-shadow: 4px 0 24px rgba(0,0,0,0.2);
        }

        .brand-area {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px 30px 12px;
          margin-bottom: 10px;
          border-bottom: 1px solid #1e293b;
        }

        .brand-text h1 {
          font-size: 1.2rem;
          color: #f8fafc;
          margin: 0;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        
        .brand-text span {
          font-size: 0.75rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .nav-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          margin-bottom: 8px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: #94a3b8; /* Slate 400 */
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #e2e8f0;
          transform: translateX(4px);
        }

        .nav-btn.active {
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);
          color: #60a5fa; /* Blue 400 */
          font-weight: 700;
          border: 1px solid rgba(59, 130, 246, 0.2);
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);
        }
        
        /* Một dải màu nhỏ bên trái để đánh dấu active */
        .nav-btn.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          height: 20px;
          width: 4px;
          background: #60a5fa;
          border-radius: 0 4px 4px 0;
        }

      `}</style>

      {/* 1. Phần Logo / Tên Ứng Dụng */}
      <div className="brand-area">
        <Icons.Logo />
        <div className="brand-text">
          <h1>LOGISTICS</h1>
          <span>Management</span>
        </div>
      </div>

      {/* 2. Menu Navigation */}
      <nav style={{ flex: 1 }}>
        <span style={{ 
          fontSize: '0.75rem', 
          textTransform: 'uppercase', 
          color: '#475569', 
          fontWeight: 'bold', 
          paddingLeft: 12, 
          marginBottom: 10, 
          display: 'block' 
        }}>
          Menu chính
        </span>

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

      {/* 3. Phần Footer nhỏ (Optional) */}
      <div style={{ 
        padding: '16px', 
        background: '#1e293b', 
        borderRadius: 12, 
        marginTop: 'auto' 
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#475569' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', color: 'white', fontWeight: 'bold' }}>Admin User</span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}