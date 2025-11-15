// App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import RealTime from "./pages/RealTime";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/real-time" element={<RealTime />} />
      </Routes>
    </BrowserRouter>
  );
}