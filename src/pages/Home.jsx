import { useState, useEffect } from 'react';
import MapGrid from '../components/MapGrid';
import ControlPanel from '../components/ControlPanel';
import { aStarSearch } from '../utils/aStar';

export default function Home() {
  const [v1, setV1] = useState({ id: 'V1', startPos: [1,1], endPos: [5,3], pos: [1,1], path: [], status: 'idle', deliveries: 0 });
  const [v2, setV2] = useState({ id: 'V2', startPos: [1,4], endPos: [5,5], pos: [1,4], path: [], status: 'idle', deliveries: 0 });
  const [logs, setLogs] = useState([]);

  const addLog = (id, deliveries) => {
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    setLogs(prev => [...prev, `[${now}] Xe ${id} giao thành công ${deliveries} lần`] );
  };

  const handleStart = (id) => {
    const setV = id === 'V1' ? setV1 : setV2;
    const v = id === 'V1' ? v1 : v2;

    const path = aStarSearch(v.startPos, v.endPos, true);
    if (path.length === 0) {
      alert(`Xe ${id}: Không có đường đi!`);
      return;
    }

    setV({ ...v, path: path.slice(1), pos: v.startPos, status: 'moving', deliveries: v.deliveries + 1 });
  };

  const update = (id, field, val) => {
    const setV = id === 'V1' ? setV1 : setV2;
    setV(p => ({ ...p, [field]: val, pos: field === 'startPos' ? val : p.pos }));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      [setV1, setV2].forEach((setV, i) => {
        const v = i === 0 ? v1 : v2;
        setV(p => {
          if (p.status !== 'moving' || p.path.length === 0) {
            if (p.status === 'moving') {
              addLog(p.id, p.deliveries);
            }
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

  return (
    <div style={{ padding: 30, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', minHeight: '100vh', fontFamily: 'Arial, sans-serif', color: '#e2e8f0' }}>
      <h1 style={{ textAlign: 'center', marginBottom: 20, color: '#60a5fa', fontWeight: 'bold', textShadow: '0 0 20px rgba(96, 165, 250, 0.5)' }}>
        ĐỒ ÁN: XE GIAO HÀNG TỰ ĐỘNG – A* + QUAY VỀ GỐC
      </h1>

      <div style={{ display: 'flex', gap: 50, justifyContent: 'center', flexWrap: 'wrap' }}>
        <MapGrid v1={v1} v2={v2} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
          <ControlPanel vehicle={v1} onChange={(f, v) => update('V1', f, v)} onStart={() => handleStart('V1')} />
          <ControlPanel vehicle={v2} onChange={(f, v) => update('V2', f, v)} onStart={() => handleStart('V2')} />
        </div>
      </div>

      {/* BẢNG LOG GIAO HÀNG */}
      <div style={{ marginTop: 40, background: '#1e293b', padding: 20, borderRadius: 12, maxWidth: 1000, margin: '40px auto' }}>
        <h2 style={{ color: '#34d399' }}>NHẬT KÝ GIAO HÀNG</h2>
        <div style={{ background: '#0f172a', padding: 15, borderRadius: 8, fontFamily: 'monospace', height: 200, overflowY: 'auto' }}>
          {logs.length === 0 ? <p>Chưa có giao hàng nào...</p> : logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
        <p style={{ marginTop: 10, color: '#94a3b8' }}>
          V1: {v1.deliveries} lần | V2: {v2.deliveries} lần
        </p>
      </div>
    </div>
  );
}