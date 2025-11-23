// src/services/socketService.js
import { io } from "../server.js";

export const emitToFrontend = (event, data) => {
  io.emit(event, data); // Gửi tới tất cả client đang kết nối
  console.log(`Emitted to frontend: ${event}`, data);
};