"""
Prompt Configuration Loader
Loads and manages prompt templates from YAML configuration
"""
import yaml
import os
from typing import Dict, Any, Optional
from loguru import logger


class PromptLoader:
    """Loads and manages prompt templates"""
    
    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "prompts.yaml")
        
        self.config_path = config_path
        self._config = None
        self._load_config()
    
    def _load_config(self):
        """Load configuration from YAML file"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as file:
                self._config = yaml.safe_load(file)
            logger.info(f"Loaded prompt configuration from {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to load prompt configuration: {e}")
            raise
    
    def get_agent_prompt(self, agent_name: str, prompt_type: str) -> str:
        """
        Get specific prompt for an agent
        
        Args:
            agent_name: Name of the agent (router, doctor, nutritionist, etc.)
            prompt_type: Type of prompt (system_prompt, developer_prompt, expected_output)
            
        Returns:
            Prompt string
        """
        try:
            if self._config is None:
                raise ValueError("Configuration not loaded")
            
            agent_config = self._config.get("agents", {}).get(agent_name)
            if not agent_config:
                raise ValueError(f"Agent '{agent_name}' not found in configuration")
            
            prompt = agent_config.get(prompt_type)
            if not prompt:
                raise ValueError(f"Prompt type '{prompt_type}' not found for agent '{agent_name}'")
            
            return prompt.strip()
            
        except Exception as e:
            logger.error(f"Failed to get prompt for {agent_name}.{prompt_type}: {e}")
            raise
    
    def get_language_instruction(self, language_code: str) -> str:
        """
        Get language instruction for the given language code
        
        Args:
            language_code: Language code (en, zh-cn, ja, etc.)
            
        Returns:
            Language instruction string
        """
        try:
            if self._config is None:
                raise ValueError("Configuration not loaded")
            
            instructions = self._config.get("language_instructions", {})
            return instructions.get(language_code, instructions.get("en", "Please respond in English."))
            
        except Exception as e:
            logger.error(f"Failed to get language instruction for {language_code}: {e}")
            return "Please respond in English."
    
    def get_system_message(self, message_key: str, **kwargs) -> str:
        """
        Get system message with optional formatting
        
        Args:
            message_key: Key for the system message
            **kwargs: Formatting parameters
            
        Returns:
            Formatted system message
        """
        try:
            if self._config is None:
                raise ValueError("Configuration not loaded")
            
            messages = self._config.get("system_messages", {})
            message_template = messages.get(message_key, "")
            
            if kwargs:
                return message_template.format(**kwargs)
            return message_template
            
        except Exception as e:
            logger.error(f"Failed to get system message for {message_key}: {e}")
            return ""
    
    def get_agent_info(self, agent_name: str) -> Dict[str, Any]:
        """
        Get agent information (name, description)
        
        Args:
            agent_name: Name of the agent
            
        Returns:
            Agent information dictionary
        """
        try:
            if self._config is None:
                raise ValueError("Configuration not loaded")
            
            agent_config = self._config.get("agents", {}).get(agent_name, {})
            return {
                "name": agent_config.get("name", agent_name.title()),
                "description": agent_config.get("description", "")
            }
            
        except Exception as e:
            logger.error(f"Failed to get agent info for {agent_name}: {e}")
            return {"name": agent_name.title(), "description": ""}
    
    def list_agents(self) -> list:
        """
        List all available agents
        
        Returns:
            List of agent names
        """
        try:
            if self._config is None:
                raise ValueError("Configuration not loaded")
            
            return list(self._config.get("agents", {}).keys())
            
        except Exception as e:
            logger.error(f"Failed to list agents: {e}")
            return []


# Global prompt loader instance
prompt_loader = PromptLoader()
