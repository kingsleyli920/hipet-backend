# 硬件接口文档

## 传感器数据上传

### POST `/hardware/sensor-data`

上传宠物项圈传感器数据。

**请求头**：`Content-Type: application/json`

**请求体**：

```json
{
  "metadata": {
    "device_id": "COLLAR-001-AABBCCDD",  // 设备ID（必填）
    "session_id": "sess_20250122_001",  // 会话ID（必填，唯一）
    "timestamp": 1705900800000,          // 时间戳ms（必填）
    "firmware_version": "2.1.0",         // 固件版本（可选）
    "data_interval_seconds": 30,         // 数据采集间隔秒（可选）
    "upload_reason": "scheduled_upload"  // 上传原因：scheduled_upload/event_triggered/manual（可选）
  },
  "raw_sensor_data": {
    "vital_signs_samples": [             // 生命体征样本数组
      {
        "timestamp_offset": 0,           // 相对时间偏移ms
        "temperature_c": 36.5,            // 体温℃（可选）
        "heart_rate_bpm": 75              // 心率bpm（可选）
      }
    ],
    "motion_samples": [                   // 运动样本数组
      {
        "timestamp_offset": 0,
        "acceleration": {                 // 加速度m/s²
          "x": 0.12,
          "y": 0.98,
          "z": 9.81
        },
        "movement_intensity": 0.15        // 运动强度0-1
      }
    ]
  },
  "offline_inference": {
    "health_assessment": {
      "overall_health_score": 8,          // 健康评分1-10
      "vital_signs_stability": 7,         // 生命体征稳定性1-10
      "abnormalities_detected": [],        // 异常检测列表
      "trend_analysis": "stable"          // 趋势：stable/improving/deteriorating
    },
    "behavior_analysis": {
      "activity_level": 6,                 // 活动水平1-10
      "mood_state": 7,                    // 情绪状态1-10
      "behavior_pattern": "normal_activity", // 行为模式
      "unusual_behavior_detected": false   // 是否检测到异常行为
    },
    "media_analysis": {
      "audio_events": [],                  // 音频事件数组（可选）
      "video_analysis": []                 // 视频分析数组（可选）
    }
  },
  "summary_statistics": {
    "temperature_stats": {
      "mean": 36.5,
      "min": 36.2,
      "max": 36.8
    },
    "heart_rate_stats": {
      "mean": 75,
      "min": 70,
      "max": 80
    }
  },
  "system_status": {
    "battery_level": 85,                  // 电池电量0-100
    "memory_usage_percent": 45,           // 内存使用率0-100
    "storage_available_mb": 1024          // 可用存储MB
  }
}
```

**响应**：

```json
{
  "success": true,
  "message": "Sensor data processed successfully",
  "sessionId": "cmh1tq0vl0002s0l9nosz1jfv",
  "ts": "2025-01-22T10:14:53.106Z"
}
```

**错误响应**：

- `404` - 设备不存在
- `409` - 会话ID已存在
- `400` - 数据格式错误
- `500` - 服务器错误

**注意事项**：
- 设备ID必须在系统中已注册
- 会话ID必须唯一，重复上传相同session_id会返回409
- 上传成功后会自动创建AI分析任务

