# 项圈传感器数据API文档

## 概述

本文档描述了HiPet后端服务中项圈传感器数据相关的API接口。这些接口用于接收、存储和查询智能项圈设备发送的传感器数据。

## 数据库模型

### 新增的数据表

1. **SensorDataSession** - 传感器数据会话
2. **VitalSignsSample** - 生命体征样本数据
3. **MotionSample** - 运动样本数据
4. **HealthAssessment** - 健康评估结果
5. **BehaviorAnalysis** - 行为分析结果
6. **MediaAnalysis** - 媒体分析结果
7. **AudioEvent** - 音频事件
8. **VideoEvent** - 视频事件
9. **SummaryStatistics** - 统计摘要
10. **SystemStatus** - 系统状态
11. **HealthAlert** - 健康警报

## API接口

### 1. 硬件数据接收接口

#### POST /hardware/sensor-data

接收项圈设备发送的传感器数据。

**请求体示例：**
```json
{
  "metadata": {
    "device_id": "PET_MONITOR_001",
    "session_id": "sess_20240715143000",
    "timestamp": 1720256789000,
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
        }
      ],
      "video_analysis": [
        {
          "timestamp_offset": 0,
          "movement_type": "walking",
          "environment_changes": "none"
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
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "Sensor data processed successfully",
  "sessionId": "clx1234567890",
  "ts": "2024-01-15T10:30:00.000Z"
}
```

#### GET /hardware/monitoring-status

获取当前监控状态。

**响应示例：**
```json
{
  "success": true,
  "active_devices": [
    {
      "deviceId": "PET_MONITOR_001",
      "deviceType": "collar",
      "status": "active",
      "batteryLevel": 78,
      "lastOnlineAt": "2024-01-15T10:30:00.000Z",
      "boundPets": [
        {
          "petId": "pet_123",
          "petName": "Gold Bro"
        }
      ]
    }
  ],
  "monitoring_count": 1,
  "ts": "2024-01-15T10:30:00.000Z"
}
```

#### GET /hardware/device-types

获取支持的设备类型。

#### GET /hardware/anomaly-thresholds

获取异常检测阈值配置。

### 2. 传感器数据查询接口

#### GET /sensor-data/sessions

获取传感器数据会话列表。

**查询参数：**
- `petId` (可选): 宠物ID
- `deviceId` (可选): 设备ID
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期
- `limit` (可选): 限制数量，默认50
- `offset` (可选): 偏移量，默认0

**需要认证：** 是

#### GET /sensor-data/sessions/:sessionId

获取单个传感器数据会话详情。

**需要认证：** 是

#### GET /sensor-data/vital-signs

获取生命体征样本数据。

**查询参数：**
- `sessionId` (可选): 会话ID
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期
- `limit` (可选): 限制数量，默认100
- `offset` (可选): 偏移量，默认0

**需要认证：** 是

#### GET /sensor-data/motion

获取运动样本数据。

**查询参数：** 同生命体征接口

**需要认证：** 是

#### GET /sensor-data/stats/health

获取健康数据统计。

**查询参数：**
- `petId` (可选): 宠物ID
- `deviceId` (可选): 设备ID
- `days` (可选): 统计天数，默认7天

**需要认证：** 是

### 3. 健康警报接口

#### GET /health-alerts

获取健康警报列表。

**查询参数：**
- `petId` (可选): 宠物ID
- `deviceId` (可选): 设备ID
- `alertType` (可选): 警报类型
- `severity` (可选): 严重程度
- `isRead` (可选): 是否已读
- `isResolved` (可选): 是否已解决
- `limit` (可选): 限制数量，默认50
- `offset` (可选): 偏移量，默认0

**需要认证：** 是

#### GET /health-alerts/:alertId

获取单个健康警报详情。

**需要认证：** 是

#### POST /health-alerts

创建健康警报。

**需要认证：** 是

#### PATCH /health-alerts/:alertId/read

标记警报为已读。

**需要认证：** 是

#### PATCH /health-alerts/:alertId/resolve

解决警报。

**需要认证：** 是

#### DELETE /health-alerts/:alertId

删除警报。

**需要认证：** 是

#### GET /health-alerts/stats/overview

获取警报统计概览。

**需要认证：** 是

## 异常检测规则

系统会自动检测以下异常情况并创建健康警报：

### 体温异常
- 正常范围：36.0°C - 39.5°C
- 警告范围：35.0°C - 40.0°C
- 严重异常：< 34.0°C 或 > 41.0°C

### 心率异常
- 正常范围：60 - 120 BPM
- 警告范围：50 - 140 BPM
- 严重异常：< 40 BPM 或 > 160 BPM

### 健康评分异常
- 低评分：< 5/10
- 严重低评分：< 3/10

### 异常行为
- 检测到异常行为模式时创建警报

### 设备电量
- 低电量警告：< 20%
- 严重低电量：< 10%

## 测试

运行测试脚本：

```bash
# 设置环境变量（可选）
export API_BASE_URL=http://localhost:8000
export TEST_TOKEN=your_jwt_token_here

# 运行测试
bun run scripts/test_collar_data.js
```

## 部署注意事项

1. **数据库迁移**：部署前需要运行数据库迁移以创建新的数据表
2. **环境变量**：确保所有必要的环境变量已正确配置
3. **权限设置**：确保数据库用户有创建新表的权限
4. **监控**：建议监控传感器数据接收频率和存储使用情况

## 性能优化建议

1. **数据分区**：考虑按时间分区存储传感器数据
2. **索引优化**：为常用查询字段添加适当的数据库索引
3. **数据清理**：定期清理过期的传感器数据
4. **缓存策略**：对频繁查询的统计数据实施缓存

## 安全考虑

1. **设备认证**：建议为设备添加认证机制
2. **数据加密**：敏感的健康数据应考虑加密存储
3. **访问控制**：确保用户只能访问自己宠物的数据
4. **审计日志**：记录所有数据访问和修改操作
