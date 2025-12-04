import type { FastifyInstance } from 'fastify';
import { getMqttClient } from './mqttClient';
import { processSensorData } from './sensorDataProcessor';
import { updateDeviceStatus } from './deviceStatusService';

function extractDeviceId(topic: string): string | null {
  // Expected patterns:
  // /device/<deviceId>/sensor-data
  // /device/<deviceId>/status
  // /device/<deviceId>/ack
  const parts = topic.split('/');
  if (parts.length >= 4 && parts[1] === 'device') {
    return parts[2];
  }
  return null;
}

export function initMqttHandlers(app: FastifyInstance): void {
  const client = getMqttClient();

  client.on('connect', () => {
    // Subscribe to device topics when connected
    client.subscribe(['/device/+/sensor-data', '/device/+/status', '/device/+/ack'], { qos: 1 }, (err) => {
      if (err) {
        app.log.error({ err: err.message }, '[MQTT] subscribe error');
      } else {
        app.log.info('[MQTT] subscribed to device topics');
      }
    });
  });

  client.on('message', async (topic, payload) => {
    const deviceId = extractDeviceId(topic);
    if (!deviceId) {
      app.log.warn({ topic }, '[MQTT] received message on unexpected topic');
      return;
    }

    const payloadString = payload.toString();
    let body: unknown;
    try {
      body = JSON.parse(payloadString);
    } catch (err: any) {
      app.log.error({ topic, err: err?.message, payload: payloadString }, '[MQTT] invalid JSON payload');
      return;
    }

    if (topic.endsWith('/sensor-data')) {
      try {
        await processSensorData(app, body, { authenticatedDeviceId: deviceId });
      } catch (err: any) {
        const status = err?.statusCode || 500;
        app.log.error(
          {
            topic,
            status,
            code: err?.code,
            message: err?.message
          },
          '[MQTT] failed to process sensor data'
        );
      }
      return;
    }

    if (topic.endsWith('/status')) {
      try {
        await updateDeviceStatus(deviceId, body);
      } catch (err: any) {
        const status = err?.statusCode || 500;
        app.log.error(
          {
            topic,
            status,
            code: err?.code,
            message: err?.message
          },
          '[MQTT] failed to update device status'
        );
      }
      return;
    }

    if (topic.endsWith('/ack')) {
      app.log.info({ topic, deviceId, body }, '[MQTT] received device ACK');
      return;
    }
  });
}


