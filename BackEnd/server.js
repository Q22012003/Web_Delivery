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
    let { vehicle_id, path, startPoint, cargo, commands, meta, metaInfo } = req.body;
    // ✅ backward-compatible: UI cũ có thể gửi metaInfo thay vì meta
    if (!meta && metaInfo) meta = metaInfo;

  const allowed = new Set(["V1","V2","V3","V4","V5"]);
    if (!vehicle_id || !allowed.has(vehicle_id)) {
    return res.status(400).json({ error: "vehicle_id phải là 'V1'..'V5'" });
  }

  if (!path || !Array.isArray(path) || path.length === 0) {
    console.log("[API ERROR] path rỗng hoặc sai định dạng");
    return res.status(400).json({ error: "Cần gửi lên 'path' là một mảng tọa độ" });
  }

  // Nếu web không gửi startPoint, lấy luôn path[0]
  if (!startPoint) {
    startPoint = path[0];
    console.log(`[API INFO] Web không gửi startPoint, tự chọn: ${startPoint}`);
  }

  try {
    startNavigationSequence(vehicle_id, path, startPoint, meta || {});
    res.json({ success: true, message: `Đã nhận lệnh cho ${vehicle_id}. Xuất phát từ ${startPoint}` });
  } catch (error) {
    console.error("Lỗi khi gọi startNavigationSequence:", error);
    res.status(500).json({ error: "Lỗi Server nội bộ" });
  }
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});