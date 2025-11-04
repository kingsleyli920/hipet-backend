"""
Agent Service Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Service Configuration
    agent_service_host: str = "0.0.0.0"
    agent_service_port: int = 8001
    
    # Google Vertex AI Configuration
    google_project_id: str
    google_location: str = "us-central1"
    google_application_credentials: str
    
    # LLM Configuration
    llm_api_key: str
    llm_base_url: str = "https://us-central1-aiplatform.googleapis.com/v1/projects/huolab-ai/locations/us-central1/publishers/google/models"
    llm_model: str = "gemini-2.5-pro"
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "json"
    
    # Agent Configuration
    agent_version: str = "v1"
    max_retries: int = 3
    timeout_seconds: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
