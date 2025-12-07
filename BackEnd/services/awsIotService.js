// services/awsIotService.js
console.log("--> File awsIotService đã được load");
const { buildConnection } = require("../config/awsIotConfig.js");
const mqtt = require("aws-iot-device-sdk-v2").mqtt;
const { TextDecoder } = require("util"); // Cần cái này để giải mã payload chuẩn

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

  let isSubscribing = false;

  // --- HÀM XỬ LÝ TIN NHẮN CHUNG ---
  // Trong SDK v2, hàm này nhận (topic, payload, dup, qos, retain)
  const onPublish = (topic, payload, dup, qos, retain) => {
    try {
      // 1. Giải mã Payload (SDK v2 trả về ArrayBuffer/Uint8Array)
      const decoder = new TextDecoder("utf-8");
      const jsonString = decoder.decode(payload);
      const data = JSON.parse(jsonString);

      console.log(`Nhận → ${topic}:`, data);

      // 2. Logic xử lý riêng cho từng Topic
      if ((topic === "gm65/data/matrix_position" || topic === "car/telemetry") && data.position) {
        // Xử lý chuỗi position "1,2" thành mảng [1, 2]
        // data.position có thể là số hoặc chuỗi, nên convert cẩn thận
        const cleanPos = String(data.position).replace(/,/g, ".");
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

      // Emit chung cho debug hoặc các màn hình khác
      emitToFrontend("car:update", { topic, data });

    } catch (e) {
      console.error(`Lỗi xử lý tin nhắn từ ${topic}:`, e.message);
    }
  };

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
        // --- SỬA CHÍNH Ở ĐÂY ---
        // Tham số thứ 3 chính là hàm callback xử lý tin nhắn (onPublish)
        await connection.subscribe(
          topic, 
          mqtt.QoS.AtLeastOnce, 
          onPublish 
        );
        console.log(`✓ Subscribed: ${topic}`);
      } catch (e) {
        console.warn(`✗ Subscribe ${topic} lỗi:`, e.message || e);
      }
    }
    
    // Đã xóa đoạn connection.onMessage gây lỗi ở đây

    isSubscribing = false;
  };

  // Các sự kiện kết nối
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

  // Bắt đầu kết nối
  connection.connect();
};

// Hàm gửi lệnh xuống xe
const publishToCar = (topic, message) => {
  if (connection) {
    // SDK v2 không có thuộc tính .connected trực tiếp dễ dùng, 
    // ta cứ try publish, nếu chưa connect nó sẽ throw error hoặc queue lại.
    try {
      const payload = JSON.stringify(message);
      connection.publish(topic, payload, mqtt.QoS.AtLeastOnce);
      console.log(`Đã gửi lệnh → ${topic}:`, message);
    } catch (e) {
       console.warn("Lỗi gửi lệnh (có thể chưa kết nối):", e.message);
    }
  } else {
    console.warn("Chưa khởi tạo connection, không gửi được lệnh:", message);
  }
};

module.exports = {
  connectToAwsIot,
  publishToCar,
};