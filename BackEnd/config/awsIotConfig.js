// src/config/awsIotConfig.js
import { iot } from "aws-iot-device-sdk-v2"; // Sửa: import iot thay vì mqtt trực tiếp
import { readFileSync } from "fs";

const endpoint = process.env.AWS_IOT_ENDPOINT;
const cert = readFileSync(process.env.AWS_IOT_CERT_PATH, 'utf-8'); // Thêm 'utf-8' để đọc string
const key = readFileSync(process.env.AWS_IOT_KEY_PATH, 'utf-8');
const ca = readFileSync(process.env.AWS_IOT_CA_PATH, 'utf-8');
const clientId = process.env.AWS_IOT_CLIENT_ID;

export const buildConnection = () => {
  const builder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder(cert, key);
  builder.with_certificate_authority(ca);
  builder.with_endpoint(endpoint);
  builder.with_client_id(clientId);
  builder.with_clean_session(true);

  const config = builder.build();
  const client = new iot.MqttClient();
  return client.new_connection(config);
};