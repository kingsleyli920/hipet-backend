"""
Sensor Analysis API - Direct analysis endpoint
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.sensor_analysis import SensorDataAnalysisAgent
from app.models.agents import SensorAnalysisRequest, SensorAnalysisResponse, PetProfile


router = APIRouter(prefix="/analyze", tags=["analyze"]) 

agent = SensorDataAnalysisAgent()


class DirectSensorAnalysisRequest(BaseModel):
    payload_json: Dict[str, Any]
    pet_profile: Optional[PetProfile] = None
    language: Optional[str] = None
    options: Optional[Dict[str, Any]] = None


@router.post("/sensor-data", response_model=SensorAnalysisResponse)
async def analyze_sensor_data(request: DirectSensorAnalysisRequest):
    try:
        analysis_request = SensorAnalysisRequest(
            payload_json=request.payload_json,
            pet_profile=request.pet_profile,
            language=request.language,
            options=request.options
        )

        result = await agent.process(analysis_request, language=request.language)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sensor analysis failed: {str(e)}")


