// server.js
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");
// Import hàm startNavigationSequence từ service
const { connectToAwsIot, startNavigationSequence } = require("./services/awsIotService.js");

const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"], 
    methods: ["GET", "POST"],
  },
});

global.io = io;
connectToAwsIot();

// --- API MỚI: NHẬN LỘ TRÌNH A* TỪ FRONTEND ---
app.post("/api/car/navigate", (req, res) => {
  const { path } = req.body; 
  // path định dạng: ["1,1", "1,2", "1,3"...]
  
  if (path && Array.isArray(path)) {
      console.log("API: Nhận lộ trình mới:", path);
      startNavigationSequence(path); // Bắt đầu gửi từng bước
      res.json({ success: true, message: "Bắt đầu điều hướng từng bước" });
  } else {
      res.status(400).json({ error: "Lộ trình không hợp lệ" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});