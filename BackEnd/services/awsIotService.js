// services/awsIotService.js
const { buildConnection } = require("../config/awsIotConfig.js");
const mqtt = require("aws-iot-device-sdk-v2").mqtt;

// Biến toàn cục để giữ kết nối
let connection = null;

// Emit về frontend
const emitToFrontend = (event, data) => {
  if (global.io) {
    global.io.emit(event, data);
    console.log(`Emitted: ${event}`, data);
  }
};

const connectToAwsIot = async () => {
  console.log("Đang kết nối tới AWS IoT Core...");
  try {
    connection = await buildConnection();
    await setupConnectionEvents();
  } catch (err) {
    console.error("Không thể tạo connection AWS IoT:", err.message || err);
    setTimeout(connectToAwsIot, 5000);
  }
};

const setupConnectionEvents = async () => {
  if (!connection) return;

  let isSubscribing = false;   // ← CỜ ĐÁNH DẤU – CHÌA KHÓA VÀNG!

  const subscribeAll = async () => {
    if (isSubscribing) {
      console.log("Đang subscribe rồi, bỏ qua...");
      return;
    }
    isSubscribing = true;
    console.log("Đang subscribe tất cả topic...");

    const topics = [
      "gm65/data/matrix_position",
      "car/telemetry",
      "qr/scanned",
      "delivery/completed",
      "car/status",
      "car/battery",
    ];

    for (const topic of topics) {
      try {
        await connection.subscribe(topic, mqtt.QoS.AtLeastOnce);
        console.log(`✓ Subscribed: ${topic}`);
      } catch (e) {
        console.warn(`✗ Subscribe ${topic} lỗi:`, e.message || e);
      }
    }

    // Gắn listener nhận message (chỉ gắn 1 lần duy nhất)
    topics.forEach(topic => {
      connection.onMessage(topic, (payload) => {
        try {
          const data = JSON.parse(payload.toString());
          console.log(`Nhận → ${topic}:`, data);

          if ((topic === "gm65/data/matrix_position" || topic === "car/telemetry") && data.position) {
            const cleanPos = data.position.replace(/,/g, ".");
            const [row, col] = cleanPos.split(".").map(Number);

            if (!isNaN(row) && !isNaN(col)) {
              emitToFrontend("car:position", {
                device_id: data.device_id || "unknown",
                position: [row, col],
                timestamp: new Date().toISOString(),
              });
              console.log(`XẾ CHẠY RỒI → [${row},${col}]`);
            }
          }

          emitToFrontend("car:update", { topic, data });
        } catch (e) {
          console.error("Parse lỗi:", e.message);
        }
      });
    });

    isSubscribing = false;
  };

  // Chỉ subscribe khi connect lần đầu + khi resume (có cờ bảo vệ)
  connection.on("connect", () => {
    console.log("ĐÃ KẾT NỐI THÀNH CÔNG AWS IoT Core!");
    subscribeAll();
  });

  connection.on("resume", () => {
    console.log("Kết nối khôi phục → kiểm tra lại subscription...");
    subscribeAll();
  });

  connection.on("error", (err) => console.error("AWS IoT lỗi:", err));
  connection.on("close", () => console.log("Kết nối đóng..."));

  connection.connect();
};

// Hàm gửi lệnh xuống xe
const publishToCar = (topic, message) => {
  if (connection && connection.connected) {
    const payload = JSON.stringify(message);
    connection.publish(topic, payload, mqtt.QoS.AtLeastOnce);
    console.log(`Đã gửi lệnh → ${topic}:`, message);
  } else {
    console.warn("Chưa kết nối AWS IoT, không gửi được lệnh:", message);
  }
};

module.exports = {
  connectToAwsIot,
  publishToCar,
};