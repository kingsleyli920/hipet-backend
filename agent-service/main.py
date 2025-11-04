"""
HiPet Agent Service
AI Agent Service Main Entry
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from config import settings
from app.routers import health
from app.api import hardware, chat, avatar, sensor_analysis


def create_app() -> FastAPI:
    """Create FastAPI application"""
    app = FastAPI(
        title="HiPet Agent Service",
        description="Intelligent Pet Health Management - AI Agent Service",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Production environment needs restriction
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Route registration
    app.include_router(health.router, prefix="/health", tags=["health"])
    app.include_router(chat.router, tags=["chat"])
    app.include_router(hardware.router, tags=["hardware"])
    app.include_router(avatar.router, tags=["avatar"])
    app.include_router(sensor_analysis.router, tags=["analyze"])
    
    return app


app = create_app()


@app.on_event("startup")
async def startup_event():
    """Service startup event"""
    logger.info(f"HiPet Agent Service starting on {settings.agent_service_host}:{settings.agent_service_port}")
    logger.info(f"LLM Model: {settings.llm_model}")


@app.on_event("shutdown")
async def shutdown_event():
    """Service shutdown event"""
    logger.info("HiPet Agent Service shutting down")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.agent_service_host,
        port=settings.agent_service_port,
        reload=True,
        log_level=settings.log_level.lower()
    )



