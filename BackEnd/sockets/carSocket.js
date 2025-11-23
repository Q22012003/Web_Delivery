// src/sockets/carSocket.js
import { publishToCar } from "../services/awsIotService.js";

export const setupCarSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Frontend connected:", socket.id);

    // Từ web → gửi lệnh điều khiển xe (ví dụ: start, stop, return home...)
    socket.on("car:command", (cmd) => {
      console.log("Command from web:", cmd);
      publishToCar("car/control", cmd);
    });

    socket.on("disconnect", () => {
      console.log("Frontend disconnected:", socket.id);
    });
  });
};