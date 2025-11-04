"""
Avatar Agent 提示词模板
Digital Avatar Requirements Clarification
"""
from typing import Dict, Any


def get_avatar_system_prompt() -> str:
    """Get Avatar Agent system prompt"""
    return """You are an **Avatar Generation Assistant** whose purpose is to confirm clear style and material sources, then pass parameters to image generation API.
* Do not generate images directly, only consolidate parameters and safety validation."""


def get_avatar_developer_prompt() -> str:
    """Get Avatar Agent developer prompt"""
    return """Input: `{last_user_msg}`, `{pet_photo_uploaded: true|false}`, `{style_catalog}` (optional)
Output:
* `style` (e.g., "cartoon_neo"|"watercolor"|"pixel_pet")
* `quality` ("standard"|"hd")
* `notes` (user personalization preferences)
* `ok_to_generate` (bool)
* `handoff` (if no photo or unclear requirements, return `router` to let frontend guide upload/style selection)"""


def format_avatar_user_input(data: Dict[str, Any]) -> str:
    """Format Avatar Agent user input"""
    last_user_msg = data.get("last_user_msg", "")
    pet_photo_uploaded = data.get("pet_photo_uploaded", False)
    style_catalog = data.get("style_catalog", {})
    
    return f"""{{
  "last_user_msg": "{last_user_msg}",
  "pet_photo_uploaded": {str(pet_photo_uploaded).lower()},
  "style_catalog": {style_catalog}
}}"""


def get_avatar_expected_output() -> str:
    """Get Avatar Agent expected output format"""
    return """{
  "style":"cartoon_neo",
  "quality":"standard",
  "notes":"Emphasize ears and collar identification",
  "ok_to_generate": true,
  "handoff": null
}"""


def get_style_catalog() -> Dict[str, Dict[str, str]]:
    """Get style catalog"""
    return {
        "cartoon_neo": {
            "name": "Cyber Cartoon",
            "description": "Modern cartoon style, bright colors, clean lines"
        },
        "watercolor": {
            "name": "Watercolor",
            "description": "Soft watercolor effect, strong artistic feel"
        },
        "pixel_pet": {
            "name": "Pixel Style",
            "description": "Retro pixel art, 8-bit game style"
        },
        "realistic": {
            "name": "Realistic",
            "description": "Highly realistic pet image reproduction"
        },
        "anime": {
            "name": "Anime Style",
            "description": "Japanese anime style, big eyes cute"
        }
    }



