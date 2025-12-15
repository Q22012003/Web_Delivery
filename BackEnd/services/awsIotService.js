// services/awsIotService.js
console.log("--> File awsIotService đã được load (Logic: Fixed Initial Orientation & Inverted Turns)");
const { buildConnection } = require("../config/awsIotConfig.js");
const mqtt = require("aws-iot-device-sdk-v2").mqtt;
const { TextDecoder } = require("util");

const TOPIC_PUB_COMMAND = "gm65/data/command"; 
const TOPIC_SUB_POSITION = "gm65/data/matrix_position";

let connection = null;

let pathQueue = [];       
let isNavigating = false; 
let currentStepIndex = 0;
let lastPosition = null;  
let lastVector = null;    
let currentTarget = null; 

const emitToFrontend = (event, data) => {
  if (global.io) global.io.emit(event, data);
};

// --- HÀM TÍNH HƯỚNG (ĐÃ SỬA LOGIC) ---
const getDirection = (currentStr, targetStr) => {
  const [r1, c1] = currentStr.split(",").map(Number);
  const [r2, c2] = targetStr.split(",").map(Number);
  const dx = r2 - r1; 
  const dy = c2 - c1;
  const currentVector = { dx, dy };

  // [FIX 1] Không còn check if (!lastVector) return "FORWARD" nữa
  // Vì ta đã set vector mặc định ngay lúc bắt đầu rồi.

  // Tính Cross Product
  const crossProduct = (lastVector.dx * dy) - (lastVector.dy * dx);
  
  // Cập nhật vector cho bước sau
  lastVector = currentVector; 

  if (crossProduct === 0) return "FORWARD";
  
  // [FIX 2] ĐẢO NGƯỢC LOGIC TRÁI/PHẢI CHO HỢP VỚI XE CỦA BẠN
  // Với hệ trục của bạn: Cross > 0 là Phải, Cross < 0 là Trái
  if (crossProduct > 0) return "RIGHT";  
  if (crossProduct < 0) return "LEFT";   
  
  return "FORWARD";
};

const sendNextPosition = () => {
  if (pathQueue.length === 0) {
    console.log("=== [DONE] ĐÃ ĐẾN ĐÍCH CUỐI CÙNG ===");
    isNavigating = false;
    currentTarget = null;
    publishToCar(TOPIC_PUB_COMMAND, { type: "STOP", message: "Finished" });
    return;
  }

  const nextTarget = pathQueue.shift(); 
  currentStepIndex++;

  const direction = getDirection(lastPosition, nextTarget);
  currentTarget = nextTarget; 

  const payload = { type: "STEP", target: nextTarget, direction: direction };
  
  console.log(`>>> [CMD] Gửi xe: Từ ${lastPosition} -> Tới ${nextTarget} (${direction})`);
  publishToCar(TOPIC_PUB_COMMAND, payload);

  lastPosition = nextTarget;
};

const startNavigationSequence = (rawPath, startPoint) => {
  console.log("-------------------------------------------------------");
  console.log(`[NAVIGATE] Start: ${startPoint}`);

  let cleanPath = [...rawPath];
  if (cleanPath.length > 0 && cleanPath[0] === startPoint) {
      cleanPath.shift();
  }

  if (cleanPath.length === 0) return;

  pathQueue = cleanPath;
  lastPosition = startPoint; 
  
  // [QUAN TRỌNG - FIX 3] THIẾT LẬP HƯỚNG MẶC ĐỊNH CỦA XE
  // Giả sử xe đang ở 1.1 và đầu xe HƯỚNG VỀ 2.1 (Hướng hàng tăng)
  // Vector (dx=1, dy=0) nghĩa là đang nhìn xuống dưới (theo ma trận)
  lastVector = { dx: 1, dy: 0 }; 
  
  currentTarget = null;
  isNavigating = true;
  currentStepIndex = 0;

  console.log(`-> Set hướng mặc định: Đầu xe đang hướng về phía tăng số hàng (Forward = hướng xuống).`);
  
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

        if (isNavigating && data.status === "OK") {
            if (rawPos === currentTarget) {
                console.log(`✓ [ACK] Đã đến ${rawPos}. Đi tiếp...`);
                setTimeout(() => sendNextPosition(), 100); 
            }
        }
      }
    } catch (e) { console.error(e.message); }
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
    setTimeout(connectToAwsIot, 5000);
  }
};

const publishToCar = (topic, message) => {
  if (connection) connection.publish(topic, JSON.stringify(message), mqtt.QoS.AtLeastOnce);
};

module.exports = { connectToAwsIot, publishToCar, startNavigationSequence };