// src/pages/Alert.jsx
import { useState, useEffect } from "react";
import ReactPaginate from "react-paginate";

export default function Alert() {
  const [alertLogs, setAlertLogs] = useState([]);
  const [pageNumber, setPageNumber] = useState(0);
  const logsPerPage = 15;

  useEffect(() => {
    let logs = JSON.parse(localStorage.getItem("alertLogs") || "[]");
    logs = [...logs].reverse();
    setAlertLogs(logs);
  }, []);

  const pageCount = Math.ceil(alertLogs.length / logsPerPage);

  const displayedLogs = alertLogs.slice(
    pageNumber * logsPerPage,
    (pageNumber + 1) * logsPerPage
  );

  const handleClear = () => {
    localStorage.removeItem("alertLogs");
    setAlertLogs([]);
    setPageNumber(0);
  };

  return (
    <div style={{ marginLeft: 300, padding: 40 }}>
      <h2 style={{ color: "#f87171", fontSize: "2.5rem", marginBottom: 30 }}>
        CẢNH BÁO
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
        XÓA TẤT CẢ CẢNH BÁO
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
              <th style={{ padding: "12px", textAlign: "left" }}>Mã cảnh báo</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Xe</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Loại cảnh báo</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Mô tả</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Thời gian</th>
            </tr>
          </thead>

          <tbody>
            {displayedLogs.map((log, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #334155" }}>
                <td style={{ padding: "12px", color: "#fca5a5", fontWeight: "bold" }}>
                  {log.alertId}
                </td>
                <td style={{ padding: "12px" }}>{log.vehicleId}</td>
                <td style={{ padding: "12px" }}>{log.type}</td>
                <td style={{ padding: "12px" }}>{log.description}</td>
                <td style={{ padding: "12px" }}>{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {alertLogs.length > logsPerPage && (
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
