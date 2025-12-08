// src/pages/Statistics.jsx
import { useState, useEffect } from "react";
import ReactPaginate from "react-paginate";

export default function Statistics() {
  const [tripLogs, setTripLogs] = useState([]);
  const [pageNumber, setPageNumber] = useState(0);
  const logsPerPage = 15;

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
    localStorage.clear();
    setTripLogs([]);
    setPageNumber(0);
  };

  return (
    <div style={{ marginLeft: 300, padding: 40 }}>
      <h2 style={{ color: "#34d399", fontSize: "2.5rem", marginBottom: 30 }}>
        LỊCH SỬ GIAO HÀNG
      </h2>

      <button
        onClick={handleClear}
        style={{
          marginBottom: 20,
          padding: "10px 20px",
          background: "#ef4444",
          borderRadius: 30,
          color: "white",
          cursor: "pointer",
          border: "none",
          fontWeight: "bold",
          fontSize: "0.9rem",
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
              <th style={{ padding: "12px", textAlign: "left" }}>
                Tuyến đường
              </th>
              <th style={{ padding: "12px", textAlign: "left" }}>
                Số lượng hàng
              </th>
              <th style={{ padding: "12px", textAlign: "left" }}>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {displayedLogs.map((log, index) => (
              <tr key={index} style={{ borderBottom: "1px solid #334155" }}>
                <td
                  style={{
                    padding: "12px",
                    color: "#60a5fa",
                    fontWeight: "bold",
                  }}
                >
                  {log.deliveryId}
                </td>
                <td style={{ padding: "12px" }}>{log.vehicleId}</td>
                <td style={{ padding: "12px" }}>{log.route}</td>
                <td style={{ padding: "12px" }}>{log.cargo || "Chưa nhập"}</td>
                <td style={{ padding: "12px" }}>{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {tripLogs.length > logsPerPage && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 40,
            }}
          >
            <div
              style={{
                background: "rgba(30, 41, 59, 0.6)",
                backdropFilter: "blur(6px)",
                padding: "16px 32px",
                borderRadius: "16px",
                border: "1px solid #334155",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              <ReactPaginate
                previousLabel="«"
                nextLabel="»"
                breakLabel="..."
                pageCount={pageCount}
                marginPagesDisplayed={2}
                pageRangeDisplayed={4}
                onPageChange={({ selected }) => setPageNumber(selected)}
                forcePage={pageNumber}
                containerClassName="pagination"
                activeClassName="active"
                disabledClassName="disabled"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
