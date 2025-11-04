"""
Agent 基类
"""
from abc import ABC, abstractmethod
from typing import Any, Dict
from loguru import logger
from app.core.llm_client import llm_client
from config import settings


class BaseAgent(ABC):
    """Agent 基类"""
    
    def __init__(self):
        self.llm_client = llm_client
        self.version = settings.agent_version
        
    @abstractmethod
    async def process(self, request: Any) -> Any:
        """处理请求的抽象方法"""
        pass
    
    async def _call_llm(self, system_prompt: str, user_input: str, temperature: float = 0.7, language: str = None, conversation_summary: str = "") -> Dict[str, Any]:
        """
        Call LLM with language support
        
        Args:
            system_prompt: System prompt
            user_input: User input
            temperature: Temperature parameter
            language: Target language code (auto-detected if None)
            
        Returns:
            LLM response data
        """
        try:
            result = await self.llm_client.generate_json_response(
                system_prompt=system_prompt,
                user_input=user_input,
                temperature=temperature,
                language=language,
                conversation_summary=conversation_summary
            )
            
            if result is None:
                logger.error(f"{self.__class__.__name__} LLM call failed")
                raise Exception("LLM call failed")
                
            logger.info(f"{self.__class__.__name__} processed successfully")
            return result
            
        except Exception as e:
            logger.error(f"{self.__class__.__name__} error: {str(e)}")
            raise
    
    def _validate_response(self, response: Dict[str, Any], required_fields: list) -> bool:
        """
        验证响应数据
        
        Args:
            response: 响应数据
            required_fields: 必需字段列表
            
        Returns:
            验证是否通过
        """
        for field in required_fields:
            if field not in response:
                logger.error(f"Missing required field: {field}")
                return False
        return True



