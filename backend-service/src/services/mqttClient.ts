import mqtt, { MqttClient } from 'mqtt';

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

let client: MqttClient | null = null;

export function getMqttClient(): MqttClient {
  if (client) return client;

  const options: mqtt.IClientOptions = {
    clientId: `hipet-backend-${Math.random().toString(16).slice(2)}`,
    clean: true,
  };

  if (MQTT_USERNAME) {
    options.username = MQTT_USERNAME;
  }
  if (MQTT_PASSWORD) {
    options.password = MQTT_PASSWORD;
  }

  client = mqtt.connect(MQTT_URL, options);

  client.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('[MQTT] connected to broker', MQTT_URL);
  });

  client.on('reconnect', () => {
    // eslint-disable-next-line no-console
    console.log('[MQTT] reconnecting to broker', MQTT_URL);
  });

  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[MQTT] error', err.message);
  });

  client.on('close', () => {
    // eslint-disable-next-line no-console
    console.log('[MQTT] connection closed');
  });

  return client;
}

export function publishCommand(deviceId: string, payload: any): void {
  const cli = getMqttClient();
  const topic = `/device/${deviceId}/cmd`;
  cli.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[MQTT] publish command error', { topic, err: err.message });
    }
  });
}


