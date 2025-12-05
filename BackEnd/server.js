// server.js - sửa toàn bộ phần đầu thành thế này

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");
const { connectToAwsIot } = require("./services/awsIotService.js");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Setup Socket.IO với CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"], // Vite port
    methods: ["GET", "POST"],
  },
});

// Gắn io vào service để emit
global.io = io;

// Kết nối AWS IoT ngay khi server chạy
connectToAwsIot();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});