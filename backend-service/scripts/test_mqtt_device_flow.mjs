#!/usr/bin/env node

/**
 * E2E 测试：模拟项圈通过 MQTT 上报状态与传感器数据，
 * 验证后端 MQTT 处理链路是否正常（不依赖真实硬件）。
 */

import mqtt from 'mqtt';

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const TEST_DEVICE_ID = process.env.TEST_DEVICE_ID || 'PET_MONITOR_001';

const mockSensorPayload = {
  metadata: {
    device_id: TEST_DEVICE_ID,
    session_id: `sess_mqtt_${Date.now()}`,
    timestamp: Date.now(),
    firmware_version: '2.1.0',
    data_interval_seconds: 30,
    upload_reason: 'scheduled_upload'
  },
  raw_sensor_data: {
    vital_signs_samples: [
      {
        timestamp_offset: 0,
        temperature_c: 36.5,
        heart_rate_bpm: 75
      },
      {
        timestamp_offset: 5000,
        temperature_c: 36.6,
        heart_rate_bpm: 76
      }
    ],
    motion_samples: [
      {
        timestamp_offset: 0,
        acceleration: { x: 0.1, y: 0.9, z: 9.8 },
        movement_intensity: 0.2
      }
    ]
  },
  offline_inference: {
    health_assessment: {
      overall_health_score: 8,
      vital_signs_stability: 7,
      abnormalities_detected: [],
      trend_analysis: 'stable'
    },
    behavior_analysis: {
      activity_level: 6,
      mood_state: 7,
      behavior_pattern: 'normal_activity',
      unusual_behavior_detected: false
    },
    media_analysis: {
      audio_events: [],
      video_analysis: []
    }
  },
  summary_statistics: {
    temperature_stats: { mean: 36.55, min: 36.5, max: 36.6 },
    heart_rate_stats: { mean: 75.5, min: 75, max: 76 }
  },
  system_status: {
    battery_level: 80,
    memory_usage_percent: 40,
    storage_available_mb: 256
  }
};

const mockStatusPayload = {
  batteryLevel: 80,
  signalStrength: 90,
  metadata: {
    fw: '2.1.0',
    hw: 'rev-a'
  }
};

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifySessionViaApi() {
  const token = process.env.TEST_TOKEN;
  if (!token) {
    console.log('⚠️  未设置 TEST_TOKEN，跳过会话查询校验（仅依赖日志验证 MQTT 流程）。');
    return;
  }

  const url = `${API_BASE_URL}/hardware/sensor-data/sessions?deviceId=${encodeURIComponent(
    TEST_DEVICE_ID
  )}&limit=1`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ 查询会话失败:', res.status, text);
    return;
  }

  const json = await res.json();
  console.log('✅ 会话查询结果:', JSON.stringify(json, null, 2));
}

async function main() {
  console.log('🚀 MQTT 设备链路 E2E 测试');
  console.log(`📍 MQTT_URL: ${MQTT_URL}`);
  console.log(`📍 API_BASE_URL: ${API_BASE_URL}`);
  console.log(`📍 TEST_DEVICE_ID: ${TEST_DEVICE_ID}\n`);

  const client = mqtt.connect(MQTT_URL, {
    clientId: `hipet-test-device-${Math.random().toString(16).slice(2)}`,
    clean: true
  });

  await new Promise((resolve, reject) => {
    client.once('connect', () => {
      console.log('✅ 已连接到 MQTT Broker');
      resolve();
    });
    client.once('error', (err) => {
      console.error('❌ 连接 MQTT 失败:', err.message);
      reject(err);
    });
  });

  // 1) 上报状态
  const statusTopic = `/device/${TEST_DEVICE_ID}/status`;
  client.publish(statusTopic, JSON.stringify(mockStatusPayload), { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ 发布 status 失败:', err.message);
    } else {
      console.log(`✅ 已发布状态到 ${statusTopic}`);
    }
  });

  // 2) 上报传感器数据
  const sensorTopic = `/device/${TEST_DEVICE_ID}/sensor-data`;
  client.publish(sensorTopic, JSON.stringify(mockSensorPayload), { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ 发布 sensor-data 失败:', err.message);
    } else {
      console.log(`✅ 已发布传感器数据到 ${sensorTopic}`);
    }
  });

  // 等待后端处理
  await delay(2000);

  // 3) 可选：通过 HTTP API 验证是否写入会话
  await verifySessionViaApi();

  client.end(true, () => {
    console.log('\n🎉 MQTT 设备链路测试结束。请结合后端日志确认无错误。');
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ 测试过程中发生错误:', err);
    process.exit(1);
  });
}


