// server.js
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");
const { connectToAwsIot, startNavigationSequence } = require("./services/awsIotService.js");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*", // Chấp nhận mọi nguồn để test cho dễ
    methods: ["GET", "POST"],
  },
});

global.io = io;
connectToAwsIot();

// --- API NHẬN LỘ TRÌNH (ĐÃ SỬA ĐỂ KHÔNG BỊ LỖI) ---
app.post("/api/car/navigate", (req, res) => {
  let { path, startPoint } = req.body;

  // 1. Kiểm tra dữ liệu cơ bản
  if (!path || !Array.isArray(path) || path.length === 0) {
    console.log("[API ERROR] Nhận được dữ liệu rỗng hoặc sai định dạng");
    return res.status(400).json({ error: "Cần gửi lên 'path' là một mảng tọa độ" });
  }

  // 2. LOGIC TỰ ĐỘNG XỬ LÝ START POINT
  // Nếu Web không gửi startPoint, ta lấy luôn điểm đầu của path làm startPoint
  if (!startPoint) {
      startPoint = path[0]; 
      console.log(`[API INFO] Web không gửi startPoint, tự động chọn: ${startPoint}`);
  }

  // 3. Gọi service để xử lý
  try {
      startNavigationSequence(path, startPoint);
      res.json({ success: true, message: `Đã nhận lệnh. Xuất phát từ ${startPoint}` });
  } catch (error) {
      console.error("Lỗi khi gọi startNavigationSequence:", error);
      res.status(500).json({ error: "Lỗi Server nội bộ" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});