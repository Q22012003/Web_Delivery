// config/awsIotConfig.js - CHUẨN CHO aws-iot-device-sdk-v2 v1.18+ (bao gồm v1.23.1)
const { mqtt, io, iot } = require("aws-iot-device-sdk-v2");  // ← Destructuring đúng!
const fs = require("fs");
require("dotenv").config();

const endpoint = process.env.AWS_IOT_ENDPOINT;
const cert = fs.readFileSync(process.env.AWS_IOT_CERT_PATH, "utf8");  // utf8 thay vì "utf-8"
const key = fs.readFileSync(process.env.AWS_IOT_KEY_PATH, "utf8");
const ca = fs.readFileSync(process.env.AWS_IOT_CA_PATH, "utf8");
const clientId = process.env.AWS_IOT_CLIENT_ID || "backend_controller_01";

const buildConnection = async () => {
  // Tạo bootstrap (từ module io)
  const client_bootstrap = new io.ClientBootstrap();

  // Builder đúng: new_mtls_builder cho strings (cert, key)
  const config_builder = iot.AwsIotMqttConnectionConfigBuilder
    .new_mtls_builder(cert, key)  // ← Dùng strings trực tiếp
    .with_certificate_authority_from_path(process.env.AWS_IOT_CA_PATH)  // CA từ path (hoặc .with_certificate_authority(ca) nếu string)
    .with_endpoint(endpoint)
    .with_client_id(clientId)
    .with_clean_session(false)
    .with_keep_alive_seconds(30)  // Tùy chọn: Giữ kết nối ổn định
    .with_port(8883);  // Port mặc định cho MQTT over TLS

  const client = new mqtt.MqttClient(client_bootstrap);  // ← Truyền bootstrap vào constructor
  const config = config_builder.build();
  const connection = client.new_connection(config);

  return connection;
};

module.exports = { buildConnection };