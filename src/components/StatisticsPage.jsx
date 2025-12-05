// src/components/StatisticsPage.jsx
import { useState, useEffect } from 'react';
import ReactPaginate from 'react-paginate';

export default function StatisticsPage() {
  const [tripLogs, setTripLogs] = useState([]);
  const [pageNumber, setPageNumber] = useState(0);
  const logsPerPage = 10; // Số log mỗi trang

  useEffect(() => {
    // Lấy từ localStorage
    const logs = JSON.parse(localStorage.getItem('tripLogs') || '[]');
    setTripLogs(logs);

    // Nếu dùng BE: fetch('/api/logs').then(res => res.json()).then(setTripLogs);
  }, []);

  const pageCount = Math.ceil(tripLogs.length / logsPerPage);
  const displayedLogs = tripLogs.slice(pageNumber * logsPerPage, (pageNumber + 1) * logsPerPage);

  return (
    <div style={{ background: '#1e293b', padding: 25, borderRadius: 16, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ color: '#34d399' }}>THỐNG KÊ DỮ LIỆU</h2>
      <table style={{ width: '100%', color: '#e2e8f0', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Tên xe</th>
            <th>Xuất phát - Đích</th>
            <th>Số lượng hàng</th>
            <th>Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {displayedLogs.map((log, i) => (
            <tr key={i}>
              <td>{log.id}</td>
              <td>{log.route}</td>
              <td>{log.cargo}</td>
              <td>{log.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReactPaginate
        previousLabel="Trước"
        nextLabel="Sau"
        pageCount={pageCount}
        onPageChange={({ selected }) => setPageNumber(selected)}
        containerClassName="pagination"
        activeClassName="active"
      />
    </div>
  );
}