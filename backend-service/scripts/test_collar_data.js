#!/usr/bin/env bun

/**
 * 测试项圈传感器数据接口
 * 这个脚本模拟项圈设备发送传感器数据到后端
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

// 模拟项圈传感器数据
const mockCollarData = {
  "metadata": {
    "device_id": "PET_MONITOR_001",
    "session_id": `sess_${Date.now()}`,
    "timestamp": Date.now(),
    "firmware_version": "2.1.0",
    "data_interval_seconds": 30,
    "upload_reason": "scheduled_upload"
  },
  "raw_sensor_data": {
    "vital_signs_samples": [
      {
        "timestamp_offset": 0,
        "temperature_c": 36.5,
        "heart_rate_bpm": 75
      },
      {
        "timestamp_offset": 5000,
        "temperature_c": 36.6,
        "heart_rate_bpm": 76
      },
      {
        "timestamp_offset": 10000,
        "temperature_c": 36.4,
        "heart_rate_bpm": 74
      },
      {
        "timestamp_offset": 15000,
        "temperature_c": 36.7,
        "heart_rate_bpm": 78
      },
      {
        "timestamp_offset": 20000,
        "temperature_c": 36.5,
        "heart_rate_bpm": 75
      }
    ],
    "motion_samples": [
      {
        "timestamp_offset": 0,
        "acceleration": {
          "x": 0.12,
          "y": 0.98,
          "z": 9.81
        },
        "movement_intensity": 0.15
      },
      {
        "timestamp_offset": 1000,
        "acceleration": {
          "x": 1.25,
          "y": 2.34,
          "z": 10.12
        },
        "movement_intensity": 0.45
      }
    ]
  },
  "offline_inference": {
    "health_assessment": {
      "overall_health_score": 8,
      "vital_signs_stability": 7,
      "abnormalities_detected": ["slight_tachycardia"],
      "trend_analysis": "stable"
    },
    "behavior_analysis": {
      "activity_level": 6,
      "mood_state": 7,
      "behavior_pattern": "normal_activity",
      "unusual_behavior_detected": false
    },
    "media_analysis": {
      "audio_events": [
        {
          "timestamp_offset": 5000,
          "event_type": "barking",
          "duration_ms": 1200,
          "emotional_tone": "excited"
        },
        {
          "timestamp_offset": 12000,
          "event_type": "whining",
          "duration_ms": 800,
          "emotional_tone": "anxious"
        }
      ],
      "video_analysis": [
        {
          "timestamp_offset": 0,
          "movement_type": "walking",
          "environment_changes": "none"
        },
        {
          "timestamp_offset": 10000,
          "movement_type": "still",
          "environment_changes": "human_entered"
        }
      ]
    }
  },
  "summary_statistics": {
    "temperature_stats": {
      "mean": 36.54,
      "min": 36.4,
      "max": 36.7
    },
    "heart_rate_stats": {
      "mean": 75.6,
      "min": 74,
      "max": 78
    }
  },
  "system_status": {
    "battery_level": 78,
    "memory_usage_percent": 45,
    "storage_available_mb": 256
  }
};

async function testCollarDataAPI() {
  console.log('🧪 开始测试项圈传感器数据接口...\n');

  try {
    // 1. 测试发送传感器数据
    console.log('1️⃣ 发送传感器数据到 /hardware/sensor-data');
    const sensorResponse = await fetch(`${API_BASE_URL}/hardware/sensor-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mockCollarData)
    });

    if (!sensorResponse.ok) {
      const errorText = await sensorResponse.text();
      console.error('❌ 发送传感器数据失败:', sensorResponse.status, errorText);
      return;
    }

    const sensorResult = await sensorResponse.json();
    console.log('✅ 传感器数据发送成功:', sensorResult);
    console.log('');

    // 2. 测试获取监控状态
    console.log('2️⃣ 获取设备监控状态');
    const statusResponse = await fetch(`${API_BASE_URL}/hardware/monitoring-status`);
    
    if (!statusResponse.ok) {
      console.error('❌ 获取监控状态失败:', statusResponse.status);
      return;
    }

    const statusResult = await statusResponse.json();
    console.log('✅ 监控状态获取成功:', statusResult);
    console.log('');

    // 3. 测试获取设备类型
    console.log('3️⃣ 获取支持的设备类型');
    const typesResponse = await fetch(`${API_BASE_URL}/hardware/device-types`);
    
    if (!typesResponse.ok) {
      console.error('❌ 获取设备类型失败:', typesResponse.status);
      return;
    }

    const typesResult = await typesResponse.json();
    console.log('✅ 设备类型获取成功:', typesResult);
    console.log('');

    // 4. 测试获取异常阈值
    console.log('4️⃣ 获取异常阈值配置');
    const thresholdsResponse = await fetch(`${API_BASE_URL}/hardware/anomaly-thresholds`);
    
    if (!thresholdsResponse.ok) {
      console.error('❌ 获取异常阈值失败:', thresholdsResponse.status);
      return;
    }

    const thresholdsResult = await thresholdsResponse.json();
    console.log('✅ 异常阈值获取成功:', thresholdsResult);
    console.log('');

    console.log('🎉 所有测试通过！项圈传感器数据接口工作正常。');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

async function testWithAuth() {
  console.log('🔐 测试需要认证的接口...\n');

  // 这里需要先注册用户和登录获取token
  // 由于这是测试脚本，我们假设已经有有效的token
  const testToken = process.env.TEST_TOKEN;
  
  if (!testToken) {
    console.log('⚠️  未提供TEST_TOKEN环境变量，跳过需要认证的测试');
    return;
  }

  try {
    // 测试获取传感器数据会话
    console.log('1️⃣ 获取传感器数据会话');
    const sessionsResponse = await fetch(`${API_BASE_URL}/sensor-data/sessions?limit=10`, {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });

    if (!sessionsResponse.ok) {
      console.error('❌ 获取传感器数据会话失败:', sessionsResponse.status);
      return;
    }

    const sessionsResult = await sessionsResponse.json();
    console.log('✅ 传感器数据会话获取成功:', sessionsResult);
    console.log('');

    // 测试获取健康警报
    console.log('2️⃣ 获取健康警报');
    const alertsResponse = await fetch(`${API_BASE_URL}/health-alerts?limit=10`, {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });

    if (!alertsResponse.ok) {
      console.error('❌ 获取健康警报失败:', alertsResponse.status);
      return;
    }

    const alertsResult = await alertsResponse.json();
    console.log('✅ 健康警报获取成功:', alertsResult);
    console.log('');

    console.log('🎉 认证接口测试通过！');

  } catch (error) {
    console.error('❌ 认证测试过程中发生错误:', error.message);
  }
}

// 主函数
async function main() {
  console.log('🚀 HiPet 项圈传感器数据接口测试\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}\n`);

  // 测试不需要认证的接口
  await testCollarDataAPI();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 测试需要认证的接口
  await testWithAuth();
}

// 运行测试
if (import.meta.main) {
  main().catch(console.error);
}
