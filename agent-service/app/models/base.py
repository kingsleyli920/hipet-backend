"""
基础数据模型
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class PetProfile(BaseModel):
    """宠物档案"""
    id: Optional[str] = None
    name: Optional[str] = None
    breed: Optional[str] = None
    age: Optional[int] = None  # 月龄
    weight: Optional[float] = None  # 公斤
    gender: Optional[str] = None
    neutered: Optional[bool] = None
    health_conditions: Optional[list] = None
    allergies: Optional[list] = None


class WindowStats(BaseModel):
    """项圈窗口统计数据"""
    timestamp: datetime
    heart_rate: Optional[float] = None
    hrv: Optional[float] = None
    activity_level: Optional[float] = None
    valence: Optional[float] = None  # 价度
    arousal: Optional[float] = None  # 唤醒度
    temperature: Optional[float] = None
    steps: Optional[int] = None


class AgentRequest(BaseModel):
    """Agent 请求基础模型"""
    conversation_summary: Optional[str] = None
    last_user_msg: str
    pet_profile: Optional[PetProfile] = None
    window_stats: Optional[WindowStats] = None
    additional_data: Optional[Dict[str, Any]] = None


class AgentResponse(BaseModel):
    """Agent responses基础模型"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    agent_version: str
    timestamp: datetime



