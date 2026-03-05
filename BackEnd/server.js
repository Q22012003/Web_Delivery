// server.js
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");
const { connectToAwsIot, startNavigationSequence, sendCommandToCar } = require("./services/awsIotService.js");

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


// --- API GỬI LỆNH TRỰC TIẾP XUỐNG XE (HOLD/STOP/FINISH/DELIVERED...) ---
app.post("/api/car/command", (req, res) => {
  const allowed = new Set(["V1","V2","V3","V4","V5"]);
  const vehicle_id = req.body?.vehicle_id;

  if (!vehicle_id || !allowed.has(vehicle_id)) {
    return res.status(400).json({ error: "vehicle_id phải là 'V1'..'V5'" });
  }

  // Accept either { command: {...} } or flat body { type, ms, ... }
  const rawCmd = (req.body && typeof req.body.command === "object" && req.body.command) ? req.body.command : req.body;
  const type = String(rawCmd?.type || "").toUpperCase();

  const allowTypes = new Set(["STOP", "HOLD", "FINISH", "DELIVERED", "STEP"]);
  if (!type || !allowTypes.has(type)) {
    return res.status(400).json({ error: `type không hợp lệ. Cho phép: ${Array.from(allowTypes).join(", ")}` });
  }

  // sanitize payload (only forward known keys to MCU)
  const cmd = { type };

  if (type === "HOLD") {
    const ms = Number(rawCmd?.ms ?? 3000);
    cmd.ms = Number.isFinite(ms) ? ms : 3000;
  }

  if (type === "STEP") {
    // ⚠️ Chỉ dùng để test. Bình thường dùng /api/car/navigate
    if (!rawCmd?.target || !rawCmd?.direction) {
      return res.status(400).json({ error: "STEP cần đủ target và direction" });
    }
    cmd.target = String(rawCmd.target);
    cmd.direction = String(rawCmd.direction).toUpperCase();
  }

  if (type === "STOP") {
    // optional: reset heading
    if (rawCmd?.reset_heading != null) cmd.reset_heading = !!rawCmd.reset_heading;
  }

  try {
    sendCommandToCar(vehicle_id, cmd);
    return res.json({ success: true, vehicle_id, sent: cmd });
  } catch (e) {
    console.error("[API] sendCommandToCar error:", e?.message || e);
    return res.status(500).json({ error: e?.message || "sendCommandToCar failed" });
  }
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});