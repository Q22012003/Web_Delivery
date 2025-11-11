// App.jsx
import React, { useState, useEffect } from 'react';
import { aStarSearch } from './aStar';

//=====================================================
// XE DÒ LINE – ICON
//=====================================================
function CarIcon({ color = '#FFC107', direction = 'down' }) {
  const rotate = direction === 'up' ? 180 : direction === 'left' ? 270 : direction === 'right' ? 90 : 0;
  return (
    <div style={{ transform: `rotate(${rotate}deg)` }}>
      <svg width="80" height="110" viewBox="0 0 80 110" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="25" width="60" height="50" rx="8" fill={color} stroke="#000" strokeWidth="2"/>
        <rect x="15" y="30" width="50" height="40" rx="5" fill="#fff"/>
        <rect x="55" y="30" width="15" height="35" rx="3" fill={color}/>
        <rect x="8" y="20" width="45" height="12" rx="3" fill="#81C784"/>
        <circle cx="22" cy="70" r="11" fill="#222"/>
        <circle cx="58" cy="70" r="11" fill="#222"/>
        <circle cx="22" cy="70" r="6" fill="#444"/>
        <circle cx="58" cy="70" r="6" fill="#444"/>
        <text x="40" y="50" fontSize="9" fill="#000" fontWeight="bold" textAnchor="middle">LINE</text>
      </svg>
    </div>
  );
}

//=====================================================
// XE – DI CHUYỂN
//=====================================================
function Vehicle({ id, pos, status, nextPos, zIndex = 100 }) {
  const cellSize = 200;
  const x = pos[1] * cellSize;
  const y = (4 - pos[0]) * cellSize;

  // Fix: Xe ở hàng 0 (dưới cùng) bị che → đẩy lên trên
 // const topOffset = pos[0] === 0 ? 600 : -55;

  let direction = 'down';
  if (nextPos) {
    const dx = nextPos[1] - pos[1];
    const dy = nextPos[0] - pos[0];
    if (dx === 1) direction = 'right';
    else if (dx === -1) direction = 'left';
    else if (dy === 1) direction = 'down';
    else if (dy === -1) direction = 'up';
  }

  const color = id === 'V1' ? '#FF5722' : '#4CAF50';
  const idleColor = '#999';

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 40,
        top: y - 55,
        width: 80,
        height: 110,
        transition: 'all 0.8s ease-in-out',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <CarIcon color={status === 'idle' ? idleColor : color} direction={direction} />
      <div style={{
        textAlign: 'center',
        marginTop: 4,
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        textShadow: '0 0 8px rgba(0,0,0,0.8)',
      }}>
        {id}
      </div>
    </div>
  );
}

