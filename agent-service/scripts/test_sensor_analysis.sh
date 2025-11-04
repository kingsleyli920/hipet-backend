#!/usr/bin/env bash
set -euo pipefail

PORT=${1:-8001}
URL="http://localhost:${PORT}/analyze/sensor-data"

read -r -d '' PAYLOAD <<'JSON'
{
  "metadata": {
    "device_id": "PET_MONITOR_001",
    "session_id": "sess_20240715143000",
    "timestamp": 1720256789000,
    "firmware_version": "2.1.0",
    "data_interval_seconds": 30,
    "upload_reason": "scheduled_upload"
  },
  "raw_sensor_data": {
    "vital_signs_samples": [
      { "timestamp_offset": 0, "temperature_c": 36.5, "heart_rate_bpm": 75 },
      { "timestamp_offset": 5000, "temperature_c": 36.6, "heart_rate_bpm": 76 },
      { "timestamp_offset": 10000, "temperature_c": 36.4, "heart_rate_bpm": 74 },
      { "timestamp_offset": 15000, "temperature_c": 36.7, "heart_rate_bpm": 78 },
      { "timestamp_offset": 20000, "temperature_c": 36.5, "heart_rate_bpm": 75 }
    ],
    "motion_samples": [
      {
        "timestamp_offset": 0,
        "acceleration": { "x": 0.12, "y": 0.98, "z": 9.81 },
        "movement_intensity": 0.15
      },
      {
        "timestamp_offset": 1000,
        "acceleration": { "x": 1.25, "y": 2.34, "z": 10.12 },
        "movement_intensity": 0.45
      }
    ]
  },
  "offline_inference": {
    "health_assessment": {
      "overall_health_score": 8,
      "vital_signs_stability": 7,
      "abnormalities_detected": ["slight_tachycardia"],
      "trend_analysis": "stable"
    },
    "behavior_analysis": {
      "activity_level": 6,
      "mood_state": 7,
      "behavior_pattern": "normal_activity",
      "unusual_behavior_detected": false
    },
    "media_analysis": {
      "audio_events": [
        { "timestamp_offset": 5000, "event_type": "barking", "duration_ms": 1200, "emotional_tone": "excited" },
        { "timestamp_offset": 12000, "event_type": "whining", "duration_ms": 800, "emotional_tone": "anxious" }
      ],
      "video_analysis": [
        { "timestamp_offset": 0, "movement_type": "walking", "environment_changes": "none" },
        { "timestamp_offset": 10000, "movement_type": "still", "environment_changes": "human_entered" }
      ]
    }
  },
  "summary_statistics": {
    "temperature_stats": { "mean": 36.54, "min": 36.4, "max": 36.7 },
    "heart_rate_stats": { "mean": 75.6, "min": 74, "max": 78 }
  },
  "system_status": {
    "battery_level": 78,
    "memory_usage_percent": 45,
    "storage_available_mb": 256
  }
}
JSON

langs=("zh-cn" "en" "ja" "ko" "es" "fr" "de")

echo "Testing Sensor Analysis API on ${URL}" >&2

for lang in "${langs[@]}"; do
  body=$(jq -nc --argjson p "${PAYLOAD}" --arg l "$lang" '{payload_json: $p, language: $l}')
  resp=$(curl -s -X POST "$URL" -H 'Content-Type: application/json' -d "$body")
  ok=$(echo "$resp" | jq -r '.success')
  hrz=$(echo "$resp" | jq -r '.metrics.physical.heart_rate_zone // ""')
  ttrend=$(echo "$resp" | jq -r '.metrics.physical.temperature_trend // ""')
  inten=$(echo "$resp" | jq -r '.metrics.activity.activity_intensity // ""')
  move=$(echo "$resp" | jq -r '.metrics.activity.movement_pattern // ""')
  traj=$(echo "$resp" | jq -r '.metrics.trend.health_trajectory // ""')
  insight_sample=$(echo "$resp" | jq -r '.insights.highlights[0] // ""')

  echo "{" \
       "\"lang\":\"$lang\"," \
       "\"success\":$ok," \
       "\"hr_zone\":\"$hrz\"," \
       "\"temp_trend\":\"$ttrend\"," \
       "\"intensity\":\"$inten\"," \
       "\"movement\":\"$move\"," \
       "\"trajectory\":\"$traj\"," \
       "\"insight_sample\":\"$insight_sample\"" \
       "}"
done | jq -s '.'


