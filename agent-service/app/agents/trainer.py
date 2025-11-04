"""
Trainer Agent 实现
Training/Behavior Advisor
"""
from typing import Dict, Any
from loguru import logger

from app.agents.base import BaseAgent
from app.models.agents import TrainerRequest, TrainerResponse
from app.prompts.trainer import (
    get_trainer_system_prompt,
    get_trainer_developer_prompt,
    format_trainer_user_input,
    get_trainer_fallback_prompt
)


class TrainerAgent(BaseAgent):
    """Trainer Agent - Training/Behavior Advisor"""
    
    async def process(self, request: TrainerRequest, language: str = None) -> TrainerResponse:
        """
        处理 Trainer 请求
        
        Args:
            request: Trainer 请求数据
            
        Returns:
            Trainer 响应数据
        """
        try:
            system_prompt = f"{get_trainer_system_prompt()}\n\n{get_trainer_developer_prompt()}"
            
            user_data = {
                "conversation_summary": request.conversation_summary or "",
                "last_user_msg": request.last_user_msg,
                "pet_profile": request.pet_profile.dict() if request.pet_profile else {},
                "recent_activity": request.recent_activity or {}
            }
            user_input = format_trainer_user_input(user_data)
            
            result = await self._call_llm(system_prompt, user_input, temperature=0.5, language=language)
            
            result = self._fix_response_format(result)
            
            required_fields = ["plan", "exercise", "env_setup", "warnings"]
            if not self._validate_response(result, required_fields):
                raise Exception("Invalid LLM response format")
            
            logger.info("Trainer consultation completed successfully")
            
            return TrainerResponse(**result)
            
        except Exception as e:
            logger.error(f"Trainer Agent processing error: {str(e)}")
            return await self._generate_fallback_response(request, language)
    
    def _fix_response_format(self, result: Dict[str, Any]) -> Dict[str, Any]:
        if "warnings" in result:
            warnings = result["warnings"]
            if isinstance(warnings, dict):
                if isinstance(warnings, dict) and len(warnings) > 0:
                    result["warnings"] = list(warnings.values())
                else:
                    result["warnings"] = []
            elif not isinstance(warnings, list):
                if warnings:
                    result["warnings"] = [str(warnings)]
                else:
                    result["warnings"] = []
        
        for field in ["plan", "exercise", "env_setup"]:
            if field in result and not isinstance(result[field], list):
                if isinstance(result[field], dict):
                    result[field] = list(result[field].values())
                else:
                    result[field] = [str(result[field])] if result[field] else []
        
        return result
    
    async def _generate_fallback_response(self, request: TrainerRequest, language: str = None) -> TrainerResponse:
        """
        生成 fallback 响应，让 LLM 处理所有内容
        
        Args:
            request: 原始请求
            language: 语言代码
            
        Returns:
            Trainer 响应
        """
        try:
            fallback_prompt = get_trainer_fallback_prompt(
                request.last_user_msg,
                request.pet_profile.dict() if request.pet_profile else {}
            )
            
            result = await self._call_llm(fallback_prompt, "", temperature=0.3, language=language)
            
            result = self._fix_response_format(result)
            
            return TrainerResponse(**result)
            
        except Exception as fallback_error:
            logger.error(f"Fallback response generation failed: {fallback_error}")
            return TrainerResponse(
                plan=["Please provide more details about your training goals"],
                exercise=["Daily moderate exercise recommended"],
                env_setup=["Choose a quiet, safe training environment"],
                warnings=["Stop training if aggressive behavior occurs"],
                handoff=None
            )



