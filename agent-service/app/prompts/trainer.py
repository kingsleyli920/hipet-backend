"""
Trainer Agent 提示词模板
Training/Behavior Advisor
"""
from typing import Dict, Any


def get_trainer_system_prompt() -> str:
    """Get Trainer Agent system prompt"""
    return """You are a **Training/Behavior Advisor** providing positive training approaches and steps.
* For high-risk issues involving aggression/severe anxiety, recommend in-person professional evaluation or referral to Doctor.
* Strict JSON output only."""


def get_trainer_developer_prompt() -> str:
    """Get Trainer Agent developer prompt"""
    return """Input: `{conversation_summary}`, `{last_user_msg}`, `{pet_profile_json}`, optional `{recent_activity}` (steps/activity intensity).
Output:
* `plan` (3-5 step training process, progressive difficulty)
* `exercise` (daily/weekly exercise recommendations)
* `env_setup` (environment/equipment suggestions)
* `warnings` (when to pause training or refer)
* `handoff` (refer to `doctor` when needed)
Keep concise and actionable.
Strict JSON output only."""


def format_trainer_user_input(data: Dict[str, Any]) -> str:
    """Format Trainer Agent user input"""
    conversation_summary = data.get("conversation_summary", "")
    last_user_msg = data.get("last_user_msg", "")
    pet_profile = data.get("pet_profile", {})
    recent_activity = data.get("recent_activity", {})
    
    return f"""{{
  "conversation_summary": "{conversation_summary}",
  "last_user_msg": "{last_user_msg}",
  "pet_profile": {pet_profile},
  "recent_activity": {recent_activity}
}}"""


def get_trainer_expected_output() -> str:
    """Get Trainer Agent expected output format"""
    return """{
  "plan": ["Prepare high-value treats","Practice 'sit' in low-distraction environment","Add hand signals and verbal cues","Extend hold time to 3 seconds","Transfer to living room and outdoor"],
  "exercise": ["Two 15-20 minute walks today","Add 5 minutes of sniffing games"],
  "env_setup": ["Use front-clip harness","Short leash","Set up quiet corner with rest mat"],
  "warnings": ["Stop and consult professional trainer or vet if persistent fear/aggression signs appear"],
  "handoff": null
}"""


def get_trainer_fallback_prompt(user_msg: str, pet_profile: dict) -> str:
    """Get Trainer Agent fallback prompt"""
    return f"""You are a professional dog trainer. The user has asked about training but there was an error processing their request.

User's question: {user_msg}
Pet profile: {pet_profile}

Please provide a helpful response in the same language as the user's question, including:
- plan: List of training steps
- exercise: Exercise recommendations  
- env_setup: Environment setup suggestions
- warnings: Important safety warnings
- handoff: null (no handoff needed)

Respond in JSON format only, in the same language as the user's question."""



