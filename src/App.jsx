// App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Statistics from "./pages/Statistics";
import RealTime from "./pages/RealTime";
import Alert from "./pages/Alert"; 
import Sidebar from "./components/Sidebar";   // thêm dòng này

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar cố định bên trái - hiện ở mọi trang */}
        <Sidebar />

        {/* Nội dung chính */}
        <div style={{ flex: 1, marginLeft: 280 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/real-time" element={<RealTime />} />
            <Route path="/alert" element={<Alert />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}