//=====================================================
// BẢNG ĐIỀU KHIỂN
//=====================================================
function ControlPanel({ vehicle, onChange, onStart }) {
  const { id, startPos, endPos, status } = vehicle;

  const startPoints = Array.from({ length: 4 }, (_, c) => [0, c]); // hàng 0
  const endPoints = Array.from({ length: 5 }, (_, r) => [r, 2]);   // cột 2

  return (
    <div style={{
      border: '2px solid #000',
      padding: 16,
      borderRadius: 10,
      background: '#fff',
      width: 300,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <h3 style={{ margin: '0 0 12px', color: '#1976d2' }}>XE {id} – DÒ LINE</h3>

      <div style={{ marginBottom: 12 }}>
        <label><strong>Xuất phát (hàng 0):</strong></label>
        <select
          value={startPos.join(',')}
          onChange={e => onChange('startPos', e.target.value.split(',').map(Number))}
          disabled={status === 'moving'}
          style={{ width: '100%', padding: 8, marginTop: 4 }}
        >
          {startPoints.map(p => (
            <option key={p.join(',')} value={p.join(',')}>[{p.join(', ')}]</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label><strong>Kết thúc (cột 2):</strong></label>
        <select
          value={endPos.join(',')}
          onChange={e => onChange('endPos', e.target.value.split(',').map(Number))}
          disabled={status === 'moving'}
          style={{ width: '100%', padding: 8, marginTop: 4 }}
        >
          {endPoints.map(p => (
            <option key={p.join(',')} value={p.join(',')}>[{p.join(', ')}]</option>
          ))}
        </select>
      </div>

      <button
        onClick={onStart}
        disabled={status === 'moving'}
        style={{
          width: '100%',
          padding: 12,
          fontSize: 16,
          background: status === 'moving' ? '#999' : '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontWeight: 'bold',
          cursor: status === 'moving' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'moving' ? 'Đang dò line...' : `Bắt đầu ${id}`}
      </button>
    </div>
  );
}

//=====================================================
// APP CHÍNH – DÙNG HÌNH ẢNH VẠCH
//=====================================================
export default function App() {
  const [v1, setV1] = useState({
    id: 'V1',
    startPos: [0, 0],
    endPos: [4, 2],
    pos: [0, 0],
    path: [],
    status: 'idle',
  });
  const [v2, setV2] = useState({
    id: 'V2',
    startPos: [0, 3],
    endPos: [2, 2],
    pos: [0, 3],
    path: [],
    status: 'idle',
  });

  const handleStart = (id) => {
    const setV = id === 'V1' ? setV1 : setV2;
    const v = id === 'V1' ? v1 : v2;

    const path = aStarSearch(v.startPos, v.endPos);
    if (path.length === 0) {
      alert(`Xe ${id}: Không có đường đi hợp lệ!`);
      return;
    }

    setV({
      ...v,
      path: path.slice(1),
      pos: v.startPos,
      status: 'moving',
    });
  };

  const update = (id, field, val) => {
    const setV = id === 'V1' ? setV1 : setV2;
    setV(p => ({ ...p, [field]: val }));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      [setV1, setV2].forEach((setV, i) => {
        const v = i === 0 ? v1 : v2;
        setV(p => {
          if (p.status !== 'moving' || p.path.length === 0) {
            return { ...p, status: 'idle' };
          }
          const next = p.path[0];
          const rest = p.path.slice(1);
          return { ...p, pos: next, path: rest, status: rest.length ? 'moving' : 'idle' };
        });
      });
    }, 800);
    return () => clearInterval(timer);
  }, []);

  // Tọa độ Y của 3 hàng ngang (hàng 0, 1, 2)
  const rowY = [100, 300, 500]; // giữa ô

  return (
    <div style={{
      padding: 30,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
      color: '#e2e8f0',
    }}>
     <h1 style={{
      textAlign: 'center',
      marginBottom: 20,
      color: '#60a5fa',
      fontWeight: 'bold',
      textShadow: '0 0 20px rgba(96, 165, 250, 0.5)',
      letterSpacing: '1px',
    }}>
  ĐỒ ÁN: XE DÒ LINE – VẠCH HÌNH ẢNH
</h1>

      <div style={{ display: 'flex', gap: 50, justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* MAP */}
        <div className="map-container">
          {/* Ô lưới */}
          {Array.from({ length: 4 }, (_, rIdx) => {
            const r = 3 - rIdx;
            return Array.from({ length: 4 }, (_, c) => (
              <div key={`${r}-${c}`} className="map-cell">
                {r},{c}
              </div>
            ));
          })}

          {/* ĐƯỜNG DỌC CỘT 2 – VẪN DÙNG SVG */}
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          <rect x="385" y="0" width="30" height="800" fill="#34495e" rx="15" opacity="0.9" />
         <line x1="400" y1="0" x2="400" y2="800" stroke="#1abc9c" strokeWidth="6" strokeDasharray="40,25" strokeLinecap="round" />
         </svg>

          {/* Xe */}
          <Vehicle id={v1.id} pos={v1.pos} status={v1.status} nextPos={v1.path[0]} zIndex={100} />
          <Vehicle id={v2.id} pos={v2.pos} status={v2.status} nextPos={v2.path[0]} zIndex={100} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
          <ControlPanel vehicle={v1} onChange={(f, v) => update('V1', f, v)} onStart={() => handleStart('V1')} />
          <ControlPanel vehicle={v2} onChange={(f, v) => update('V2', f, v)} onStart={() => handleStart('V2')} />
        </div>
      </div>
    </div>
  );
}