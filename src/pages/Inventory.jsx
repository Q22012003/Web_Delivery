// src/pages/Inventory.jsx
import { useState, useEffect } from "react";

// Cấu hình 5 loại hàng tương ứng 5 vị trí
const WAREHOUSE_CONFIG = [
  { id: "5,1", name: "Điện tử", color: "#3b82f6" },       // Blue
  { id: "5,2", name: "Thực phẩm lạnh", color: "#ef4444" }, // Red
  { id: "5,3", name: "Gia dụng", color: "#f59e0b" },      // Amber
  { id: "5,4", name: "Nông sản", color: "#10b981" },      // Emerald
  { id: "5,5", name: "Thủy hải sản", color: "#06b6d4" },   // Cyan
];

export default function Inventory() {
  const [targets, setTargets] = useState({});     // Lưu tổng số lượng cần giao (Target)
  const [currentStock, setCurrentStock] = useState({}); // Lưu số lượng ĐÃ GIAO (Actual)
  const [isEditing, setIsEditing] = useState(false);    // Chế độ nhập liệu

  useEffect(() => {
    loadData();
    // Cứ 1 giây kiểm tra localStorage xem Home có cập nhật hàng mới không
    const interval = setInterval(() => {
      const savedStock = JSON.parse(localStorage.getItem("warehouse_stock") || "{}");
      setCurrentStock(savedStock);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    const savedTargets = JSON.parse(localStorage.getItem("warehouse_targets") || "{}");
    const savedStock = JSON.parse(localStorage.getItem("warehouse_stock") || "{}");
    
    // Nếu chưa có target, tạo object rỗng
    if (Object.keys(savedTargets).length === 0) {
      const defaultTargets = {};
      WAREHOUSE_CONFIG.forEach(w => defaultTargets[w.id] = 0);
      setTargets(defaultTargets);
    } else {
      setTargets(savedTargets);
    }
    setCurrentStock(savedStock);
  };

  const handleSaveTargets = () => {
    localStorage.setItem("warehouse_targets", JSON.stringify(targets));
    setIsEditing(false);
  };

  const handleChangeInput = (id, value) => {
    setTargets(prev => ({ ...prev, [id]: parseInt(value) || 0 }));
  };

  const handleResetStock = () => {
    if(window.confirm("Bạn muốn xóa hết lịch sử đã giao về 0?")) {
      localStorage.setItem("warehouse_stock", JSON.stringify({}));
      setCurrentStock({});
    }
  }

  return (
    <div style={{ marginLeft: 280, padding: 40, minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "Segoe UI, sans-serif" }}>
      
      {/* Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
        <div>
          <h2 style={{ fontSize: "2.5rem", margin: 0, background: "linear-gradient(45deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 800 }}>
            QUẢN LÝ KHO HÀNG
          </h2>
          <p style={{ color: "#94a3b8", marginTop: 8, fontSize: "1.1rem" }}>Theo dõi tiến độ nhập hàng tại 5 điểm tập kết</p>
        </div>
        
        <div style={{display:'flex', gap: 15}}>
          <button 
            onClick={handleResetStock}
            style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontWeight: "bold", transition: "all 0.2s" }}
          >
            Reset Đã Giao
          </button>
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#3b82f6", color: "white", cursor: "pointer", fontWeight: "bold", boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)" }}
            >
              Cài đặt chỉ tiêu
            </button>
          ) : (
            <button 
              onClick={handleSaveTargets}
              style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#10b981", color: "white", cursor: "pointer", fontWeight: "bold", boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)" }}
            >
              Lưu thay đổi
            </button>
          )}
        </div>
      </div>

      {/* Grid Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 30 }}>
        {WAREHOUSE_CONFIG.map((wh) => {
          const target = targets[wh.id] || 0;
          const current = currentStock[wh.id] || 0;
          // Tính phần trăm, tối đa 100%
          const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
          
          return (
            <div key={wh.id} style={{ 
              background: "#1e293b", 
              padding: 30, 
              borderRadius: 20, 
              border: "1px solid #334155", 
              position: 'relative', 
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)" 
            }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{display:'flex', alignItems:'center', gap: 15}}>
                  <div style={{ 
                    width: 50, height: 50, borderRadius: 14, 
                    background: `${wh.color}20`, color: wh.color, 
                    display: "flex", alignItems: "center", justifyContent: "center", 
                    fontWeight: "bold", fontSize: "1.1rem", border: `1px solid ${wh.color}40` 
                  }}>
                    {wh.id.replace("5,", "")}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#f1f5f9" }}>{wh.name}</h3>
                    <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Vị trí: {wh.id}</span>
                  </div>
                </div>
                
                {/* Status Badge */}
                <span style={{ 
                  fontSize: "0.75rem", padding: "6px 12px", borderRadius: 30, 
                  background: percent >= 100 ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                  color: percent >= 100 ? "#34d399" : "#60a5fa",
                  fontWeight: 'bold', border: `1px solid ${percent >= 100 ? "rgba(16, 185, 129, 0.2)" : "rgba(59, 130, 246, 0.2)"}`
                }}>
                  {percent >= 100 ? "Hoàn thành" : "Đang giao"}
                </span>
              </div>

              {/* Editing Mode */}
              {isEditing ? (
                <div style={{ background: '#0f172a', padding: 15, borderRadius: 12, border: "1px dashed #475569" }}>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", display: 'block', marginBottom: 8 }}>Nhập tổng số lượng cần giao:</label>
                  <input 
                    type="number" 
                    value={targets[wh.id] || ""} 
                    onChange={(e) => handleChangeInput(wh.id, e.target.value)}
                    placeholder="VD: 500"
                    style={{ 
                      width: "100%", padding: "10px", borderRadius: 8, 
                      border: "1px solid #334155", background: "#1e293b", 
                      color: "white", outline: "none", fontSize: "1rem", boxSizing: "border-box" 
                    }}
                  />
                </div>
              ) : (
                /* Display Mode */
                <div style={{ marginTop: 25 }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
                    <div>
                      <span style={{color: '#94a3b8', fontSize: '0.9rem'}}>Đã giao</span>
                      <div style={{fontSize: '1.8rem', fontWeight: 'bold', color: 'white', lineHeight: 1}}>
                        {current}
                      </div>
                    </div>
                    <div style={{textAlign: 'right'}}>
                      <span style={{color: '#64748b', fontSize: '0.9rem'}}>Mục tiêu</span>
                      <div style={{fontSize: '1.1rem', fontWeight: 600, color: '#94a3b8'}}>
                         / {target}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar Container */}
                  <div style={{ width: "100%", height: 10, background: "#334155", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ 
                      width: `${percent}%`, 
                      height: "100%", 
                      background: wh.color, 
                      transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                      borderRadius: 5,
                      boxShadow: `0 0 10px ${wh.color}`
                    }}></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}