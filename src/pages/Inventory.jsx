// src/pages/Inventory.jsx
import { useState } from "react";

// Icon minh họa
const BoxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
);

const LocationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
);

export default function Inventory() {
  // Giả lập dữ liệu: 5 kho tương ứng 5 loại hàng
  const [inventoryData] = useState([
    { id: "KHO-01", name: "Kho Miền Bắc", type: "Điện tử", stock: 120, capacity: 500, status: "Normal" },
    { id: "KHO-02", name: "Kho Miền Trung", type: "Thực phẩm lạnh", stock: 450, capacity: 500, status: "Full" }, // Sắp đầy
    { id: "KHO-03", name: "Kho Miền Nam", type: "Gia dụng", stock: 34, capacity: 500, status: "Low" }, // Sắp hết
    { id: "KHO-04", name: "Kho Tây Nguyên", type: "Nông sản", stock: 300, capacity: 500, status: "Normal" },
    { id: "KHO-05", name: "Kho Ven Biển", type: "Thủy hải sản", stock: 210, capacity: 500, status: "Normal" },
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Full": return "#ef4444"; // Đỏ - Cảnh báo đầy
      case "Low": return "#f59e0b";  // Vàng - Cảnh báo hết
      default: return "#10b981";     // Xanh - Bình thường
    }
  };

  return (
    <div className="inventory-container">
      <style>{`
        .inventory-container {
          margin-left: 280px; /* Tránh Sidebar */
          padding: 40px;
          min-height: 100vh;
          background-color: #0f172a;
          font-family: 'Segoe UI', sans-serif;
          color: #e2e8f0;
        }

        .grid-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
        }

        .card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 16px;
          padding: 24px;
          transition: transform 0.2s;
        }
        .card:hover {
          transform: translateY(-5px);
          border-color: #60a5fa;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .icon-box {
          width: 40px; 
          height: 40px; 
          border-radius: 10px;
          background: rgba(96, 165, 250, 0.1);
          color: #60a5fa;
          display: flex; 
          align-items: center; 
          justify-content: center;
        }

        .stock-bar-bg {
          width: 100%;
          height: 6px;
          background: #334155;
          border-radius: 3px;
          margin-top: 12px;
          overflow: hidden;
        }

        .glass-table {
          background: #1e293b;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid #334155;
        }

        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 16px; color: #94a3b8; border-bottom: 1px solid #334155; }
        td { padding: 16px; border-bottom: 1px solid #334155; }
        tr:last-child td { border-bottom: none; }
      `}</style>

      {/* Header */}
      <h2 style={{ fontSize: "2rem", fontWeight: "800", marginBottom: 10, background: "linear-gradient(45deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        QUẢN LÝ KHO HÀNG
      </h2>
      <p style={{ color: "#94a3b8", marginBottom: 40 }}>Theo dõi trạng thái hàng hóa tại 5 điểm tập kết</p>

      {/* Phần 1: Cards Tổng quan (Visual 5 loại hàng) */}
      <div className="grid-cards">
        {inventoryData.map((item) => {
          const percent = (item.stock / item.capacity) * 100;
          return (
            <div key={item.id} className="card">
              <div className="card-header">
                <div className="icon-box"><BoxIcon /></div>
                <span style={{ 
                  fontSize: '0.75rem', 
                  padding: '4px 8px', 
                  borderRadius: 20, 
                  background: item.status === 'Normal' ? 'rgba(16, 185, 129, 0.1)' : getStatusColor(item.status) + '22',
                  color: getStatusColor(item.status),
                  fontWeight: 'bold'
                }}>
                  {item.status === 'Full' ? 'Sắp đầy' : item.status === 'Low' ? 'Sắp hết' : 'Ổn định'}
                </span>
              </div>
              
              <h3 style={{ margin: "0 0 5px 0", fontSize: "1.1rem" }}>{item.type}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: '0.9rem' }}>
                <LocationIcon /> {item.name}
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span>Tồn kho: <b>{item.stock}</b></span>
                  <span style={{ color: '#64748b' }}>Sức chứa: {item.capacity}</span>
                </div>
                {/* Thanh tiến trình mô phỏng lượng hàng */}
                <div className="stock-bar-bg">
                  <div style={{ 
                    width: `${percent}%`, 
                    height: '100%', 
                    background: getStatusColor(item.status),
                    borderRadius: 3
                  }}></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Phần 2: Bảng chi tiết (Nếu cần xem dạng list) */}
      <div className="glass-table">
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Chi tiết tồn kho</h3>
        <table>
          <thead>
            <tr>
              <th>Mã Kho</th>
              <th>Tên Kho</th>
              <th>Loại Hàng Chủ Lực</th>
              <th>Số lượng tồn</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {inventoryData.map((item, index) => (
              <tr key={index}>
                <td style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{item.id}</td>
                <td style={{ fontWeight: 500 }}>{item.name}</td>
                <td>{item.type}</td>
                <td>{item.stock} / {item.capacity}</td>
                <td>
                  <span style={{ color: getStatusColor(item.status) }}>
                     ● {item.status === 'Normal' ? 'Hoạt động tốt' : item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}