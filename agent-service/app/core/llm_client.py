"""
LLM 客户端 - 支持 Google Vertex AI Gemini
"""
import json
import os
from typing import Dict, Any, Optional
from loguru import logger
import vertexai
from vertexai.preview.generative_models import GenerativeModel
from config import settings
from app.core.language_manager import language_manager


class LLMClient:
    
    def __init__(self):
        self.project_id = settings.google_project_id
        self.location = settings.google_location
        self.model_name = settings.llm_model
        self.timeout = settings.timeout_seconds
        
        # 设置 Google 认证
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.google_application_credentials
        
        # 初始化 Vertex AI
        try:
            vertexai.init(project=self.project_id, location=self.location)
            self.model = GenerativeModel(self.model_name)
            logger.info(f"Vertex AI Gemini initialized successfully with model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI Gemini: {e}")
            raise
        
    async def generate_response(
        self, 
        messages: list, 
        temperature: float = 0.7,
        max_tokens: int = 8192
    ) -> Optional[str]:
        """
        生成 LLM 响应
        
        Args:
            messages: 对话消息列表
            temperature: 温度参数
            max_tokens: 最大token数
            
        Returns:
            LLM 响应文本
        """
        try:
            # 将消息转换为 Gemini 格式
            prompt_parts = []
            
            for message in messages:
                role = message.get("role", "user")
                content = message.get("content", "")
                
                if role == "system":
                    prompt_parts.append(f"System: {content}")
                elif role == "user":
                    prompt_parts.append(f"User: {content}")
                elif role == "assistant":
                    prompt_parts.append(f"Assistant: {content}")
            
            # 添加 JSON 格式要求
            prompt_parts.append("\n请严格按照 JSON 格式回复，不要包含任何其他文字。")
            
            full_prompt = "\n\n".join(prompt_parts)
            
            # 生成响应
            response = self.model.generate_content(
                full_prompt,
                generation_config={
                    "temperature": temperature,
                    "max_output_tokens": max_tokens,
                }
            )
            
            if response.text:
                logger.info("Vertex AI Gemini response generated successfully")
                return response.text
            else:
                logger.error("Empty response from Vertex AI Gemini")
                return None
                
        except Exception as e:
            logger.error(f"Error calling Vertex AI Gemini: {e}")
            return None
    
    async def generate_json_response(
        self,
        system_prompt: str,
        user_input: str,
        temperature: float = 0.7,
        language: Optional[str] = None,
        conversation_summary: str = ""
    ) -> Optional[Dict[str, Any]]:
        """
        Generate JSON format response with language support
        
        Args:
            system_prompt: System prompt
            user_input: User input
            temperature: Temperature parameter
            language: Target language code (auto-detected if None)
            
        Returns:
            Parsed JSON data
        """
        # Determine response language using language manager
        response_language = language_manager.determine_response_language(
            current_message=user_input,
            conversation_summary=conversation_summary,
            explicit_language=language
        )
        
        # Create language-aware prompt
        enhanced_system_prompt = language_manager.create_language_aware_prompt(
            base_prompt=system_prompt,
            language=response_language,
            conversation_summary=conversation_summary
        )
        
        # Debug logging (can be removed in production)
        logger.debug(f"Response language: {response_language}")
        logger.debug(f"Conversation summary: {conversation_summary[:100] if conversation_summary else 'None'}...")
        
        messages = [
            {"role": "system", "content": enhanced_system_prompt},
            {"role": "user", "content": user_input}
        ]
        
        response_text = await self.generate_response(messages, temperature)
        if not response_text:
            return None
            
        try:
            # 清理响应文本，移除可能的 markdown 代码块标记
            cleaned_text = response_text.strip()
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:]
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]
            cleaned_text = cleaned_text.strip()
            
            # 调试：打印清理后的文本
            logger.info(f"Cleaned response text: {cleaned_text}")
            
            result = json.loads(cleaned_text)
            
            # 修复字段名映射问题
            if "target" in result and "next" not in result:
                result["next"] = result.pop("target")
            
            # 修复 meal_plan 格式问题
            if "meal_plan" in result and isinstance(result["meal_plan"], dict):
                # 将字典转换为列表格式
                meal_plan_list = []
                for key, value in result["meal_plan"].items():
                    meal_plan_list.append(f"{key}: {value}")
                result["meal_plan"] = meal_plan_list
            
            # 修复 tips 格式问题
            if "tips" in result and isinstance(result["tips"], list):
                tips_list = []
                for tip in result["tips"]:
                    if isinstance(tip, dict):
                        # 如果是字典，提取 title 和 content
                        if "title" in tip and "content" in tip:
                            tips_list.append(f"{tip['title']}: {tip['content']}")
                        else:
                            # 否则直接拼接所有值
                            tips_list.append(": ".join([str(v) for v in tip.values()]))
                    else:
                        tips_list.append(str(tip))
                result["tips"] = tips_list
            
            # 修复 next_actions 格式问题 (Doctor Agent)
            if "next_actions" in result and isinstance(result["next_actions"], list):
                actions_list = []
                for action in result["next_actions"]:
                    if isinstance(action, dict):
                        # 如果是字典，提取 action 字段
                        if "action" in action:
                            actions_list.append(action["action"])
                        else:
                            # 否则直接拼接所有值
                            actions_list.append(": ".join([str(v) for v in action.values()]))
                    else:
                        actions_list.append(str(action))
                result["next_actions"] = actions_list
            
            # 修复 plan 格式问题 (Trainer Agent)
            if "plan" in result and isinstance(result["plan"], list):
                plan_list = []
                for plan in result["plan"]:
                    if isinstance(plan, dict):
                        # 如果是字典，提取 step 和 description
                        if "step" in plan and "description" in plan:
                            plan_list.append(f"步骤{plan['step']}: {plan['description']}")
                        else:
                            # 否则直接拼接所有值
                            plan_list.append(": ".join([str(v) for v in plan.values()]))
                    else:
                        plan_list.append(str(plan))
                result["plan"] = plan_list
            
            # 修复 exercise 格式问题 (Trainer Agent)
            if "exercise" in result and isinstance(result["exercise"], dict):
                exercise_list = []
                for key, value in result["exercise"].items():
                    exercise_list.append(f"{key}: {value}")
                result["exercise"] = exercise_list
            
            # 修复 env_setup 格式问题 (Trainer Agent)
            if "env_setup" in result:
                if isinstance(result["env_setup"], dict):
                    env_list = []
                    for key, value in result["env_setup"].items():
                        env_list.append(f"{key}: {value}")
                    result["env_setup"] = env_list
                elif isinstance(result["env_setup"], list):
                    env_list = []
                    for env_item in result["env_setup"]:
                        if isinstance(env_item, dict):
                            # 如果是字典，提取 item 字段或拼接所有值
                            if "item" in env_item:
                                env_list.append(env_item["item"])
                            else:
                                env_list.append(": ".join([str(v) for v in env_item.values()]))
                        else:
                            env_list.append(str(env_item))
                    result["env_setup"] = env_list
            
            # 修复 handoff 格式问题 (Doctor Agent)
            if "handoff" in result and isinstance(result["handoff"], dict):
                # 将字典转换为字符串
                if "target" in result["handoff"] and "reason" in result["handoff"]:
                    result["handoff"] = f"Target: {result['handoff']['target']}. Reason: {result['handoff']['reason']}"
                else:
                    result["handoff"] = str(result["handoff"])
            
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response: {e}")
            logger.error(f"Raw response: {response_text}")
            logger.error(f"Cleaned response: {cleaned_text}")
            return None


# 全局 LLM 客户端实例
llm_client = LLMClient()
