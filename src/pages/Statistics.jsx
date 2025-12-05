// src/pages/Statistics.jsx
import { useState, useEffect } from "react";
import ReactPaginate from "react-paginate";

export default function Statistics() {
  const [tripLogs, setTripLogs] = useState([]);
  const [pageNumber, setPageNumber] = useState(0);
  const logsPerPage = 15;

  useEffect(() => {
    let logs = JSON.parse(localStorage.getItem("tripLogs") || "[]");
    logs = [...logs].reverse(); // tránh mutate array
    setTripLogs(logs);
  }, []);

  const pageCount = Math.ceil(tripLogs.length / logsPerPage);

  const displayedLogs = tripLogs.slice(
    pageNumber * logsPerPage,
    (pageNumber + 1) * logsPerPage
  );

  const handleClear = () => {
    localStorage.clear();
    setTripLogs([]);
    setPageNumber(0);
  };

  return (
    <div style={{ marginLeft: 300, padding: 40 }}>
      <h2 style={{ color: "#34d399", fontSize: "2.5rem", marginBottom: 30 }}>
        LỊCH SỬ GIAO HÀNG
      </h2>

      {/* NÚT XÓA DATA */}
      <button
        onClick={handleClear}
        style={{
          marginBottom: 20,
          padding: "12px 20px",
          background: "#ef4444",
          borderRadius: 8,
          color: "white",
          cursor: "pointer",
          border: "none",
          fontWeight: "bold",
        }}
      >
        XÓA TOÀN BỘ DỮ LIỆU TEST
      </button>

      <div
        style={{
          background: "#1e293b",
          borderRadius: 16,
          padding: 25,
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 900,
            color: "#e2e8f0",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #334155" }}>
              <th style={{ padding: "12px", textAlign: "left" }}>Mã chuyến</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Xe</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Tuyến đường</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Số lượng hàng</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Thời gian</th>
            </tr>
          </thead>

          <tbody>
            {displayedLogs.map((log, index) => (
              <tr key={index} style={{ borderBottom: "1px solid #334155" }}>
                <td style={{ padding: "12px", color: "#60a5fa", fontWeight: "bold" }}>
                  {log.deliveryId}
                </td>
                <td style={{ padding: "12px" }}>{log.vehicleId}</td>
                <td style={{ padding: "12px" }}>{log.route}</td>
                <td style={{ padding: "12px" }}>{log.cargo}</td>
                <td style={{ padding: "12px" }}>{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ==== SỐ TRANG HIỂN THỊ ==== */}
        {tripLogs.length > logsPerPage && (
          <p
            style={{
              textAlign: "center",
              marginTop: 20,
              color: "#94a3b8",
              fontSize: "1.1rem",
            }}
          >
            Trang {pageNumber + 1} / {pageCount}
          </p>
        )}

        {/* ==== PHÂN TRANG DƯỚI DÒNG TRANG X/Y ==== */}
        {tripLogs.length > logsPerPage && (
          <div style={{ marginTop: 20 }}>
            <ReactPaginate
              previousLabel={
                <button
                  style={{
                    padding: "8px 16px",
                    background: "#475569",
                    borderRadius: 8,
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Prev
                </button>
              }
              nextLabel={
                <button
                  style={{
                    padding: "8px 16px",
                    background: "#475569",
                    borderRadius: 8,
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Next
                </button>
              }
              pageCount={pageCount}
              onPageChange={({ selected }) => setPageNumber(selected)}
              containerClassName="pagination"
              activeClassName="active"
              pageRangeDisplayed={5}
              marginPagesDisplayed={1}
              className="flex justify-center gap-2"
              pageLinkClassName="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600"
              activeLinkClassName="bg-blue-600 text-white"
            />
          </div>
        )}
      </div>
    </div>
  );
}
