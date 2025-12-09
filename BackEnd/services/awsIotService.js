// services/awsIotService.js
console.log("--> File awsIotService đã được load");
const { buildConnection } = require("../config/awsIotConfig.js");
const mqtt = require("aws-iot-device-sdk-v2").mqtt;
const { TextDecoder } = require("util");

// Biến toàn cục để giữ kết nối
let connection = null;

// --- BIẾN QUẢN LÝ LỘ TRÌNH (HANDSHAKE) ---
let pathQueue = [];       // Hàng đợi chứa các điểm: ["1,1", "1,2", "1,3"]
let isNavigating = false; // Cờ đang chạy
let currentStepIndex = 0; // Đếm bước để log

// Emit về frontend
const emitToFrontend = (event, data) => {
  if (global.io) {
    global.io.emit(event, data);
    console.log(`Emitted: ${event}`, data);
  }
};

// --- HÀM GỬI ĐIỂM TIẾP THEO ---
const sendNextPosition = () => {
  if (pathQueue.length === 0) {
    console.log("=== ĐÃ HOÀN THÀNH LỘ TRÌNH ===");
    isNavigating = false;
    return;
  }

  // Lấy điểm đầu tiên
  const nextTarget = pathQueue.shift();
  currentStepIndex++;

  // Payload gửi xuống MCU
  const payload = {
    type: "STEP",      
    target: nextTarget // VD: "1,2"
  };

  // LOG YÊU CẦU: "đã gửi vị trí .. xuống MCU"
  console.log(`đã gửi vị trí ${nextTarget} xuống MCU`);

  // Gửi lệnh
  publishToCar("gm65/data/command", payload);
};

// --- HÀM BẮT ĐẦU (GỌI TỪ API) ---
const startNavigationSequence = (fullPath) => {
  pathQueue = [...fullPath];
  isNavigating = true;
  currentStepIndex = 0;
  
  console.log(`[BACKEND] Bắt đầu lộ trình mới gồm ${pathQueue.length} bước.`);
  
  // Gửi điểm đầu tiên ngay lập tức
  sendNextPosition();
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

  const onPublish = (topic, payload, dup, qos, retain) => {
    try {
      const decoder = new TextDecoder("utf-8");
      const jsonString = decoder.decode(payload);
      const data = JSON.parse(jsonString);

      console.log(`Nhận → ${topic}:`, data);

      // Xử lý vị trí xe (cập nhật map)
      if ((topic === "gm65/data/matrix_position") && data.position) {
        const cleanPos = String(data.position).replace(/,/g, ".");
        const [row, col] = cleanPos.split(".").map(Number);

        if (!isNaN(row) && !isNaN(col)) {
          emitToFrontend("car:position", {
            device_id: data.device_id || "unknown",
            position: [row, col],
            timestamp: new Date().toISOString(),
          });
        }

        // --- LOGIC HANDSHAKE ---
        // Nếu MCU gửi status: "OK" -> Gửi bước tiếp theo
        if (isNavigating && data.status === "OK") {
            // LOG YÊU CẦU: "đã nhận được phản hồi từ MCU"
            console.log("đã nhận được phản hồi từ MCU");
            
            // Delay nhỏ để tránh spam
            setTimeout(() => {
                sendNextPosition();
            }, 500);
        }
      }

      emitToFrontend("car:update", { topic, data });

    } catch (e) {
      console.error(`Lỗi xử lý tin nhắn từ ${topic}:`, e.message);
    }
  };

  const subscribeAll = async () => {
    const topics = [
      "gm65/data/matrix_position",
      "car/telemetry",
      "qr/scanned",
      // Subscribe topic command để debug xem lệnh gửi đi chưa
      "gm65/data/command" 
    ];

    for (const topic of topics) {
      try {
        await connection.subscribe(topic, mqtt.QoS.AtLeastOnce, onPublish);
        console.log(`✓ Subscribed: ${topic}`);
      } catch (e) {
        console.warn(`✗ Subscribe ${topic} lỗi:`, e.message || e);
      }
    }
  };

  connection.on("connect", () => {
    console.log("ĐÃ KẾT NỐI THÀNH CÔNG AWS IoT Core!");
    subscribeAll();
  });

  connection.on("resume", () => {
    console.log("Kết nối khôi phục...");
    subscribeAll();
  });

  connection.on("error", (err) => console.error("AWS IoT lỗi:", err));
  connection.on("close", () => console.log("Kết nối đóng..."));
  connection.connect();
};

const publishToCar = (topic, message) => {
  if (connection) {
    try {
      const payload = JSON.stringify(message);
      connection.publish(topic, payload, mqtt.QoS.AtLeastOnce);
    } catch (e) {
       console.warn("Lỗi gửi lệnh:", e.message);
    }
  }
};

module.exports = {
  connectToAwsIot,
  publishToCar,
  startNavigationSequence // Export hàm này
};