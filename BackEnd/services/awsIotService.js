// src/services/awsIotService.js
import { buildConnection } from "../config/awsIotConfig.js";
import { emitToFrontend } from "./socketService.js";

let connection = null;

export const connectToAwsIot = () => {
  connection = buildConnection();

  connection.on("connect", () => {
    console.log("Connected to AWS IoT Core");

    // Subscribe các topic mà xe sẽ gửi lên
    const topics = [
      "car/telemetry",
      "qr/scanned",
      "delivery/completed",
      "car/status",
      "car/battery",
    ];

    topics.forEach((topic) => {
      connection.subscribe(topic, mqtt.QoS.AtLeastOnce, (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          console.log(`Received on ${topic}:`, data);

          // Đẩy realtime về toàn bộ frontend đang xem /real-time
          emitToFrontend("car:update", { topic, data });
          if (topic === "qr/scanned") emitToFrontend("qr:scanned", data);
          if (topic === "delivery/completed") emitToFrontend("delivery:success", data);

        } catch (err) {
          console.error("Invalid JSON from MQTT:", payload.toString());
        }
      });
    });
  });

  connection.on("error", (error) => {
    console.error("AWS IoT Connection error:", error);
  });

  connection.on("interrupt", () => console.log("Connection interrupted"));
  connection.on("resume", () => console.log("Connection resumed"));

  connection.connect().catch((err) => {
    console.error("Failed to connect AWS IoT:", err);
  });
};

export const publishToCar = (topic, message) => {
  if (connection && connection.connected) {
    connection.publish(topic, JSON.stringify(message), mqtt.QoS.AtLeastOnce);
  }
};