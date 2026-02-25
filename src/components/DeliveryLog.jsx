// src/components/DeliveryLog.jsx
import React, { useEffect, useRef } from 'react';

export default function DeliveryLog({ logs, v1Deliveries, v2Deliveries }) {
  const logsEndRef = useRef(null);

  // Dark theme (match Home background) — keep layout, only adjust colors
  const theme = {
    cardBg: "linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.62))",
    cardBorder: "1px solid rgba(148,163,184,0.18)",
    text: "#e2e8f0",
    muted: "rgba(226,232,240,0.72)",
    panelBg: "rgba(2,6,23,0.35)",
    panelBorder: "1px solid rgba(148,163,184,0.22)",
    accent: "rgba(103,232,249,0.95)",
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
    <div
      style={{
        background: theme.cardBg,
        padding: "30px",
        borderRadius: "20px",
        width: "420px",
        boxSizing: "border-box",
        boxShadow: "0 15px 35px -5px rgba(2, 6, 23, 0.45)",
        border: theme.cardBorder,
        display: "flex",
        flexDirection: "column",
        height: "100%",          // Cố định theo cha (600px)
        overflow: "hidden",      // Không cho tràn ra ngoài dù có bao nhiêu log
      }}
    >
      <h2
        style={{
          color: theme.text,
          margin: "0 0 20px 0",
          fontSize: "1.4rem",
          fontWeight: "800",
          textAlign: "center",
          textTransform: "uppercase",
          borderBottom: "1px solid rgba(148,163,184,0.18)",
          paddingBottom: "15px",
          letterSpacing: "1px",
        }}
      >
        NHẬT KÝ
      </h2>

      {/* Phần log - chiếm hết không gian, scroll độc lập */}
      <div
        style={{
          flex: "1 1 auto",        // Chiếm hết chỗ trống
          minHeight: 0,            // Quan trọng để scroll hoạt động trong flex
          overflowY: "auto",
          background: theme.panelBg,
          padding: "20px",
          borderRadius: "12px",
          border: theme.panelBorder,
          fontFamily: "'Consolas', 'Monaco', monospace",
          fontSize: "0.92rem",
          color: theme.text,
        }}
      >
        {logs.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              opacity: 0.4,
            }}
          >
            <span style={{ fontSize: "3rem", marginBottom: 20, filter: "grayscale(100%)" }}>📝</span>
            <p style={{ fontStyle: "italic", margin: 0, fontSize: "1.1rem", color: theme.muted }}>
              Chưa có dữ liệu...
            </p>
          </div>
        ) : (
          <>
            // trong logs.map
{logs.map((log, i) => {
  const text =
    typeof log === "string"
      ? log
      : `[${log.time || ""}] ${log.vehicleId || ""}: ${log.ok ? "✅" : "❌"} cargo=${log.cargo ?? ""}`;

  return (
    <div key={i} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: "1px dashed rgba(148,163,184,0.35)", lineHeight: "1.6", wordBreak: "break-word" }}>
      {text.includes("]") ? (
        <>
          <span style={{ color: theme.muted, fontSize: "0.85rem", display: "block", marginBottom: "4px", fontWeight: "bold" }}>
            {text.split("]")[0]}]
          </span>
          <span style={{ color: theme.accent, fontWeight: "500" }}>
            {text.split("]")[1]}
          </span>
        </>
      ) : (
        <span style={{ color: theme.text }}>{text}</span>
      )}
    </div>
  );
})}
            <div ref={logsEndRef} />
          </>
        )}
      </div>

      {/* Footer thống kê - luôn cố định ở dưới cùng */}
      <div
        style={{
          marginTop: 20,
          flexShrink: 0,   // Không bao giờ bị co lại
          display: "flex",
          justifyContent: "space-between",
          background: "rgba(2,6,23,0.35)",
          padding: "15px 25px",
          borderRadius: "12px",
          fontSize: "1.1rem",
          fontWeight: "bold",
          color: theme.text,
          border: theme.panelBorder,
        }}
      >
        <span>
          V1: <span style={{ color: "rgba(96,165,250,0.95)", fontSize: "1.2rem" }}>{v1Deliveries}</span>
        </span>
        <span style={{ opacity: 0.35, color: "#94a3b8" }}>|</span>
        <span>
          V2: <span style={{ color: "rgba(103,232,249,0.95)", fontSize: "1.2rem" }}>{v2Deliveries}</span>
        </span>
      </div>
    </div>
  );
}