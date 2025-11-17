import http from "http";
import app from "./app.js";
import { Server } from "socket.io";

const server = http.createServer(app);
export const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", () => {
  console.log("FE connected");
});

server.listen(3000, () => {
  console.log("Backend running on port 3000");
});
