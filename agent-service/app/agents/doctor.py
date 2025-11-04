"""
Doctor Agent 实现
Health Advisor·Education/Triage
"""
from typing import Dict, Any
from loguru import logger

from app.agents.base import BaseAgent
from app.models.agents import DoctorRequest, DoctorResponse
from app.prompts.doctor import (
    get_doctor_system_prompt,
    get_doctor_developer_prompt,
    format_doctor_user_input,
    get_doctor_fallback_prompt
)


class DoctorAgent(BaseAgent):
    """Doctor Agent - Health Advisor·Education/Triage"""
    
    async def process(self, request: DoctorRequest, language: str = None) -> DoctorResponse:
        """
        处理 Doctor 请求
        
        Args:
            request: Doctor 请求数据
            
        Returns:
            Doctor 响应数据
        """
        try:
            system_prompt = f"{get_doctor_system_prompt()}\n\n{get_doctor_developer_prompt()}"
            
            user_data = {
                "conversation_summary": request.conversation_summary or "",
                "last_user_msg": request.last_user_msg,
                "window_stats": request.window_stats.dict() if request.window_stats else {},
                "pet_profile": request.pet_profile.dict() if request.pet_profile else {}
            }
            user_input = format_doctor_user_input(user_data)
            
            result = await self._call_llm(system_prompt, user_input, temperature=0.5, language=language)
            
            required_fields = ["assessment", "risk_level", "watchouts", "next_actions", "when_to_see_vet"]
            if not self._validate_response(result, required_fields):
                raise Exception("Invalid LLM response format")
            
            valid_risk_levels = ["low", "medium", "high"]
            if result["risk_level"] not in valid_risk_levels:
                logger.warning(f"Invalid risk_level: {result['risk_level']}, defaulting to 'medium'")
                result["risk_level"] = "medium"
            
            if "safety_note" not in result or not result["safety_note"]:
                result["safety_note"] = "Please consult a professional veterinarian for medical advice."
            
            logger.info(f"Doctor assessment completed with risk level: {result['risk_level']}")
            
            return DoctorResponse(**result)
            
        except Exception as e:
            logger.error(f"Doctor Agent processing error: {str(e)}")
            return await self._generate_fallback_response(request, language)
    
    async def _generate_fallback_response(self, request: DoctorRequest, language: str = None) -> DoctorResponse:
        try:
            fallback_prompt = get_doctor_fallback_prompt(
                request.last_user_msg,
                request.pet_profile.dict() if request.pet_profile else {},
                request.window_stats.dict() if request.window_stats else {}
            )
            
            result = await self._call_llm(fallback_prompt, "", temperature=0.3, language=language)
            
            return DoctorResponse(**result)
            
        except Exception as fallback_error:
            logger.error(f"Fallback response generation failed: {fallback_error}")
            return DoctorResponse(
                assessment="Please provide more details about your pet's health concern",
                risk_level="medium",
                watchouts=["Monitor symptoms closely"],
                next_actions=["Contact a veterinarian for professional advice"],
                when_to_see_vet="If symptoms persist or worsen, seek veterinary care immediately",
                handoff=None,
                safety_note="Please consult a professional veterinarian for medical advice"
            )



