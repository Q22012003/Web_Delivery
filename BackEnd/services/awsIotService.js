// services/awsIotService.js (MULTI-VEHICLE)
console.log("--> awsIotService loaded (Multi-vehicle topics: car/V1/*, car/V2/*)");

const { buildConnection } = require("../config/awsIotConfig.js");
const mqtt = require("aws-iot-device-sdk-v2").mqtt;
const { TextDecoder } = require("util");

let connection = null;

// Topic map đúng theo MCU
const TOPICS = {
  V1: { pubCmd: "car/V1/command", subPos: "car/V1/matrix_position" },
  V2: { pubCmd: "car/V2/command", subPos: "car/V2/matrix_position" },
};

// Session state tách theo xe (tránh đè state)
const sessions = {
  V1: { pathQueue: [], isNavigating: false, lastPosition: null, lastVector: { dx: 1, dy: 0 }, currentTarget: null },
  V2: { pathQueue: [], isNavigating: false, lastPosition: null, lastVector: { dx: 1, dy: 0 }, currentTarget: null },
};

const emitToFrontend = (event, data) => {
  if (global.io) global.io.emit(event, data);
};

const getDirection = (session, currentStr, targetStr) => {
  const [r1, c1] = currentStr.split(",").map(Number);
  const [r2, c2] = targetStr.split(",").map(Number);

  const dx = r2 - r1;
  const dy = c2 - c1;
  const currentVector = { dx, dy };

  const crossProduct = (session.lastVector.dx * dy) - (session.lastVector.dy * dx);
  session.lastVector = currentVector;

  if (crossProduct === 0) return "FORWARD";
  // theo logic xe bạn: cross > 0 là RIGHT, cross < 0 là LEFT
  if (crossProduct > 0) return "RIGHT";
  return "LEFT";
};

const publishToCar = (topic, message) => {
  if (connection) {
    connection.publish(topic, JSON.stringify(message), mqtt.QoS.AtLeastOnce);
  }
};

const sendNextPosition = (vehicleId) => {
  const s = sessions[vehicleId];
  if (!s || !s.isNavigating) return;

  if (s.pathQueue.length === 0) {
    console.log(`=== [DONE ${vehicleId}] ĐÃ ĐẾN ĐÍCH CUỐI CÙNG ===`);
    s.isNavigating = false;
    s.currentTarget = null;
    publishToCar(TOPICS[vehicleId].pubCmd, { type: "STOP", message: "Finished" });
    return;
  }

  const nextTarget = s.pathQueue.shift();
  const direction = getDirection(s, s.lastPosition, nextTarget);
  s.currentTarget = nextTarget;

  const payload = { type: "STEP", target: nextTarget, direction };
  console.log(`>>> [CMD ${vehicleId}] ${s.lastPosition} -> ${nextTarget} (${direction})`);

  publishToCar(TOPICS[vehicleId].pubCmd, payload);

  // Lưu ý: lastPosition chỉ nên update sau khi ACK, nhưng vì bạn đang dùng QR + ACK status OK,
  // ta vẫn giữ update ở đây để direction consistent. Nếu muốn “cứng” hơn, update trong ACK.
  s.lastPosition = nextTarget;
};

const startNavigationSequence = (vehicleId, rawPath, startPoint) => {
  if (!sessions[vehicleId]) throw new Error(`Unknown vehicleId: ${vehicleId}`);

  const s = sessions[vehicleId];
  console.log("-------------------------------------------------------");
  console.log(`[NAVIGATE ${vehicleId}] Start: ${startPoint}`);

  // Clean path: bỏ startPoint nếu trùng phần tử đầu
  let cleanPath = [...rawPath];
  if (cleanPath.length > 0 && cleanPath[0] === startPoint) cleanPath.shift();
  if (cleanPath.length === 0) return;

  s.pathQueue = cleanPath;
  s.lastPosition = startPoint;

  // reset hướng mặc định mỗi lần chạy
  s.lastVector = { dx: 1, dy: 0 };
  s.currentTarget = null;
  s.isNavigating = true;

  sendNextPosition(vehicleId);
};

const setupConnectionEvents = async () => {
  if (!connection) return;

  const onPublish = (topic, payload) => {
    try {
      const decoder = new TextDecoder("utf-8");
      const jsonString = decoder.decode(payload);
      const data = JSON.parse(jsonString);

      // xác định xe theo topic
      let vehicleId = null;
      if (topic === TOPICS.V1.subPos) vehicleId = "V1";
      if (topic === TOPICS.V2.subPos) vehicleId = "V2";
      if (!vehicleId) return;

      if (!data.position) return;

      const rawPos = String(data.position).replace(/\./g, ",");
      const [row, col] = rawPos.split(",").map(Number);

      // Emit đầy đủ để frontend không crash
      emitToFrontend("car:position", {
        vehicle_id: vehicleId,
        device_id: data.device_id || (vehicleId === "V1" ? "01" : "02"),
        position: [row, col],
        status: data.status || "OK",
        timestamp: new Date(),
      });

      const s = sessions[vehicleId];
      if (!s?.isNavigating) return;

      // ACK: nếu xe báo OK và đúng target thì gửi step tiếp
      const ok = (data.status ? data.status === "OK" : true);
      if (ok && s.currentTarget && rawPos === s.currentTarget) {
        console.log(`✓ [ACK ${vehicleId}] Đã đến ${rawPos}. Đi tiếp...`);
        setTimeout(() => sendNextPosition(vehicleId), 100);
      }
    } catch (e) {
      console.error("[onPublish parse error]", e.message);
    }
  };

  const subscribeAll = async () => {
    await connection.subscribe(TOPICS.V1.subPos, mqtt.QoS.AtLeastOnce, onPublish);
    await connection.subscribe(TOPICS.V2.subPos, mqtt.QoS.AtLeastOnce, onPublish);
    console.log(`✓ Subscribed: ${TOPICS.V1.subPos}`);
    console.log(`✓ Subscribed: ${TOPICS.V2.subPos}`);
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
    console.error("AWS IoT connect error:", err?.message || err);
    setTimeout(connectToAwsIot, 5000);
  }
};

module.exports = { connectToAwsIot, startNavigationSequence };
