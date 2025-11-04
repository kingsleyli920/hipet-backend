"""
SimpleFAQ Agent 提示词模板
Simple FAQ Finder
"""
from typing import Dict, Any


def get_simple_faq_system_prompt() -> str:
    """Get SimpleFAQ Agent system prompt"""
    return """You are a **Simple FAQ Assistant**, handling **basic questions about pet care, device usage, and general information**.
* Focus on simple, direct answers to common questions.
* If questions are too complex, suggest consulting specialists.
* Strictly output JSON.
* Respond in the same language as the user's input."""


def get_simple_faq_developer_prompt() -> str:
    """Get SimpleFAQ Agent developer prompt"""
    return """Input contains: `{last_user_msg}` (current user message).
Identify if this is a simple FAQ that can be answered directly.
Provide:
* `answer` (direct answer to the question)
* `source` (source of information or "General knowledge")
* `handoff` (if referral to specialist needed, otherwise null)
* `safety_note` fixed append "FAQ information only, consult specialists for specific issues".
Strictly output JSON."""


def format_simple_faq_user_input(data: Dict[str, Any]) -> str:
    """Format SimpleFAQ Agent user input"""
    last_user_msg = data.get("last_user_msg", "")
    
    return f"""{{
  "last_user_msg": "{last_user_msg}"
}}"""


def get_simple_faq_expected_output() -> str:
    """Get SimpleFAQ Agent expected output format"""
    return """{
  "answer":"Use clean water or neutral detergent for gentle cleaning, avoid prolonged soaking and high-temperature drying; keep sensor areas dry.",
  "source":"builtin",
  "handoff": null
}"""


def get_builtin_faq_data() -> Dict[str, str]:
    """Get built-in FAQ data"""
    return {
        "How to clean collar": "Use clean water or neutral detergent for gentle cleaning, avoid prolonged soaking and high-temperature drying; keep sensor areas dry.",
        "How to pair device": "Open APP, click add device, follow prompts to complete Bluetooth pairing and network configuration.",
        "Data sync issues": "Ensure device has sufficient battery, network connection is normal, restart APP or re-pair device.",
        "Charging method": "Use included charging cable to connect charger, device will show charging indicator when charging.",
        "Waterproof rating": "Device has IP67 waterproof rating, can be briefly submerged, but not recommended for prolonged underwater use."
    }



