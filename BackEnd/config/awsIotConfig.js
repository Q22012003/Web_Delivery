// src/config/awsIotConfig.js
import { mqtt } from "aws-iot-device-sdk-v2";
import { readFileSync } from "fs";

const endpoint = process.env.AWS_IOT_ENDPOINT;
const cert = readFileSync(process.env.AWS_IOT_CERT_PATH);
const key = readFileSync(process.env.AWS_IOT_KEY_PATH);
const ca = readFileSync(process.env.AWS_IOT_CA_PATH);
const clientId = process.env.AWS_IOT_CLIENT_ID;

const config = mqtt.connection.ConfigBuilder.new_mtls_builder_from_path(cert, key, ca);
config.with_endpoint(endpoint);
config.with_client_id(clientId);
config.with_clean_session(true);

export const buildConnection = () => {
  const client = new mqtt.MqttClient();
  return client.new_connection(config);
};