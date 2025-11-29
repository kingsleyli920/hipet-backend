"""
Router Check API - Quick decision endpoint for agentic pet status fetching
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.agents.router import RouterAgent
from app.models.agents import RouterRequest

router = APIRouter(prefix="/chat", tags=["chat"])


class RouterCheckRequest(BaseModel):
    """Router check request"""
    message: str
    conversation_summary: str = ""
    pet_profile: dict = {}
    language: str = None


class RouterCheckResponse(BaseModel):
    """Router check response"""
    needs_pet_status: bool
    reason: str
    next: str
    confidence: float


@router.post("/router-check")
async def router_check(request: RouterCheckRequest):
    """
    Quick Router Agent check to determine if pet status is needed
    This allows the backend to make agentic decisions about database queries
    """
    try:
        from app.models.agents import PetProfile
        
        # Build pet profile
        pet_profile = PetProfile(**request.pet_profile) if request.pet_profile else None
        
        # Call Router Agent
        router_agent = RouterAgent()
        router_request = RouterRequest(
            conversation_summary=request.conversation_summary or "",
            last_user_msg=request.message,
            pet_profile=pet_profile
        )
        
        router_response = await router_agent.process(router_request, language=request.language)
        
        return RouterCheckResponse(
            needs_pet_status=router_response.needs_pet_status,
            reason=router_response.reason,
            next=router_response.next,
            confidence=router_response.confidence
        )
    except Exception as e:
        # Fallback: if error, default to needing status (safe fallback)
        return RouterCheckResponse(
            needs_pet_status=True,
            reason=f"Error in router check: {str(e)}",
            next="router",
            confidence=0.5
        )

