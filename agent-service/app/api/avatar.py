"""
Avatar API - Direct Avatar Generation
Bypass router workflow for direct avatar generation
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.avatar import AvatarAgent
from app.models.agents import AvatarRequest, AvatarResponse
from app.core.language_detector import LanguageDetector

router = APIRouter(prefix="/avatar", tags=["avatar"])

# Initialize components
avatar_agent = AvatarAgent()
language_detector = LanguageDetector()


class DirectAvatarRequest(BaseModel):
    """Direct avatar generation request"""
    message: str
    pet_photo_uploaded: bool = True
    style_catalog: Optional[dict] = None
    language: Optional[str] = None  # Target language code (auto-detected if None)


class DirectAvatarResponse(BaseModel):
    """Direct avatar generation response"""
    style: str
    quality: str
    notes: str
    ok_to_generate: bool
    handoff: Optional[str] = None
    language: str
    timestamp: str


@router.post("/generate", response_model=DirectAvatarResponse)
async def generate_avatar(request: DirectAvatarRequest):
    """
    Direct avatar generation endpoint
    Bypass router workflow for direct avatar processing
    """
    try:
        # Auto-detect language if not provided
        language = request.language
        if not language:
            language = language_detector.detect_language(request.message)
        
        # Create avatar request
        avatar_request = AvatarRequest(
            last_user_msg=request.message,
            pet_photo_uploaded=request.pet_photo_uploaded,
            style_catalog=request.style_catalog
        )
        
        # Process with avatar agent
        avatar_response = await avatar_agent.process(avatar_request, language=language)
        
        # Return response
        return DirectAvatarResponse(
            style=avatar_response.style,
            quality=avatar_response.quality,
            notes=avatar_response.notes,
            ok_to_generate=avatar_response.ok_to_generate,
            handoff=avatar_response.handoff,
            language=language,
            timestamp=avatar_response.timestamp if hasattr(avatar_response, 'timestamp') else ""
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Avatar generation failed: {str(e)}"
        )


@router.get("/styles")
async def get_available_styles():
    """
    Get available avatar styles
    """
    try:
        from app.prompts.avatar import get_style_catalog
        styles = get_style_catalog()
        
        return {
            "styles": styles,
            "message": "Available avatar styles retrieved successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get styles: {str(e)}"
        )


@router.post("/validate")
async def validate_avatar_request(request: DirectAvatarRequest):
    """
    Validate avatar generation request without processing
    """
    try:
        # Basic validation
        if not request.message.strip():
            return {
                "valid": False,
                "error": "Message cannot be empty"
            }
        
        if not request.pet_photo_uploaded:
            return {
                "valid": False,
                "error": "Pet photo must be uploaded to generate avatar",
                "suggestion": "Please upload a pet photo first"
            }
        
        # Language detection
        language = request.language
        if not language:
            language = language_detector.detect_language(request.message)
        
        return {
            "valid": True,
            "language": language,
            "message": "Avatar request is valid"
        }
        
    except Exception as e:
        return {
            "valid": False,
            "error": f"Validation failed: {str(e)}"
        }





