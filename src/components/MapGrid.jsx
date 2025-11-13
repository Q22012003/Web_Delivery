import Vehicle from './Vehicle';

export default function MapGrid({ v1, v2 }) {
  return (
    <div className="map-container" style={{ width: '1000px', height: '1000px' }}>
      {/* 6x6 Grid */}
      {Array.from({ length: 6 }, (_, rIdx) => {
        const r = 5 - rIdx;
        return Array.from({ length: 6 }, (_, c) => (
          <div key={`${r}-${c}`} className="map-cell" style={{ width: '166.66px', height: '166.66px' }}>
            {r},{c}
          </div>
        ));
      })}

      {/* ĐƯỜNG ĐI: ngang trên (r=1), dọc phải (c=5), ngang dưới (r=5) */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        {/* Đường ngang trên (row 1) */}
        <rect x="0" y="166" width="1000" height="30" fill="#34495e" rx="15" opacity="0.9" />
        <line x1="0" y1="181" x2="1000" y2="181" stroke="#1abc9c" strokeWidth="6" strokeDasharray="40,25" />

        {/* Đường dọc phải (col 5) */}
        <rect x="833" y="0" width="30" height="1000" fill="#34495e" rx="15" opacity="0.9" />
        <line x1="848" y1="0" x2="848" y2="1000" stroke="#1abc9c" strokeWidth="6" strokeDasharray="40,25" />

        {/* Đường ngang dưới (row 5) */}
        <rect x="0" y="833" width="1000" height="30" fill="#34495e" rx="15" opacity="0.9" />
        <line x1="0" y1="848" x2="1000" y2="848" stroke="#1abc9c" strokeWidth="6" strokeDasharray="40,25" />
      </svg>

      <Vehicle id={v1.id} pos={v1.pos} status={v1.status} nextPos={v1.path[0]} />
      <Vehicle id={v2.id} pos={v2.pos} status={v2.status} nextPos={v2.path[0]} />
    </div>
  );
}