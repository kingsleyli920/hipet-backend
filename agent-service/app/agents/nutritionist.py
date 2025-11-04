"""
Nutritionist Agent 实现
Nutrition Advisor
"""
from typing import Dict, Any
from loguru import logger

from app.agents.base import BaseAgent
from app.models.agents import NutritionistRequest, NutritionistResponse
from app.prompts.nutritionist import (
    get_nutritionist_system_prompt,
    get_nutritionist_developer_prompt,
    format_nutritionist_user_input,
    get_nutritionist_fallback_prompt
)


class NutritionistAgent(BaseAgent):
    """Nutritionist Agent - Nutrition Advisor"""
    
    async def process(self, request: NutritionistRequest, language: str = None) -> NutritionistResponse:
        """
        处理 Nutritionist 请求
        
        Args:
            request: Nutritionist 请求数据
            
        Returns:
            Nutritionist 响应数据
        """
        try:
            # 构建系统提示词
            system_prompt = f"{get_nutritionist_system_prompt()}\n\n{get_nutritionist_developer_prompt()}"
            
            # 构建用户输入
            user_data = {
                "conversation_summary": request.conversation_summary or "",
                "last_user_msg": request.last_user_msg,
                "pet_profile": request.pet_profile.dict() if request.pet_profile else {},
                "diet_history": request.diet_history or {}
            }
            user_input = format_nutritionist_user_input(user_data)
            
            # 调用 LLM
            result = await self._call_llm(system_prompt, user_input, temperature=0.5, language=language)
            
            # 验证响应
            required_fields = ["summary", "meal_plan", "avoid_list", "tips"]
            if not self._validate_response(result, required_fields):
                raise Exception("Invalid LLM response format")
            
            # 确保 safety_note 存在
            if "safety_note" not in result:
                result["safety_note"] = "Please consult a professional nutritionist for dietary advice."
            
            logger.info("Nutritionist consultation completed successfully")
            
            return NutritionistResponse(**result)
            
        except Exception as e:
            logger.error(f"Nutritionist Agent processing error: {str(e)}")
            return await self._generate_fallback_response(request, language)
    
    async def _generate_fallback_response(self, request: NutritionistRequest, language: str = None) -> NutritionistResponse:
        """
        生成 fallback 响应，让 LLM 处理所有内容
        
        Args:
            request: 原始请求
            language: 语言代码
            
        Returns:
            Nutritionist 响应
        """
        try:
            fallback_prompt = get_nutritionist_fallback_prompt(
                request.last_user_msg,
                request.pet_profile.dict() if request.pet_profile else {},
                request.diet_history or {}
            )
            
            result = await self._call_llm(fallback_prompt, "", temperature=0.3, language=language)
            
            return NutritionistResponse(**result)
            
        except Exception as fallback_error:
            logger.error(f"Fallback response generation failed: {fallback_error}")
            # 最后的 fallback，返回最基本的响应
            return NutritionistResponse(
                summary="Please provide more details about your pet's nutrition needs",
                meal_plan=["Consult a professional nutritionist for personalized diet plan"],
                avoid_list=["Chocolate, grapes, onions and other toxic foods"],
                tips=["Feed on schedule", "Provide adequate water", "Record weight changes regularly"],
                handoff=None,
                safety_note="Please consult a professional nutritionist for dietary advice"
            )



