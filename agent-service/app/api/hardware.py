"""
Hardware Data Integration API
Supports real-time sensor data processing and monitoring
"""
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.workflow import workflow_executor, PetHealthState
from app.core.hardware_interface import (
    hardware_receiver, real_time_monitor, anomaly_detector,
    SensorData, VitalSignsAnalysis
)
from app.models.agents import PetProfile


router = APIRouter(prefix="/hardware", tags=["hardware"])


class HardwareDataRequest(BaseModel):
    """Hardware data request"""
    device_id: str
    raw_data: bytes
    pet_id: Optional[str] = None


class BatchDataRequest(BaseModel):
    """Batch data request"""
    device_id: str
    data_list: List[bytes]
    pet_id: Optional[str] = None


class MonitoringRequest(BaseModel):
    """Monitoring request"""
    device_id: str
    pet_id: str
    monitoring_config: Optional[Dict[str, Any]] = None


class SensorDataResponse(BaseModel):
    """Sensor data响应"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str


@router.post("/sensor-data", response_model=SensorDataResponse)
async def receive_sensor_data(request: HardwareDataRequest):
    """接收单个Sensor data"""
    try:
        # 验证数据完整性
        if not await hardware_receiver.validate_data_integrity(request.raw_data):
            raise HTTPException(status_code=400, detail="Data integrity validation failed")
        
        # 解析Sensor data
        sensor_data = await hardware_receiver.receive_sensor_data(
            request.device_id, 
            request.raw_data
        )
        
        # 如果有宠物ID，触发工作流处理
        if request.pet_id:
            # 构建体征分析
            vitals = VitalSignsAnalysis(
                pet_id=request.pet_id,
                timestamp=sensor_data.timestamp,
                heart_rate=sensor_data.processed_data.get("heart_rate"),
                temperature=sensor_data.processed_data.get("temperature"),
                activity_level=sensor_data.processed_data.get("activity_level"),
                stress_level=sensor_data.processed_data.get("stress_level")
            )
            
            # 检测异常
            anomaly_result = await anomaly_detector.detect_anomaly(vitals)
            vitals.anomaly_detected = anomaly_result["anomaly_detected"]
            vitals.risk_level = anomaly_result["risk_level"]
            
            # 如果有异常，触发工作流
            if vitals.anomaly_detected:
                workflow_result = await workflow_executor.execute(
                    user_message=f"检测到异常体征: {anomaly_result['anomalies']}",
                    sensor_data=vitals.model_dump(),
                    pet_profile=None  # 需要从数据库获取
                )
                
                return SensorDataResponse(
                    success=True,
                    data={
                        "sensor_data": sensor_data.model_dump(),
                        "vitals_analysis": vitals.model_dump(),
                        "anomaly_result": anomaly_result,
                        "workflow_result": workflow_result
                    },
                    timestamp=datetime.now().isoformat()
                )
        
        return SensorDataResponse(
            success=True,
            data={
                "sensor_data": sensor_data.model_dump(),
                "message": "Data received successfully"
            },
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        return SensorDataResponse(
            success=False,
            error=str(e),
            timestamp=datetime.now().isoformat()
        )


@router.post("/batch-data", response_model=List[SensorDataResponse])
async def receive_batch_data(request: BatchDataRequest):
    """接收批量Sensor data"""
    try:
        results = []
        
        for raw_data in request.data_list:
            try:
                # 验证数据完整性
                if not await hardware_receiver.validate_data_integrity(raw_data):
                    results.append(SensorDataResponse(
                        success=False,
                        error="Data integrity validation failed",
                        timestamp=datetime.now().isoformat()
                    ))
                    continue
                
                # 解析Sensor data
                sensor_data = await hardware_receiver.receive_sensor_data(
                    request.device_id, 
                    raw_data
                )
                
                results.append(SensorDataResponse(
                    success=True,
                    data=sensor_data.model_dump(),
                    timestamp=datetime.now().isoformat()
                ))
                
            except Exception as e:
                results.append(SensorDataResponse(
                    success=False,
                    error=str(e),
                    timestamp=datetime.now().isoformat()
                ))
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start-monitoring")
async def start_monitoring(request: MonitoringRequest, background_tasks: BackgroundTasks):
    """开始Real-time monitoring"""
    try:
        # 在后台启动监控任务
        background_tasks.add_task(
            real_time_monitor.start_monitoring,
            request.device_id,
            request.pet_id
        )
        
        return {
            "success": True,
            "message": f"开始监控设备 {request.device_id}",
            "device_id": request.device_id,
            "pet_id": request.pet_id,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop-monitoring")
async def stop_monitoring(device_id: str):
    """停止Real-time monitoring"""
    try:
        await real_time_monitor.stop_monitoring(device_id)
        
        return {
            "success": True,
            "message": f"停止监控设备 {device_id}",
            "device_id": device_id,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitoring-status")
async def get_monitoring_status():
    """获取监控状态"""
    try:
        active_devices = list(real_time_monitor.active_monitors.keys())
        
        return {
            "success": True,
            "active_devices": active_devices,
            "monitoring_count": len(active_devices),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream-sensor-data")
async def stream_sensor_data(request: HardwareDataRequest):
    """流式处理Sensor data"""
    try:
        async def generate_stream():
            # 解析Sensor data
            sensor_data = await hardware_receiver.receive_sensor_data(
                request.device_id, 
                request.raw_data
            )
            
            # 发送Sensor data
            yield f"data: {sensor_data.model_dump_json()}\n\n"
            
            # 如果有宠物ID，进行进一步处理
            if request.pet_id:
                # 构建体征分析
                vitals = VitalSignsAnalysis(
                    pet_id=request.pet_id,
                    timestamp=sensor_data.timestamp,
                    heart_rate=sensor_data.processed_data.get("heart_rate"),
                    temperature=sensor_data.processed_data.get("temperature"),
                    activity_level=sensor_data.processed_data.get("activity_level")
                )
                
                # 发送体征分析
                yield f"data: {vitals.model_dump_json()}\n\n"
                
                # 检测异常
                anomaly_result = await anomaly_detector.detect_anomaly(vitals)
                
                # 发送Anomaly detection结果
                yield f"data: {anomaly_result}\n\n"
                
                # 如果有异常，触发工作流
                if anomaly_result["anomaly_detected"]:
                    # Stream execution工作流
                    async for state in workflow_executor.stream_execute(
                        user_message=f"检测到异常体征: {anomaly_result['anomalies']}",
                        sensor_data=vitals.model_dump(),
                        pet_profile=None
                    ):
                        yield f"data: {state}\n\n"
            
            # End stream
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/device-types")
async def get_supported_device_types():
    """获取支持的设备类型"""
    return {
        "supported_types": [
            {
                "type": "heart_rate",
                "description": "心率监测器",
                "data_format": "心率(2字节) + 置信度(1字节) + 电池(1字节)"
            },
            {
                "type": "temperature",
                "description": "体温监测器",
                "data_format": "温度(2字节) + 置信度(1字节) + 电池(1字节)"
            },
            {
                "type": "activity",
                "description": "活动监测器",
                "data_format": "活动量(2字节) + 步数(4字节) + 置信度(1字节) + 电池(1字节)"
            },
            {
                "type": "location",
                "description": "位置追踪器",
                "data_format": "纬度(4字节) + 经度(4字节) + 精度(2字节) + 电池(1字节)"
            },
            {
                "type": "battery",
                "description": "电池状态监测器",
                "data_format": "电池电量(1字节) + 充电状态(1字节) + 温度(2字节)"
            }
        ],
        "data_header_format": "数据类型(4字节) + 时间戳(4字节) + 数据长度(4字节)",
        "timestamp": datetime.now().isoformat()
    }


@router.get("/anomaly-thresholds")
async def get_anomaly_thresholds():
    """获取Anomaly detection阈值"""
    return {
        "thresholds": anomaly_detector.thresholds,
        "description": "当前Anomaly detection阈值配置",
        "timestamp": datetime.now().isoformat()
    }


@router.post("/update-thresholds")
async def update_anomaly_thresholds(thresholds: Dict[str, Dict[str, float]]):
    """更新Anomaly detection阈值"""
    try:
        anomaly_detector.thresholds.update(thresholds)
        
        return {
            "success": True,
            "message": "Threshold updated successfully",
            "updated_thresholds": thresholds,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
