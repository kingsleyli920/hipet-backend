"""
各个 Agent 的专用数据模型
"""
from pydantic import BaseModel
from typing import Optional, List, Literal, Dict, Any
from .base import PetProfile, WindowStats


# Router Agent Models
class RouterRequest(BaseModel):
    conversation_summary: Optional[str] = None
    last_user_msg: str
    pet_profile: Optional[PetProfile] = None


class RouterResponse(BaseModel):
    next: Literal["router", "doctor", "nutritionist", "trainer", "faq", "avatar"]
    reason: str
    confidence: float
    response_preview: str
    transfer_message: Optional[str] = None  # Dynamic transfer message based on user language
    needs_pet_status: bool = False  # Whether this query needs latest pet status from database


# Doctor Agent Models
class DoctorRequest(BaseModel):
    conversation_summary: Optional[str] = None
    last_user_msg: str
    window_stats: Optional[WindowStats] = None
    pet_profile: Optional[PetProfile] = None


class DoctorResponse(BaseModel):
    assessment: str
    risk_level: Literal["low", "medium", "high"]
    watchouts: List[str]
    next_actions: List[str]
    when_to_see_vet: str
    handoff: Optional[str] = None
    safety_note: str = ""


# Nutritionist Agent Models
class NutritionistRequest(BaseModel):
    conversation_summary: Optional[str] = None
    last_user_msg: str
    pet_profile: Optional[PetProfile] = None
    diet_history: Optional[dict] = None


class NutritionistResponse(BaseModel):
    summary: str
    meal_plan: List[str]
    avoid_list: List[str]
    tips: List[str]
    handoff: Optional[str] = None
    safety_note: str = ""


# Trainer Agent Models
class TrainerRequest(BaseModel):
    conversation_summary: Optional[str] = None
    last_user_msg: str
    pet_profile: Optional[PetProfile] = None
    recent_activity: Optional[dict] = None


class TrainerResponse(BaseModel):
    plan: List[str]
    exercise: List[str]
    env_setup: List[str]
    warnings: List[str]
    handoff: Optional[str] = None


# ExplainData Agent Models
class ExplainDataRequest(BaseModel):
    window_stats: WindowStats
    pet_profile: Optional[PetProfile] = None


class ExplainDataResponse(BaseModel):
    mood: str
    insights: List[str]
    watchouts: List[str]
    nextAction: List[str]
    confidence: float
    safety_note: str = ""


# SimpleFAQ Agent Models
class SimpleFAQRequest(BaseModel):
    last_user_msg: str


class SimpleFAQResponse(BaseModel):
    answer: str
    source: Literal["builtin", "generic", "常识", "General knowledge", "general", "通用知识"]
    handoff: Optional[str] = None
    safety_note: Optional[str] = None


# Avatar Agent Models
class AvatarRequest(BaseModel):
    last_user_msg: str
    pet_photo_uploaded: bool
    style_catalog: Optional[dict] = None


class AvatarResponse(BaseModel):
    style: str
    quality: Literal["standard", "hd"]
    notes: str
    ok_to_generate: bool
    handoff: Optional[str] = None


# Sensor Analysis Agent Models
class SensorAnalysisRequest(BaseModel):
    payload_json: Dict[str, Any]
    pet_profile: Optional[PetProfile] = None
    language: Optional[str] = None
    options: Optional[Dict[str, Any]] = None  # e.g., { conservative_fill: bool, max_penalty: float }


class SensorAnalysisResponse(BaseModel):
    success: bool
    version: str
    metrics: Dict[str, Any]
    metricsMeta: Optional[Dict[str, Any]] = None
    insights: Dict[str, List[str]]
    confidence: float
    safety_note: str


