"""
SimpleFAQ Agent 实现
Simple FAQ Finder
"""
from typing import Dict, Any
from loguru import logger

from app.agents.base import BaseAgent
from app.models.agents import SimpleFAQRequest, SimpleFAQResponse
from app.prompts.simple_faq import (
    get_simple_faq_system_prompt,
    get_simple_faq_developer_prompt,
    format_simple_faq_user_input,
    get_builtin_faq_data
)


class SimpleFAQAgent(BaseAgent):
    """SimpleFAQ Agent - Simple FAQ Finder"""
    
    def __init__(self):
        super().__init__()
        self.builtin_faq = get_builtin_faq_data()
    
    async def process(self, request: SimpleFAQRequest, language: str = None) -> SimpleFAQResponse:
        """
        处理 SimpleFAQ 请求
        
        Args:
            request: SimpleFAQ 请求数据
            
        Returns:
            SimpleFAQ 响应数据
        """
        try:
            # 首先尝试在内置FAQ中查找
            user_msg = request.last_user_msg.strip()
            
            # 简单的关键词匹配
            for question, answer in self.builtin_faq.items():
                if any(keyword in user_msg for keyword in question.split()):
                    logger.info(f"Found builtin FAQ match: {question}")
                    return SimpleFAQResponse(
                        answer=answer,
                        source="builtin",
                        handoff=None
                    )
            
            # 如果没有找到匹配，使用LLM生成通用回答
            system_prompt = f"{get_simple_faq_system_prompt()}\n\n{get_simple_faq_developer_prompt()}"
            user_input = format_simple_faq_user_input({"last_user_msg": user_msg})
            
            # 调用 LLM
            result = await self._call_llm(system_prompt, user_input, temperature=0.3, language=language)
            
            # 验证响应
            required_fields = ["answer", "source"]
            if not self._validate_response(result, required_fields):
                raise Exception("Invalid LLM response format")
            
            # 确保 safety_note 存在
            if "safety_note" not in result:
                result["safety_note"] = "FAQ information only, consult specialists for specific issues."
            
            logger.info("FAQ consultation completed successfully")
            
            return SimpleFAQResponse(**result)
            
        except Exception as e:
            logger.error(f"SimpleFAQ Agent processing error: {str(e)}")
            # 返回默认响应
            return SimpleFAQResponse(
                answer="抱歉，我暂时无法回答这个问题。请尝试重新描述您的问题，或联系客服获取帮助。",
                source="generic",
                handoff="router"
            )
