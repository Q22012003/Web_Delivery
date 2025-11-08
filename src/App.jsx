import React, { useState, useEffect } from 'react';
import { aStarSearch } from './aStar'; // Import bộ não A*

//=====================================================
// MỚI: Component Icon Xe (inline SVG)
//=====================================================
function CarIcon({ color = '#2196F3' }) {
  // Đây là một hình SVG đơn giản biểu thị 1 chiếc xe nhìn từ trên xuống
  return (
    <svg width="40" height="60" viewBox="0 0 50 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M45 60 C45 70, 35 70, 35 60 L35 40 L15 40 L15 60 C15 70, 5 70, 5 60 C5 50, 15 50, 15 60 L15 25 C15 10, 20 0, 25 0 C30 0, 35 10, 35 25 L35 60 C35 50, 45 50, 45 60 Z" fill={color} />
      <rect x="10" y="10" width="30" height="30" rx="5" fill="#aadaff" /> 
      <rect x="7" y="65" width="10" height="15" rx="3" fill="#222" /> 
      <rect x="33" y="65" width="10" height="15" rx="3" fill="#222" /> 
    </svg>
  );
}

//=====================================================
// CẬP NHẬT: Component Xe
//=====================================================
function Vehicle({ id, pos, status }) {
  // Logic tọa độ này ĐÃ ĐÚNG (hàng 0 ở dưới cùng)
  const top = (4 - pos[0]) * 100; // 100px mỗi ô
  const left = pos[1] * 100;
  
  // V1 màu đỏ, V2 màu xanh
  let color = id === 'V1' ? '#f44336' : '#2196F3'; 
  if (status === 'idle') color = '#9E9E9E'; // Màu xám khi idle
  
  return (
    <div
      style={{
        // Dùng kích thước ô (100x100) để căn giữa icon xe
        width: 100, 
        height: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: top,
        left: left,
        transition: 'top 0.4s linear, left 0.4s linear', // Hiệu ứng di chuyển
        zIndex: 10
      }}>
      <CarIcon color={color} />
      <div style={{ 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 14, 
        marginTop: 4, 
        textShadow: '0 0 3px black' // Đổ bóng cho text
      }}>
        {id}
      </div>
    </div>
  );
}

