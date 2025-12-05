// src/components/CollisionAlert.jsx
import { useState, useEffect } from 'react';

export default function CollisionAlert({ message }) {
  const [visible, setVisible] = useState(!!message);

  useEffect(() => {
    setVisible(!!message);
  }, [message]);

  useEffect(() => {
    if (visible && message) {
      const timer = setTimeout(() => setVisible(false), 5000); // Tăng thời gian hiển thị lên 5s cho rõ ràng
      return () => clearTimeout(timer);
    }
  }, [visible, message]);

  if (!visible || !message) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 20, 
      right: 20, 
      background: '#ff6b6b', 
      padding: 20, 
      borderRadius: 12, 
      color: 'white',
      fontWeight: 'bold',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: 1000,
      minWidth: '200px',
      textAlign: 'center'
    }}>
      CẢNH BÁO VA CHẠM: {message}
    </div>
  );
}