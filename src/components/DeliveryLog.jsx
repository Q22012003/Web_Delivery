// src/components/DeliveryLog.jsx
import React, { useEffect, useRef } from 'react';

export default function DeliveryLog({ logs, v1Deliveries, v2Deliveries }) {
  const logsEndRef = useRef(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
    <div
      style={{
        background: "#ffffff", 
        padding: "30px",
        borderRadius: "20px",
        width: "420px", 
        boxSizing: "border-box",
        boxShadow: "0 15px 35px -5px rgba(0, 0, 0, 0.15)", 
        display: "flex",       
        flexDirection: "column",
        height: "100%", // Chiếm hết 600px của cha
        overflow: "hidden" 
      }}
    >
      <h2 style={{ color: "#1e293b", marginBottom: 20, fontSize: "1.4rem", fontWeight: "800", textAlign: "center", textTransform: "uppercase", borderBottom: "2px solid #f1f5f9", paddingBottom: "15px", letterSpacing: "1px", marginTop: 0 }}>
        NHẬT KÝ
      </h2>

      {/* Phần LIST LOG: Chỉ phần này mới scroll */}
      <div
        style={{
          background: "#f8fafc", 
          padding: "20px",
          borderRadius: "12px",
          fontFamily: "'Consolas', 'Monaco', monospace",
          
          flex: 1,           // Tự dãn ra lấp đầy khoảng trống
          overflowY: "auto", // <--- Hiện thanh cuộn khi nội dung dài
          minHeight: 0,      // Fix lỗi flexbox để scroll hoạt động
          
          border: "1px solid #e2e8f0", 
          fontSize: "0.9rem",
          color: "#334155"
        }}
      >
        {logs.length === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: 0.4 }}>
             <span style={{ fontSize: "3rem", marginBottom: 20, filter: "grayscale(100%)" }}>📝</span>
             <p style={{ fontStyle: "italic", margin: 0, fontSize: "1.1rem", color: "#64748b" }}>Chưa có dữ liệu...</p>
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px dashed #cbd5e1", lineHeight: "1.6", wordBreak: "break-word" }}>
              {log.includes("]") ? (
                  <>
                    <span style={{ color: "#64748b", fontSize: "0.85rem", display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                        {log.split("]")[0]}]
                    </span>
                    <span style={{ color: "#0369a1", fontWeight: "500" }}>
                        {log.split("]")[1]}
                    </span>
                  </>
              ) : (
                  <span style={{ color: "#334155" }}>{log}</span>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", background: "#f1f5f9", padding: "15px 25px", borderRadius: "12px", fontSize: "1.1rem", fontWeight: "bold", color: "#1e293b", border: "1px solid #e2e8f0" }}>
        <span>V1: <span style={{color: "#2563eb", fontSize: "1.2rem"}}>{v1Deliveries}</span></span>
        <span style={{opacity: 0.2, color: "#94a3b8"}}>|</span>
        <span>V2: <span style={{color: "#0891b2", fontSize: "1.2rem"}}>{v2Deliveries}</span></span>
      </div>
    </div>
  );
}