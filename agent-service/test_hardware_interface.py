#!/usr/bin/env python3
"""
测试硬件数据接入接口
"""
import asyncio
import struct
import httpx
from datetime import datetime


def create_mock_sensor_data(data_type: str, value: float) -> bytes:
    """创建模拟Sensor data"""
    timestamp = int(datetime.now().timestamp())
    
    if data_type == "heart_rate":
        # 心率数据: [心率(2字节)] [置信度(1字节)] [电池(1字节)]
        payload = struct.pack('HBB', int(value), 95, 80)
    elif data_type == "temperature":
        # 温度数据: [温度(2字节)] [置信度(1字节)] [电池(1字节)]
        payload = struct.pack('HBB', int(value * 100), 90, 75)
    elif data_type == "activity":
        # 活动数据: [活动量(2字节)] [步数(4字节)] [置信度(1字节)] [电池(1字节)]
        payload = struct.pack('HIBB', int(value * 100), 1500, 85, 70)
    else:
        payload = b'\x00' * 4
    
    # 数据头: [数据类型(4字节)] [时间戳(4字节)] [数据长度(4字节)]
    header = struct.pack('4sII', data_type.encode('utf-8'), timestamp, len(payload))
    
    return header + payload


async def test_sensor_data_api():
    """测试Sensor dataAPI"""
    print("🧪 测试硬件数据接入接口")
    print("=" * 60)
    
    # 创建模拟数据
    test_cases = [
        ("heart_rate", 120.0, "正常心率"),
        ("heart_rate", 200.0, "异常高心率"),
        ("temperature", 38.5, "正常体温"),
        ("temperature", 41.0, "异常高体温"),
        ("activity", 0.8, "高活动量"),
        ("activity", 0.05, "低活动量"),
    ]
    
    async with httpx.AsyncClient() as client:
        for data_type, value, description in test_cases:
            print(f"\n📊 测试 {data_type}: {description} (值: {value})")
            
            # 创建模拟数据
            raw_data = create_mock_sensor_data(data_type, value)
            
            # 发送请求
            try:
                response = await client.post(
                    "http://localhost:8001/hardware/sensor-data",
                    json={
                        "device_id": "test_device_001",
                        "raw_data": raw_data.hex(),  # 转换为十六进制字符串
                        "pet_id": "pet_001"
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"   ✅ 成功: {result['success']}")
                    if result.get('data'):
                        sensor_data = result['data'].get('sensor_data', {})
                        print(f"   📈 解析数据: {sensor_data.get('processed_data', {})}")
                        
                        if 'anomaly_result' in result['data']:
                            anomaly = result['data']['anomaly_result']
                            print(f"   ⚠️  Anomaly detection: {anomaly['anomaly_detected']}")
                            if anomaly['anomaly_detected']:
                                print(f"   🚨 风险等级: {anomaly['risk_level']}")
                else:
                    print(f"   ❌ 失败: {response.status_code} - {response.text}")
                    
            except Exception as e:
                print(f"   ❌ 异常: {e}")


async def test_monitoring_api():
    """测试监控API"""
    print(f"\n🔍 测试监控API")
    print("-" * 40)
    
    async with httpx.AsyncClient() as client:
        # 开始监控
        try:
            response = await client.post(
                "http://localhost:8001/hardware/start-monitoring",
                json={
                    "device_id": "test_device_001",
                    "pet_id": "pet_001",
                    "monitoring_config": {
                        "check_interval": 5,
                        "anomaly_threshold": 0.8
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ 开始监控: {result['message']}")
            else:
                print(f"   ❌ 开始监控失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 开始监控异常: {e}")
        
        # 检查监控状态
        try:
            response = await client.get("http://localhost:8001/hardware/monitoring-status")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   📊 监控状态: {result['monitoring_count']} 个设备")
                print(f"   📱 活跃设备: {result['active_devices']}")
            else:
                print(f"   ❌ 获取监控状态失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 获取监控状态异常: {e}")
        
        # 停止监控
        try:
            response = await client.post(
                "http://localhost:8001/hardware/stop-monitoring",
                params={"device_id": "test_device_001"}
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ 停止监控: {result['message']}")
            else:
                print(f"   ❌ 停止监控失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 停止监控异常: {e}")


async def test_device_info_api():
    """测试设备信息API"""
    print(f"\n📱 测试设备信息API")
    print("-" * 40)
    
    async with httpx.AsyncClient() as client:
        # 获取支持的设备类型
        try:
            response = await client.get("http://localhost:8001/hardware/device-types")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   📋 支持的设备类型:")
                for device_type in result['supported_types']:
                    print(f"      - {device_type['type']}: {device_type['description']}")
            else:
                print(f"   ❌ 获取设备类型失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 获取设备类型异常: {e}")
        
        # 获取Anomaly detection阈值
        try:
            response = await client.get("http://localhost:8001/hardware/anomaly-thresholds")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ⚙️  Anomaly detection阈值:")
                for key, value in result['thresholds'].items():
                    print(f"      - {key}: {value}")
            else:
                print(f"   ❌ 获取阈值失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 获取阈值异常: {e}")


async def main():
    """主函数"""
    print("🚀 HiPet 硬件数据接入接口测试")
    print("=" * 60)
    print("请确保 agent-service 正在运行 (python main.py)")
    print("服务地址: http://localhost:8001")
    print("=" * 60)
    
    # 测试Sensor dataAPI
    await test_sensor_data_api()
    
    # 测试监控API
    await test_monitoring_api()
    
    # 测试设备信息API
    await test_device_info_api()
    
    print(f"\n🎉 硬件接口测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
