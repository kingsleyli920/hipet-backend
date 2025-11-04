"""
ExplainData Agent 提示词模板
数据解释·MVP核心工具
"""
from typing import Dict, Any


def get_explain_data_system_prompt() -> str:
    """Get ExplainData Agent system prompt"""
    return """You are a "**Data Translator**" converting heart rate/HRV/activity/emotion data (valence/arousal) into human-friendly insights.
* No diagnosis; if data is insufficient, suggest "continue observing".
* Strict JSON output only (schema below)."""


def get_explain_data_developer_prompt() -> str:
    """Get ExplainData Agent developer prompt"""
    return """Input: `{window_stats_json}`, `{pet_profile_json}`; if multimodal conflicts exist, explain and reduce `confidence`.
Output fields:
* `mood` (e.g., "relaxed·low arousal/stressed·high arousal/excited")
* `insights` (2-4 observations)
* `watchouts` (1-3 things to watch)
* `nextAction` (1-3 action recommendations)
* `confidence` (0-1)
* `safety_note` (fixed "educational, not medical diagnosis")
Strict JSON output only."""


def format_explain_data_user_input(data: Dict[str, Any]) -> str:
    """Format ExplainData Agent user input"""
    window_stats = data.get("window_stats", {})
    pet_profile = data.get("pet_profile", {})
    
    return f"""{{
  "window_stats": {window_stats},
  "pet_profile": {pet_profile}
}}"""


def get_explain_data_expected_output() -> str:
    """Get ExplainData Agent expected output format"""
    return """{
  "mood":"relaxed·low arousal",
  "insights":["HR stable within individual normal range","activity slightly below 7-day average"],
  "watchouts":["Watch for persistent low activity with lethargy"],
  "nextAction":["Evening walk 15-20 minutes","supplement water"],
  "confidence":0.73,
  "safety_note":"This is educational explanation, not medical diagnosis."
}"""


def get_explain_data_fallback_prompt(window_stats: dict, pet_profile: dict) -> str:
    """Get ExplainData Agent fallback prompt"""
    return f"""You are a data analysis expert for pet health monitoring. There was an error processing the data analysis request.

Window stats: {window_stats}
Pet profile: {pet_profile}

Please provide a helpful response in the same language as the user's question, including:
- mood: Assessment of pet's current mood/state
- insights: List of data insights
- watchouts: List of things to watch for
- nextAction: List of recommended next actions
- confidence: Confidence level (0.0 to 1.0)
- safety_note: Important safety disclaimer

Respond in JSON format only, in the same language as the user's question."""