// Bảng điều khiển (Không thay đổi)
function ControlPanel({ vehicle, onChange, onStart }) {
  const { id, startPos, endPos, status } = vehicle;
  const startOptions = Array.from({ length: 5 }, (_, i) => [0, i]); // [0,0] -> [0,4]
  const endOptions = Array.from({ length: 5 }, (_, i) => [4, i]);   // [4,0] -> [4,4]

  return (
    <div style={{ border: '1px solid #ddd', padding: 15, borderRadius: 8, background: '#fff', width: 250 }}>
      <h3>Xe {id}</h3>
      <div style={{ marginBottom: 10 }}>
        <label>Điểm bắt đầu: </label>
        <select
          value={startPos.join(',')}
          onChange={e => onChange('startPos', e.target.value.split(',').map(Number))}
          disabled={status === 'moving'}>
          {startOptions.map(pos => (
            <option key={pos.join(',')} value={pos.join(',')}>
              {pos.join(',')}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 15 }}>
        <label>Điểm kết thúc: </label>
        <select
          value={endPos.join(',')}
          onChange={e => onChange('endPos', e.target.value.split(',').map(Number))}
          disabled={status === 'moving'}>
          {endOptions.map(pos => (
            <option key={pos.join(',')} value={pos.join(',')}>
              {pos.join(',')}
            </option>
          ))}
        </select>
      </div>
      <button onClick={onStart} disabled={status === 'moving'}
        style={{ width: '100%', padding: '10px', fontSize: 16, background: '#4CAF50', color: 'white', border: 'none', borderRadius: 5 }}>
        {status === 'moving' ? 'Đang di chuyển...' : `Bắt đầu Xe ${id}`}
      </button>
    </div>
  );
}

// Component App chính (Gần như giữ nguyên logic)
export default function App() {
  const [v1, setV1] = useState({
    id: 'V1',
    startPos: [0, 0],
    endPos: [4, 4],
    pos: [0, 0], 
    path: [],   
    status: 'idle' 
  });
  
  const [v2, setV2] = useState({
    id: 'V2',
    startPos: [0, 1],
    endPos: [4, 3],
    pos: [0, 1],
    path: [],
    status: 'idle'
  });

  const handleStart = (vehicleId) => {
    const setVehicle = vehicleId === 'V1' ? setV1 : setV2;
    const vehicleState = vehicleId === 'V1' ? v1 : v2;
    const path = aStarSearch(vehicleState.startPos, vehicleState.endPos);

    if (path.length > 0) {
      setVehicle(prev => ({
        ...prev,
        path: path.slice(1), 
        pos: prev.startPos, 
        status: 'moving'
      }));
    } else {
      alert('Không tìm thấy đường đi cho ' + vehicleId);
    }
  };

  const updateVehicle = (id, field, value) => {
    const setVehicle = id === 'V1' ? setV1 : setV2;
    setVehicle(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // "Game Loop" (Không thay đổi)
  useEffect(() => {
    const timer = setInterval(() => {
      setV1(prev => {
        if (prev.status !== 'moving' || prev.path.length === 0) {
          return { ...prev, status: 'idle' };
        }
        const nextPos = prev.path[0];
        const remainingPath = prev.path.slice(1);
        return {
          ...prev,
          pos: nextPos,
          path: remainingPath,
          status: remainingPath.length === 0 ? 'idle' : 'moving'
        };
      });

      setV2(prev => {
        if (prev.status !== 'moving' || prev.path.length === 0) {
          return { ...prev, status: 'idle' };
        }
        const nextPos = prev.path[0];
        const remainingPath = prev.path.slice(1);
        return {
          ...prev,
          pos: nextPos,
          path: remainingPath,
          status: remainingPath.length === 0 ? 'idle' : 'moving'
        };
      });
      
    }, 1000); // Tốc độ di chuyển: 1 giây/ô

    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      {/* 1. ĐÃ BỎ TIÊU ĐỀ */}
      {/* <h2>Fleet 5×5 — A* Simulation</h2> */} 
      <div style={{ display: 'flex', gap: 30 }}>
        
        <div className="map-container">
          {/* 4. FIX LOGIC "NGƯỢC" */}
          {/* Render lưới ngược lại.
            Dùng `map` với index `r_idx` (0 -> 4).
            Tính `r` thực tế (4 -> 0).
            Grid CSS sẽ render hàng `r=4` lên trên cùng, và hàng `r=0` xuống dưới cùng.
            Điều này làm cho text `0,0` hiển thị ở góc dưới-trái.
          */}
          {Array.from({ length: 5 }, (_, r_idx) => {
            const r = 4 - r_idx; // r_idx=0 -> r=4; r_idx=4 -> r=0
            return Array.from({ length: 5 }, (_, c) => (
              <div key={`${r}-${c}`} className="map-cell">
                {r},{c}
              </div>
            ));
          })}
          
          {/* 2. XE MỚI (Tự động cập nhật) */}
          <Vehicle id={v1.id} pos={v1.pos} status={v1.status} />
          <Vehicle id={v2.id} pos={v2.pos} status={v2.status} />
        </div>

        {/* KHU ĐIỀU KHIỂN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ControlPanel
            vehicle={v1}
            onChange={(field, value) => updateVehicle('V1', field, value)}
            onStart={() => handleStart('V1')}
          />
          <ControlPanel
            vehicle={v2}
            onChange={(field, value) => updateVehicle('V2', field, value)}
            onStart={() => handleStart('V2')}
          />
        </div>
      </div>
    </div>
  );
}