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
          fontWeight: "bold",
          color: "#60a5fa",
          textShadow: "0 0 30px rgba(96,165,250,0.6)",
        }}
      >
        {formatTime()}
      </div>
      <div style={{ fontSize: "1.6rem", color: "#94a3b8" }}>
        {formatDate()} • LINE Logistics System
      </div>
    </div>
  );
}