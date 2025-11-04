"""
Router Agent 实现
Butler·Router
"""
from typing import Dict, Any
from loguru import logger

from app.agents.base import BaseAgent
from app.models.agents import RouterRequest, RouterResponse
from app.config.prompt_loader import prompt_loader


class RouterAgent(BaseAgent):
    """Router Agent - Butler·Router"""
    
    async def process(self, request: RouterRequest, language: str = None) -> RouterResponse:
        """
        处理 Router 请求
        
        Args:
            request: Router 请求数据
            
        Returns:
            Router 响应数据
        """
        try:
            # Build system prompt from configuration
            system_prompt = prompt_loader.get_agent_prompt("router", "system_prompt")
            developer_prompt = prompt_loader.get_agent_prompt("router", "developer_prompt")
            full_system_prompt = f"{system_prompt}\n\n{developer_prompt}"
            
            # Build user input
            user_data = {
                "conversation_summary": request.conversation_summary or "",
                "last_user_msg": request.last_user_msg,
                "pet_profile": request.pet_profile.model_dump() if request.pet_profile else {}
            }
            user_input = f"""
{{
  "conversation_summary": "{user_data['conversation_summary']}",
  "last_user_msg": "{user_data['last_user_msg']}",
  "pet_profile": {user_data['pet_profile']}
}}"""
            
            # Call LLM with language support
            result = await self._call_llm(full_system_prompt, user_input, temperature=0.3, language=language, conversation_summary=request.conversation_summary or "")
            
            # 验证响应
            required_fields = ["next", "reason", "confidence", "response_preview"]
            if not self._validate_response(result, required_fields):
                raise Exception("Invalid LLM response format")
            
            # 验证 next 字段的有效值
            valid_targets = ["router", "doctor", "nutritionist", "trainer", "faq", "avatar"]
            if result["next"] not in valid_targets:
                logger.warning(f"Invalid target: {result['next']}, defaulting to 'router'")
                result["next"] = "router"
            
            # 验证 confidence 范围
            confidence = result.get("confidence", 0.5)
            if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
                logger.warning(f"Invalid confidence: {confidence}, defaulting to 0.5")
                result["confidence"] = 0.5
            
            logger.info(f"Router decision: {result['next']} (confidence: {result['confidence']})")
            
            return RouterResponse(**result)
            
        except Exception as e:
            logger.error(f"Router Agent processing error: {str(e)}")
            # 返回默认响应
            return RouterResponse(
                next="router",
                reason="系统处理异常，请重新描述您的需求",
                confidence=0.1,
                response_preview="我需要更多信息来帮助您，请详细描述您的问题。"
            )



