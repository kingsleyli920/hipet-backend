# 硬件接口集成 TODO

## 概述
后端已实现设备 Token 认证系统，等待硬件端集成。

## 已完成的工作

### 1. 数据库 Schema
- ✅ `Device` 表已添加 `deviceToken` 和 `deviceTokenExpiresAt` 字段
- ✅ Token 在设备创建/绑定时自动生成

### 2. 后端接口
- ✅ `POST /devices/bind` - 设备绑定，返回 `deviceToken`
- ✅ `GET /devices/:deviceId/token` - 获取设备 token
- ✅ `POST /devices/:deviceId/token/reset` - 重置设备 token
- ✅ `POST /hardware/sensor-data` - 传感器数据上传接口（已支持设备 token 认证）

### 3. 认证中间件
- ✅ `authenticateDevice` - 设备 token 认证中间件
- ✅ 支持验证设备 token、检查过期时间、验证设备状态

## 待硬件端集成

### 1. 设备绑定流程
硬件设备需要：
1. 在用户绑定设备时，从 `POST /devices/bind` 响应中获取 `deviceToken`
2. 将 `deviceToken` 安全存储到硬件设备（建议加密存储）
3. 后续所有数据上传请求都使用此 token

**接口示例：**
```bash
POST /devices/bind
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "deviceId": "CAMERA-001-EEFF1122",
  "petId": "pet_id_here",
  "bindingType": "owner"
}

# 响应包含 deviceToken
{
  "message": "Device bound successfully",
  "binding": {...},
  "deviceToken": "64位随机token字符串"
}
```

### 2. 传感器数据上传
硬件设备需要：
1. 使用 `deviceToken` 作为 Authorization header
2. 按照现有接口格式上传数据

**接口示例：**
```bash
POST /hardware/sensor-data
Authorization: Bearer <deviceToken>
Content-Type: application/json

{
  "metadata": {
    "device_id": "CAMERA-001-EEFF1122",
    "session_id": "session_123",
    "timestamp": 1234567890,
    ...
  },
  "raw_sensor_data": {...},
  "offline_inference": {...},
  "summary_statistics": {...},
  "system_status": {...}
}
```

### 3. Token 管理
如果设备 token 泄露或需要重置：
- 用户可以通过 `POST /devices/:deviceId/token/reset` 重置 token
- 硬件设备需要重新获取新的 token 并更新本地存储

## 注意事项

1. **Token 安全**
   - `deviceToken` 是长期有效的（默认永不过期）
   - 硬件设备应加密存储 token
   - 如果 token 泄露，立即通过重置接口更换

2. **Token 过期**
   - 目前 token 默认永不过期（`deviceTokenExpiresAt: null`）
   - 如需设置过期时间，可在设备创建/绑定时指定

3. **设备状态**
   - 只有 `status: 'active'` 的设备才能使用 token 上传数据
   - 设备解绑后，token 仍然有效，但设备状态会变为 `inactive`

4. **认证方式**
   - 硬件接口支持两种认证方式：
     - 设备 token（推荐）：`Authorization: Bearer <deviceToken>`
     - 用户 token（备用）：`Authorization: Bearer <userAccessToken>`

## 测试建议

1. 测试设备绑定流程，确认能正确获取 `deviceToken`
2. 测试使用 `deviceToken` 上传传感器数据
3. 测试 token 重置后，旧 token 失效，新 token 可用
4. 测试设备解绑后，token 是否仍然可用（根据业务需求决定）

## 相关文件

- `src/routes/devices.ts` - 设备管理路由
- `src/routes/hardware.ts` - 硬件数据接收路由
- `src/middleware/auth.ts` - 认证中间件（包含设备认证）
- `prisma/schema.prisma` - 数据库 Schema

