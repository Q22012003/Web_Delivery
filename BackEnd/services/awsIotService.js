// services/awsIotService.js
console.log("--> File awsIotService đã được load (Logic: Auto-Detect Start)");
const { buildConnection } = require("../config/awsIotConfig.js");
const mqtt = require("aws-iot-device-sdk-v2").mqtt;
const { TextDecoder } = require("util");

const TOPIC_PUB_COMMAND = "gm65/data/command"; 
const TOPIC_SUB_POSITION = "gm65/data/matrix_position";

let connection = null;

// --- BIẾN QUẢN LÝ ---
let pathQueue = [];       
let isNavigating = false; 
let currentStepIndex = 0;
let lastPosition = null;  
let lastVector = null;    
let currentTarget = null; 

const emitToFrontend = (event, data) => {
  if (global.io) global.io.emit(event, data);
};

// --- HÀM TÍNH HƯỚNG (GIỮ NGUYÊN) ---
const getDirection = (currentStr, targetStr) => {
  const [r1, c1] = currentStr.split(",").map(Number);
  const [r2, c2] = targetStr.split(",").map(Number);
  const dx = r2 - r1; 
  const dy = c2 - c1;
  const currentVector = { dx, dy };

  if (!lastVector) {
    lastVector = currentVector; 
    return "FORWARD";
  }
  const crossProduct = (lastVector.dx * dy) - (lastVector.dy * dx);
  lastVector = currentVector; 

  if (crossProduct === 0) return "FORWARD";
  if (crossProduct > 0) return "LEFT"; 
  if (crossProduct < 0) return "RIGHT";
  return "FORWARD";
};

// --- HÀM GỬI LỆNH ĐI ---
const sendNextPosition = () => {
  if (pathQueue.length === 0) {
    console.log("=== [DONE] ĐÃ ĐẾN ĐÍCH CUỐI CÙNG ===");
    isNavigating = false;
    currentTarget = null;
    publishToCar(TOPIC_PUB_COMMAND, { type: "STOP", message: "Finished" });
    return;
  }

  const nextTarget = pathQueue.shift(); // Lấy điểm tiếp theo
  currentStepIndex++;

  const direction = getDirection(lastPosition, nextTarget);
  currentTarget = nextTarget; // Lưu lại để chờ phản hồi

  const payload = { type: "STEP", target: nextTarget, direction: direction };
  
  console.log(`>>> [CMD] Gửi xe: Từ ${lastPosition} -> Tới ${nextTarget} (${direction})`);
  publishToCar(TOPIC_PUB_COMMAND, payload);

  // Cập nhật vị trí hiện tại là điểm vừa gửi (để tính toán cho bước sau)
  lastPosition = nextTarget;
};

// --- HÀM XỬ LÝ LOGIC START (QUAN TRỌNG NHẤT) ---
const startNavigationSequence = (rawPath, startPoint) => {
  console.log("-------------------------------------------------------");
  console.log(`[NAVIGATE] Yêu cầu đi từ: ${startPoint}`);
  console.log(`[NAVIGATE] Lộ trình gốc: ${JSON.stringify(rawPath)}`);

  // 1. Sao chép mảng để xử lý
  let cleanPath = [...rawPath];

  // 2. Xử lý logic trùng điểm đầu
  // Nếu điểm đầu tiên trong path TRÙNG với startPoint -> Xóa nó đi
  // (Ví dụ: Đứng ở 1,1 mà path bắt đầu là ["1,1", "1,2"] -> Cần xóa "1,1" để xe đi thẳng tới "1,2")
  if (cleanPath.length > 0 && cleanPath[0] === startPoint) {
      console.log(`-> Đã xóa điểm trùng đầu tiên (${cleanPath[0]}) khỏi hàng đợi.`);
      cleanPath.shift();
  }

  if (cleanPath.length === 0) {
      console.log("-> Lộ trình rỗng sau khi lọc (Xe đã ở đích).");
      return;
  }

  // 3. Setup biến
  pathQueue = cleanPath;
  lastPosition = startPoint; // Điểm gốc
  lastVector = null; 
  currentTarget = null;
  isNavigating = true;
  currentStepIndex = 0;

  console.log(`-> Hàng đợi di chuyển thực tế: ${JSON.stringify(pathQueue)}`);
  console.log("-------------------------------------------------------");

  // 4. Bắt đầu di chuyển
  sendNextPosition();
};

const setupConnectionEvents = async () => {
  if (!connection) return;

  const onPublish = (topic, payload) => {
    try {
      const decoder = new TextDecoder("utf-8");
      const jsonString = decoder.decode(payload);
      const data = JSON.parse(jsonString);

      if ((topic === TOPIC_SUB_POSITION) && data.position) {
         const rawPos = String(data.position).replace(/\./g, ",");
         const [row, col] = rawPos.split(",").map(Number);
         emitToFrontend("car:position", { position: [row, col], timestamp: new Date() });

        // LOGIC HANDSHAKE
        // Kiểm tra đúng là xe báo "OK" và đúng vị trí đang đợi (currentTarget)
        if (isNavigating && data.status === "OK") {
            if (rawPos === currentTarget) {
                console.log(`✓ [ACK] Đã đến ${rawPos}. Đi tiếp...`);
                setTimeout(() => sendNextPosition(), 100); 
            } else {
                // Log nhẹ để biết
                // console.log(`... Đợi ${currentTarget}, xe đang báo ${rawPos}`);
            }
        }
      }
    } catch (e) {
      console.error(`Err parsing ${topic}:`, e.message);
    }
  };

  const subscribeAll = async () => {
    await connection.subscribe(TOPIC_SUB_POSITION, mqtt.QoS.AtLeastOnce, onPublish);
    console.log(`✓ Subscribed: ${TOPIC_SUB_POSITION}`);
  };

  connection.on("connect", () => {
    console.log("ĐÃ KẾT NỐI AWS IOT!");
    subscribeAll();
  });
  connection.on("resume", () => subscribeAll());
  connection.connect();
};

const connectToAwsIot = async () => {
  try {
    connection = await buildConnection();
    await setupConnectionEvents();
  } catch (err) {
    console.error("Lỗi AWS:", err.message);
    setTimeout(connectToAwsIot, 5000);
  }
};

const publishToCar = (topic, message) => {
  if (connection) {
    connection.publish(topic, JSON.stringify(message), mqtt.QoS.AtLeastOnce);
  } else {
    console.log("⚠️ Mất kết nối AWS, không gửi được lệnh:", message);
  }
};

module.exports = { connectToAwsIot, publishToCar, startNavigationSequence };