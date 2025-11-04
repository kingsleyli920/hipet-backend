#!/usr/bin/env python3
import json
import sys
from typing import Dict, Any, List
import requests


def build_payload() -> Dict[str, Any]:
    return {
        "metadata": {
            "device_id": "PET_MONITOR_001",
            "session_id": "sess_20240715143000",
            "timestamp": 1720256789000,
            "firmware_version": "2.1.0",
            "data_interval_seconds": 30,
            "upload_reason": "scheduled_upload",
        },
        "raw_sensor_data": {
            "vital_signs_samples": [
                {"timestamp_offset": 0, "temperature_c": 36.5, "heart_rate_bpm": 75},
                {"timestamp_offset": 5000, "temperature_c": 36.6, "heart_rate_bpm": 76},
                {"timestamp_offset": 10000, "temperature_c": 36.4, "heart_rate_bpm": 74},
                {"timestamp_offset": 15000, "temperature_c": 36.7, "heart_rate_bpm": 78},
                {"timestamp_offset": 20000, "temperature_c": 36.5, "heart_rate_bpm": 75},
            ],
            "motion_samples": [
                {
                    "timestamp_offset": 0,
                    "acceleration": {"x": 0.12, "y": 0.98, "z": 9.81},
                    "movement_intensity": 0.15,
                },
                {
                    "timestamp_offset": 1000,
                    "acceleration": {"x": 1.25, "y": 2.34, "z": 10.12},
                    "movement_intensity": 0.45,
                },
            ],
        },
        "offline_inference": {
            "health_assessment": {
                "overall_health_score": 8,
                "vital_signs_stability": 7,
                "abnormalities_detected": ["slight_tachycardia"],
                "trend_analysis": "stable",
            },
            "behavior_analysis": {
                "activity_level": 6,
                "mood_state": 7,
                "behavior_pattern": "normal_activity",
                "unusual_behavior_detected": False,
            },
            "media_analysis": {
                "audio_events": [
                    {
                        "timestamp_offset": 5000,
                        "event_type": "barking",
                        "duration_ms": 1200,
                        "emotional_tone": "excited",
                    },
                    {
                        "timestamp_offset": 12000,
                        "event_type": "whining",
                        "duration_ms": 800,
                        "emotional_tone": "anxious",
                    },
                ],
                "video_analysis": [
                    {"timestamp_offset": 0, "movement_type": "walking", "environment_changes": "none"},
                    {"timestamp_offset": 10000, "movement_type": "still", "environment_changes": "human_entered"},
                ],
            },
        },
        "summary_statistics": {
            "temperature_stats": {"mean": 36.54, "min": 36.4, "max": 36.7},
            "heart_rate_stats": {"mean": 75.6, "min": 74, "max": 78},
        },
        "system_status": {
            "battery_level": 78,
            "memory_usage_percent": 45,
            "storage_available_mb": 256,
        },
    }


EN_ENUMS = {
    "heart_rate_zone": {"resting", "active", "stressed", None, ""},
    "temperature_trend": {"stable", "rising", "falling", None, ""},
    "activity_intensity": {"low", "moderate", "high", None, ""},
    "movement_pattern": {"walking", "running", "resting", "still", None, ""},
    "health_trajectory": {"improving", "stable", "declining", None, ""},
}


def validate_enums(metrics: Dict[str, Any]) -> List[str]:
    errs: List[str] = []
    phys = (metrics or {}).get("physical", {}) or {}
    act = (metrics or {}).get("activity", {}) or {}
    tr = (metrics or {}).get("trend", {}) or {}

    checks = [
        ("physical.heart_rate_zone", phys.get("heart_rate_zone"), EN_ENUMS["heart_rate_zone"]),
        ("physical.temperature_trend", phys.get("temperature_trend"), EN_ENUMS["temperature_trend"]),
        ("activity.activity_intensity", act.get("activity_intensity"), EN_ENUMS["activity_intensity"]),
        ("activity.movement_pattern", act.get("movement_pattern"), EN_ENUMS["movement_pattern"]),
        ("trend.health_trajectory", tr.get("health_trajectory"), EN_ENUMS["health_trajectory"]),
    ]
    for name, val, allow in checks:
        if val not in allow:
            errs.append(f"{name}='{val}' not in {sorted(x for x in allow if x)}")
    return errs


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    url = f"http://localhost:{port}/analyze/sensor-data"
    langs = ["zh-cn", "en", "ja", "ko", "es", "fr", "de"]
    payload = build_payload()

    rows = []
    for lang in langs:
        body = {"payload_json": payload, "language": lang}
        resp = requests.post(url, json=body, timeout=60)
        data = resp.json()
        metrics = data.get("metrics", {})
        errs = validate_enums(metrics)
        rows.append({
            "lang": lang,
            "success": data.get("success"),
            "hr_zone": metrics.get("physical", {}).get("heart_rate_zone"),
            "temp_trend": metrics.get("physical", {}).get("temperature_trend"),
            "intensity": metrics.get("activity", {}).get("activity_intensity"),
            "movement": metrics.get("activity", {}).get("movement_pattern"),
            "trajectory": metrics.get("trend", {}).get("health_trajectory"),
            "enum_ok": (len(errs) == 0),
            "insight_sample": (data.get("insights", {}).get("highlights", [""])[0] if isinstance(data.get("insights", {}), dict) else ""),
        })

    print(json.dumps(rows, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()


