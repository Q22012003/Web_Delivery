// src/pages/Statistics.jsx
import { useState, useEffect } from "react";
import ReactPaginate from "react-paginate";

// Icon SVG đơn giản (để không phải cài thư viện icon)
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
);

const TruckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
);

export default function Statistics() {
  const [tripLogs, setTripLogs] = useState([]);
  const [pageNumber, setPageNumber] = useState(0);
  const logsPerPage = 10; // Giảm xuống 10 để bảng thoáng hơn

  useEffect(() => {
    let logs = JSON.parse(localStorage.getItem("tripLogs") || "[]");
    logs = [...logs].reverse();
    setTripLogs(logs);
  }, []);

  const pageCount = Math.ceil(tripLogs.length / logsPerPage);
  const displayedLogs = tripLogs.slice(
    pageNumber * logsPerPage,
    (pageNumber + 1) * logsPerPage
  );

  const handleClear = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử không?")) {
      localStorage.removeItem("tripLogs"); // Chỉ xóa key tripLogs, tránh xóa token đăng nhập nếu có
      setTripLogs([]);
      setPageNumber(0);
    }
  };

  return (
    <div className="stats-container">
      {/* CSS Styles nội bộ để xử lý hover và pagination */}
      <style>{`
        .stats-container {
          margin-left: 300px;
          padding: 40px;
          min-height: 100vh;
          background-color: #0f172a; /* Slate 900 - Nền tối sâu */
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        /* Hiệu ứng bảng */
        .glass-panel {
          background: #1e293b; /* Slate 800 */
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
          border: 1px solid #334155;
          overflow: hidden;
        }

        .custom-table {
          width: 100%;
          border-collapse: collapse;
          color: #cbd5e1; /* Slate 300 */
        }

        .custom-table thead tr {
          background: #0f172a;
          border-bottom: 2px solid #334155;
        }
        
        .custom-table th {
          padding: 16px 24px;
          text-align: left;
          font-weight: 600;
          color: #94a3b8; /* Slate 400 */
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .custom-table tbody tr {
          border-bottom: 1px solid #334155;
          transition: all 0.2s ease;
        }

        .custom-table tbody tr:last-child {
          border-bottom: none;
        }

        .custom-table tbody tr:hover {
          background-color: #2a3855; /* Highlight khi hover */
        }

        .custom-table td {
          padding: 16px 24px;
          font-size: 0.95rem;
        }

        /* Badge Styles */
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .badge-id { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.2); }
        .badge-vehicle { background: rgba(16, 185, 129, 0.15); color: #34d399; gap: 6px; }

        /* Nút xóa */
        .btn-delete {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-delete:hover {
          background: #ef4444;
          color: white;
          transform: translateY(-1px);
        }

        /* Pagination Style */
        .pagination-wrapper {
          padding: 24px;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid #334155;
          background: #182335;
        }
        .pagination {
          display: flex;
          list-style: none;
          gap: 8px;
          padding: 0;
          margin: 0;
        }
        .pagination li a {
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          color: #94a3b8;
          font-size: 0.9rem;
          transition: all 0.2s;
          background: #1e293b;
          border: 1px solid #334155;
        }
        .pagination li a:hover {
          background: #334155;
          color: #fff;
        }
        .pagination li.active a {
          background: #3b82f6; /* Blue 500 */
          color: white;
          border-color: #3b82f6;
          font-weight: bold;
        }
        .pagination li.disabled a {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      {/* Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <div>
          <h2 style={{ 
            margin: 0, 
            background: "linear-gradient(45deg, #60a5fa, #a78bfa)", 
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: "2rem",
            fontWeight: "800",
            letterSpacing: "-0.5px"
          }}>
            LỊCH SỬ GIAO HÀNG
          </h2>
          <p style={{ color: "#94a3b8", marginTop: 8, fontSize: "0.95rem" }}>
            Quản lý và theo dõi toàn bộ chuyến xe trong hệ thống
          </p>
        </div>

        {tripLogs.length > 0 && (
          <button onClick={handleClear} className="btn-delete">
            <TrashIcon /> Xóa dữ liệu
          </button>
        )}
      </div>

      {/* Main Table Panel */}
      <div className="glass-panel">
        <div style={{ overflowX: "auto" }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{width: '15%'}}>Mã chuyến</th>
                <th style={{width: '10%'}}>Xe</th>
                <th style={{width: '25%'}}>Tuyến đường</th>
                <th style={{width: '25%'}}>Số lượng hàng</th>
                <th style={{width: '25%'}}>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {displayedLogs.length > 0 ? (
                displayedLogs.map((log, index) => (
                  <tr key={index}>
                    <td>
                      <span className="badge badge-id">#{log.deliveryId}</span>
                    </td>
                    <td>
                      <span className="badge badge-vehicle">
                        <TruckIcon /> {log.vehicleId}
                      </span>
                    </td>
                    <td style={{ color: "#e2e8f0" }}>
                      <div style={{display:'flex', flexDirection:'column'}}>
                         <span>{log.route}</span>
                      </div>
                    </td>
                    <td style={{ color: "#cbd5e1" }}>
                      {log.cargo ? log.cargo : <span style={{color: '#64748b', fontStyle:'italic'}}>Không có dữ liệu</span>}
                    </td>
                    <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{log.time}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                    <div style={{fontSize: '3rem', marginBottom: 10}}>📦</div>
                    Chưa có dữ liệu chuyến hàng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        {tripLogs.length > logsPerPage && (
          <div className="pagination-wrapper">
            <ReactPaginate
              previousLabel="←"
              nextLabel="→"
              breakLabel="..."
              pageCount={pageCount}
              marginPagesDisplayed={1}
              pageRangeDisplayed={3}
              onPageChange={({ selected }) => setPageNumber(selected)}
              forcePage={pageNumber}
              containerClassName="pagination"
              activeClassName="active"
              disabledClassName="disabled"
            />
          </div>
        )}
      </div>
    </div>
  );
}