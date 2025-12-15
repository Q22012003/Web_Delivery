// src/components/ClockDisplay.jsx
import { useState, useEffect } from "react";

export default function ClockDisplay() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () =>
    currentTime.toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const formatDate = () =>
    currentTime.toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div style={{ textAlign: "center", marginBottom: 20 }}>
    <div
      style={{
        fontSize: "3.8rem",
        fontWeight: 800,
  
        background:
          "linear-gradient(270deg, #60a5fa, #a78bfa, #34d399, #60a5fa)",
        backgroundSize: "600% 600%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
  
        textShadow: "0 0 30px rgba(96,165,250,0.35)",
        animation: "clockGradient 8s ease infinite",
      }}
    >
      {formatTime()}
    </div>
  
    <div
      style={{
        fontSize: "1.6rem",
        color: "#94a3b8",
        marginTop: 6,
        letterSpacing: "0.5px",
      }}
    >
      {formatDate()} • LINE Logistics System
    </div>
  
    <style>
      {`
        @keyframes clockGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}
    </style>
  </div>
  
  );
}