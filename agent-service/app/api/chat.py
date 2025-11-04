"""
Chat API based on LangGraph
"""
import asyncio
from typing import AsyncGenerator, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.workflow import workflow_executor, PetHealthState
from app.models.agents import PetProfile


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Chat request"""
    message: str
    conversation_summary: str = ""
    pet_profile: dict
    window_stats: Optional[dict] = None
    language: Optional[str] = None  # Target language code (auto-detected if None)


class ChatResponse(BaseModel):
    """Chat response"""
    type: str  # "router", "transfer", "specialist", "error"
    agent: str
    content: dict
    timestamp: str


async def stream_chat_response(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Streaming chat response generator
    Based on LangGraph workflow
    """
    try:
        # Build pet profile
        pet_profile = PetProfile(**request.pet_profile)
        
        # Execute workflow
        async for state in workflow_executor.stream_execute(
            user_message=request.message,
            sensor_data=request.window_stats,
            pet_profile=pet_profile,
            language=request.language,
            conversation_summary=request.conversation_summary
        ):
            # Generate response based on state type
            if isinstance(state, dict):
                # Handle dictionary state
                if "router_response" in state and state["router_response"]:
                    router_data = ChatResponse(
                        type="router",
                        agent="butler",
                        content=state["router_response"],
                        timestamp=datetime.now().isoformat()
                    )
                    yield f"data: {router_data.model_dump_json()}\n\n"
                
                if "transfer" in state and state["transfer"]:
                    transfer_data = ChatResponse(
                        type="transfer",
                        agent="system",
                        content=state["transfer"],
                        timestamp=datetime.now().isoformat()
                    )
                    yield f"data: {transfer_data.model_dump_json()}\n\n"
                
                if "specialist_response" in state and state["specialist_response"]:
                    # Determine specialist type
                    agent_type = state.get("agent", "unknown")
                    
                    specialist_data = ChatResponse(
                        type="specialist",
                        agent=agent_type,
                        content=state["specialist_response"],
                        timestamp=datetime.now().isoformat()
                    )
                    yield f"data: {specialist_data.model_dump_json()}\n\n"
                
                if "error" in state:
                    error_data = ChatResponse(
                        type="error",
                        agent="system",
                        content={"error": state["error"]},
                        timestamp=datetime.now().isoformat()
                    )
                    yield f"data: {error_data.model_dump_json()}\n\n"
        
        # End stream
        yield "data: [DONE]\n\n"
        
    except Exception as e:
        error_data = ChatResponse(
            type="error",
            agent="system",
            content={"error": str(e)},
            timestamp=datetime.now().isoformat()
        )
        yield f"data: {error_data.model_dump_json()}\n\n"


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    """
    Streaming chat interface
    Based on LangGraph workflow
    """
    return StreamingResponse(
        stream_chat_response(request),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        }
    )


@router.get("/agents")
async def list_agents():
    """Get all available Agent list"""
    from config import settings
    
    return {
        "agents": [
            {
                "name": "router",
                "description": "Butler·Router",
                "endpoint": "/chat/stream"
            },
            {
                "name": "doctor", 
                "description": "Health Advisor·Education/Triage",
                "endpoint": "/chat/stream"
            },
            {
                "name": "nutritionist",
                "description": "Nutrition Advisor", 
                "endpoint": "/chat/stream"
            },
            {
                "name": "trainer",
                "description": "Training/Behavior Advisor",
                "endpoint": "/chat/stream"
            },
            {
                "name": "faq",
                "description": "Simple FAQ Finder",
                "endpoint": "/chat/stream"
            },
            {
                "name": "avatar",
                "description": "Digital Avatar Requirements Clarification",
                "endpoint": "/chat/stream"
            }
        ],
        "version": settings.agent_version,
        "timestamp": datetime.now().isoformat(),
        "note": "All Agents are accessed through unified LangGraph workflow interface /chat/stream"
    }
