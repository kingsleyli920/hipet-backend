"""
健康检查路由
"""
from fastapi import APIRouter
from datetime import datetime
from config import settings

router = APIRouter()


@router.get("/")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "service": "HiPet Agent Service",
        "version": "1.0.0",
        "agent_version": settings.agent_version,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/ready")
async def readiness_check():
    """就绪检查端点"""
    return {
        "status": "ready",
        "llm_model": settings.llm_model,
        "timestamp": datetime.now().isoformat()
    }



