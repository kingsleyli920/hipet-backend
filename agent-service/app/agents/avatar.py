"""
Avatar Agent 实现
Digital Avatar Requirements Clarification
"""
from typing import Dict, Any
from loguru import logger

from app.agents.base import BaseAgent
from app.models.agents import AvatarRequest, AvatarResponse
from app.prompts.avatar import (
    get_avatar_system_prompt,
    get_avatar_developer_prompt,
    format_avatar_user_input,
    get_style_catalog
)


class AvatarAgent(BaseAgent):
    """Avatar Agent - Digital Avatar Requirements Clarification"""
    
    def __init__(self):
        super().__init__()
        self.style_catalog = get_style_catalog()
    
    async def process(self, request: AvatarRequest, language: str = None) -> AvatarResponse:
        """
        处理 Avatar 请求
        
        Args:
            request: Avatar 请求数据
            
        Returns:
            Avatar 响应数据
        """
        try:
            # 检查是否有宠物照片
            if not request.pet_photo_uploaded:
                logger.info("No pet photo uploaded, suggesting handoff to router")
                return AvatarResponse(
                    style="",
                    quality="standard",
                    notes="Please upload a pet photo to generate avatar",
                    ok_to_generate=False,
                    handoff="router"
                )
            
            # 构建系统提示词
            system_prompt = f"{get_avatar_system_prompt()}\n\n{get_avatar_developer_prompt()}"
            
            # 构建用户输入
            user_data = {
                "last_user_msg": request.last_user_msg,
                "pet_photo_uploaded": request.pet_photo_uploaded,
                "style_catalog": request.style_catalog or self.style_catalog
            }
            user_input = format_avatar_user_input(user_data)
            
            # 调用 LLM
            result = await self._call_llm(system_prompt, user_input, temperature=0.5, language=language)
            
            # 验证响应
            required_fields = ["style", "quality", "notes", "ok_to_generate"]
            if not self._validate_response(result, required_fields):
                raise Exception("Invalid LLM response format")
            
            # 验证 quality 的有效值
            valid_qualities = ["standard", "hd"]
            if result["quality"] not in valid_qualities:
                logger.warning(f"Invalid quality: {result['quality']}, defaulting to 'standard'")
                result["quality"] = "standard"
            
            logger.info(f"Avatar generation request processed: {result['style']} ({result['quality']})")
            
            return AvatarResponse(**result)
            
        except Exception as e:
            logger.error(f"Avatar Agent processing error: {str(e)}")
            # 返回默认响应
            return AvatarResponse(
                style="",
                quality="standard",
                notes="抱歉，我无法处理您的头像生成请求。请重新描述您的需求。",
                ok_to_generate=False,
                handoff="router"
            )



