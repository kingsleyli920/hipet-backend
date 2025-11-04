"""
ExplainData Agent 实现
数据解释·MVP核心工具
"""
from typing import Dict, Any
from loguru import logger

from app.agents.base import BaseAgent
from app.models.agents import ExplainDataRequest, ExplainDataResponse
from app.prompts.explain_data import (
    get_explain_data_system_prompt,
    get_explain_data_developer_prompt,
    format_explain_data_user_input,
    get_explain_data_fallback_prompt
)


class ExplainDataAgent(BaseAgent):
    """ExplainData Agent - 数据解释·MVP核心工具"""
    
    async def process(self, request: ExplainDataRequest, language: str = None) -> ExplainDataResponse:
        """
        处理 ExplainData 请求
        
        Args:
            request: ExplainData 请求数据
            
        Returns:
            ExplainData 响应数据
        """
        try:
            # 构建系统提示词
            system_prompt = f"{get_explain_data_system_prompt()}\n\n{get_explain_data_developer_prompt()}"
            
            # 构建用户输入
            user_data = {
                "window_stats": request.window_stats.dict(),
                "pet_profile": request.pet_profile.dict() if request.pet_profile else {}
            }
            user_input = format_explain_data_user_input(user_data)
            
            # 调用 LLM
            result = await self._call_llm(system_prompt, user_input, temperature=0.3)
            
            # 验证响应
            required_fields = ["mood", "insights", "watchouts", "nextAction", "confidence"]
            if not self._validate_response(result, required_fields):
                raise Exception("Invalid LLM response format")
            
            # 验证 confidence 范围
            confidence = result.get("confidence", 0.5)
            if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
                logger.warning(f"Invalid confidence: {confidence}, defaulting to 0.5")
                result["confidence"] = 0.5
            
            # 确保 safety_note 存在
            if "safety_note" not in result:
                result["safety_note"] = "This is educational data analysis, not medical diagnosis."
            
            logger.info(f"Data explanation completed with confidence: {result['confidence']}")
            
            return ExplainDataResponse(**result)
            
        except Exception as e:
            logger.error(f"ExplainData Agent processing error: {str(e)}")
            # 让 LLM 生成 fallback 响应
            return await self._generate_fallback_response(request, language)
    
    async def _generate_fallback_response(self, request: ExplainDataRequest, language: str = None) -> ExplainDataResponse:
        """
        生成 fallback 响应，让 LLM 处理所有内容
        
        Args:
            request: 原始请求
            language: 语言代码
            
        Returns:
            ExplainData 响应
        """
        try:
            fallback_prompt = get_explain_data_fallback_prompt(
                request.window_stats.dict(),
                request.pet_profile.dict() if request.pet_profile else {}
            )
            
            result = await self._call_llm(fallback_prompt, "", temperature=0.3, language=language)
            
            return ExplainDataResponse(**result)
            
        except Exception as fallback_error:
            logger.error(f"Fallback response generation failed: {fallback_error}")
            # 最后的 fallback，返回最基本的响应
            return ExplainDataResponse(
                mood="Insufficient data",
                insights=["Need more data for analysis"],
                watchouts=["Continue observing pet status"],
                nextAction=["Collect more data", "Observe pet behavior changes"],
                confidence=0.1,
                safety_note="This is educational data analysis, not medical diagnosis"
            )



