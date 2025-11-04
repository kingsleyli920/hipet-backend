"""
Sensor Data Analysis Agent
独立于对话路由的指标生成Agent
"""
from typing import Dict, Any
from loguru import logger

from app.agents.base import BaseAgent
from app.models.agents import SensorAnalysisRequest, SensorAnalysisResponse
from app.config.prompt_loader import prompt_loader


class SensorDataAnalysisAgent(BaseAgent):
    """Analyze sensor payloads and output structured metrics"""

    async def process(self, request: SensorAnalysisRequest, language: str = None) -> SensorAnalysisResponse:
        try:
            system_prompt = prompt_loader.get_agent_prompt("sensor_analysis", "system_prompt")
            developer_prompt = prompt_loader.get_agent_prompt("sensor_analysis", "developer_prompt")
            # Provide a concrete JSON example to stabilize structure
            expected_output = prompt_loader.get_agent_prompt("sensor_analysis", "expected_output")

            # Build user input
            payload = request.payload_json
            pet_profile = request.pet_profile.model_dump() if request.pet_profile else {}
            user_input = f"""
{{
  "payload_json": {payload},
  "pet_profile_json": {pet_profile}
}}
"""

            # Prefer explicit language if provided
            lang = language or request.language
            lang_instruction = prompt_loader.get_language_instruction(lang or "en")

            result = await self._call_llm(
                system_prompt=f"{system_prompt}\n\n{developer_prompt}\n\nFollow the language instruction: {lang_instruction}\nStrictly output JSON only. Here is a reference example (do not copy values, just the structure):\n{expected_output}",
                user_input=user_input,
                temperature=0.1,
                language=lang
            )

            # Basic validation of required fields
            required_fields = ["success", "version", "metrics", "insights", "confidence", "safety_note"]
            for key in required_fields:
                if key not in result:
                    raise ValueError(f"Missing field in LLM response: {key}")

            # Optional conservative fills
            metrics: Dict[str, Any] = result.get("metrics", {}) or {}
            metrics_meta: Dict[str, Any] = {}
            penalty_sum = 0.0
            opts = request.options or {}
            if opts.get("conservative_fill"):
                max_penalty = float(opts.get("max_penalty", 0.3))

                def add_meta(path: str, method: str, penalty: float):
                    nonlocal penalty_sum
                    if penalty_sum + penalty > max_penalty:
                        return
                    metrics_meta[path] = {"estimate": True, "method": method, "confidencePenalty": penalty}
                    penalty_sum += penalty

                rsd = (payload.get("raw_sensor_data", {}) or {})
                motion = rsd.get("motion_samples", []) or []
                vitals = rsd.get("vital_signs_samples", []) or []
                stats = payload.get("summary_statistics", {}) or {}
                offline = (payload.get("offline_inference", {}) or {})
                h_assess = offline.get("health_assessment", {}) or {}
                b_an = offline.get("behavior_analysis", {}) or {}

                phys = metrics.get("physical", {}) or {}
                act = metrics.get("activity", {}) or {}
                trd = metrics.get("trend", {}) or {}

                intensities = [s.get("movement_intensity") for s in motion if isinstance(s.get("movement_intensity"), (int, float))]
                avg_int = sum(intensities) / len(intensities) if intensities else None
                mean_temp = (stats.get("temperature_stats", {}) or {}).get("mean")
                last_temp = next((s.get("temperature_c") for s in reversed(vitals) if isinstance(s.get("temperature_c"),(int,float))), None)

                # recovery_index from health score
                if phys.get("recovery_index") is None and isinstance(h_assess.get("overall_health_score"),(int,float)):
                    if phys.get("temperature_trend") == "stable" and (act.get("activity_intensity") != "high"):
                        ri = round(0.8 * (h_assess["overall_health_score"] / 10) * 10, 1)
                        phys["recovery_index"] = ri
                        add_meta("physical.recovery_index", "rule_recovery_from_healthscore", 0.10)

                # rest_quality from low motion
                if act.get("rest_quality") is None and avg_int is not None:
                    if avg_int < 0.2 and (b_an.get("behavior_pattern") in (None, "resting", "still")):
                        rq = 8.0 if avg_int < 0.1 else 7.0
                        act["rest_quality"] = rq
                        add_meta("activity.rest_quality", "rule_low_motion_window", 0.10)

                # temperature_trend fallback from mean vs last
                if phys.get("temperature_trend") in (None, "") and last_temp is not None and isinstance(mean_temp,(int,float)):
                    delta = last_temp - mean_temp
                    phys["temperature_trend"] = "rising" if delta > 0.2 else ("falling" if delta < -0.2 else "stable")
                    add_meta("physical.temperature_trend", "rule_temp_vs_mean", 0.05)

                # movement_pattern fallback from intensity
                if act.get("movement_pattern") in (None, "") and avg_int is not None:
                    act["movement_pattern"] = "running" if avg_int > 0.6 else ("walking" if avg_int > 0.25 else ("resting" if avg_int < 0.1 else "still"))
                    add_meta("activity.movement_pattern", "rule_intensity_mapping", 0.05)

                # health_trajectory fallback from offline trend text
                if trd.get("health_trajectory") in (None, ""):
                    ta = str(h_assess.get("trend_analysis",""))
                    if ta:
                        trd["health_trajectory"] = ta if ta in {"improving","stable","declining"} else "stable"
                        add_meta("trend.health_trajectory", "rule_from_offline_trend", 0.05)

                metrics["physical"], metrics["activity"], metrics["trend"] = phys, act, trd

            response = SensorAnalysisResponse(
                success=bool(result.get("success", True)),
                version=str(result.get("version", "v1")),
                metrics=metrics,
                metricsMeta=metrics_meta or None,
                insights=result.get("insights", {}),
                confidence=round(max(0.0, float(result.get("confidence", 0.5)) - penalty_sum), 2),
                safety_note=str(result.get("safety_note", "Educational analysis, not medical diagnosis."))
            )

            return response

        except Exception as e:
            logger.error(f"SensorDataAnalysisAgent error: {e}")
            # Fallback minimal response
            return SensorAnalysisResponse(
                success=False,
                version="v1",
                metrics={},
                insights={"highlights": [], "watchouts": ["insufficient data"], "recommendations": []},
                confidence=0.0,
                safety_note="Educational analysis, not medical diagnosis."
            )


