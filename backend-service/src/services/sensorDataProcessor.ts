import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Shared validation schema for sensor data payload
export const sensorDataSchema = z.object({
  metadata: z.object({
    device_id: z.string().min(1),
    session_id: z.string().min(1),
    timestamp: z.number().positive(),
    firmware_version: z.string().optional(),
    data_interval_seconds: z.number().positive().optional(),
    upload_reason: z.enum(['scheduled_upload', 'event_triggered', 'manual']).optional()
  }),
  raw_sensor_data: z.object({
    vital_signs_samples: z.array(z.object({
      timestamp_offset: z.number().int(),
      temperature_c: z.number().optional(),
      heart_rate_bpm: z.number().int().positive().optional()
    })),
    motion_samples: z.array(z.object({
      timestamp_offset: z.number().int(),
      acceleration: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
      }),
      movement_intensity: z.number().min(0).max(1)
    }))
  }),
  offline_inference: z.object({
    health_assessment: z.object({
      overall_health_score: z.number().int().min(1).max(10),
      vital_signs_stability: z.number().int().min(1).max(10),
      abnormalities_detected: z.array(z.string()),
      trend_analysis: z.enum(['stable', 'improving', 'deteriorating'])
    }),
    behavior_analysis: z.object({
      activity_level: z.number().int().min(1).max(10),
      mood_state: z.number().int().min(1).max(10),
      behavior_pattern: z.string(),
      unusual_behavior_detected: z.boolean()
    }),
    media_analysis: z.object({
      audio_events: z.array(z.object({
        timestamp_offset: z.number().int(),
        event_type: z.string(),
        duration_ms: z.number().int().positive(),
        emotional_tone: z.string()
      })),
      video_analysis: z.array(z.object({
        timestamp_offset: z.number().int(),
        movement_type: z.string(),
        environment_changes: z.string()
      }))
    })
  }),
  summary_statistics: z.object({
    temperature_stats: z.object({
      mean: z.number(),
      min: z.number(),
      max: z.number()
    }),
    heart_rate_stats: z.object({
      mean: z.number(),
      min: z.number().int().positive(),
      max: z.number().int().positive()
    })
  }),
  system_status: z.object({
    battery_level: z.number().int().min(0).max(100),
    memory_usage_percent: z.number().int().min(0).max(100),
    storage_available_mb: z.number().int().min(0)
  })
});

export type SensorDataPayload = z.infer<typeof sensorDataSchema>;

export interface ProcessSensorDataContext {
  authenticatedDeviceId?: string | null;
  userId?: string | null;
}

export interface ProcessSensorDataResult {
  sessionId: string;
  alertsCount: number;
  deviceId: string;
}

/**
 * Core sensor data processing logic shared by HTTP route and MQTT consumer.
 * Validates payload, writes to database, updates device status, creates alerts
 * and triggers background AI analysis.
 */
export async function processSensorData(
  app: FastifyInstance,
  rawBody: unknown,
  context: ProcessSensorDataContext = {}
): Promise<ProcessSensorDataResult> {
  // Validate input
  const data = sensorDataSchema.parse(rawBody);
  const { metadata, raw_sensor_data, offline_inference, summary_statistics, system_status } = data;

  const { authenticatedDeviceId, userId } = context;

  app.log.info(
    {
      deviceId: metadata.device_id,
      sessionId: metadata.session_id,
      timestamp: metadata.timestamp,
      authType: authenticatedDeviceId ? 'device' : userId ? 'user' : 'none'
    },
    'Processing sensor data'
  );

  // If device token was used, verify deviceId matches
  if (authenticatedDeviceId && authenticatedDeviceId !== metadata.device_id) {
    const err: any = new Error('Device ID mismatch');
    err.statusCode = 403;
    err.code = 'DEVICE_ID_MISMATCH';
    err.details = {
      tokenDeviceId: authenticatedDeviceId,
      requestDeviceId: metadata.device_id
    };
    throw err;
  }

  // Check device exists
  const device = await prisma.device.findUnique({
    where: { deviceId: metadata.device_id }
  });

  if (!device) {
    const err: any = new Error(`Device with ID ${metadata.device_id} not found`);
    err.statusCode = 404;
    err.code = 'DEVICE_NOT_FOUND';
    throw err;
  }

  // Check session not duplicated
  const existingSession = await prisma.sensorDataSession.findUnique({
    where: { sessionId: metadata.session_id }
  });

  if (existingSession) {
    const err: any = new Error(`Session ${metadata.session_id} already exists`);
    err.statusCode = 409;
    err.code = 'SESSION_EXISTS';
    err.details = { sessionId: existingSession.id };
    throw err;
  }

  // Transactional writes
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create session
    const session = await tx.sensorDataSession.create({
      data: {
        deviceId: device.id,
        sessionId: metadata.session_id,
        timestamp: new Date(metadata.timestamp),
        firmwareVersion: metadata.firmware_version,
        dataIntervalSeconds: metadata.data_interval_seconds,
        uploadReason: metadata.upload_reason
      }
    });

    // 2. Vital signs
    if (raw_sensor_data.vital_signs_samples.length > 0) {
      await tx.vitalSignsSample.createMany({
        data: raw_sensor_data.vital_signs_samples.map((sample) => ({
          sessionId: session.id,
          timestampOffset: sample.timestamp_offset,
          temperatureC: sample.temperature_c,
          heartRateBpm: sample.heart_rate_bpm
        }))
      });
    }

    // 3. Motion samples
    if (raw_sensor_data.motion_samples.length > 0) {
      await tx.motionSample.createMany({
        data: raw_sensor_data.motion_samples.map((sample) => ({
          sessionId: session.id,
          timestampOffset: sample.timestamp_offset,
          accelerationX: sample.acceleration.x,
          accelerationY: sample.acceleration.y,
          accelerationZ: sample.acceleration.z,
          movementIntensity: sample.movement_intensity
        }))
      });
    }

    // 4. Health assessment
    await tx.healthAssessment.create({
      data: {
        sessionId: session.id,
        overallHealthScore: offline_inference.health_assessment.overall_health_score,
        vitalSignsStability: offline_inference.health_assessment.vital_signs_stability,
        abnormalitiesDetected: offline_inference.health_assessment.abnormalities_detected,
        trendAnalysis: offline_inference.health_assessment.trend_analysis
      }
    });

    // 5. Behavior analysis
    await tx.behaviorAnalysis.create({
      data: {
        sessionId: session.id,
        activityLevel: offline_inference.behavior_analysis.activity_level,
        moodState: offline_inference.behavior_analysis.mood_state,
        behaviorPattern: offline_inference.behavior_analysis.behavior_pattern,
        unusualBehaviorDetected: offline_inference.behavior_analysis.unusual_behavior_detected
      }
    });

    // 6. Media analysis
    if (
      offline_inference.media_analysis.audio_events.length > 0 ||
      offline_inference.media_analysis.video_analysis.length > 0
    ) {
      const mediaAnalysis = await tx.mediaAnalysis.create({
        data: {
          sessionId: session.id
        }
      });

      if (offline_inference.media_analysis.audio_events.length > 0) {
        await tx.audioEvent.createMany({
          data: offline_inference.media_analysis.audio_events.map((event) => ({
            mediaAnalysisId: mediaAnalysis.id,
            timestampOffset: event.timestamp_offset,
            eventType: event.event_type,
            durationMs: event.duration_ms,
            emotionalTone: event.emotional_tone
          }))
        });
      }

      if (offline_inference.media_analysis.video_analysis.length > 0) {
        await tx.videoEvent.createMany({
          data: offline_inference.media_analysis.video_analysis.map((event) => ({
            mediaAnalysisId: mediaAnalysis.id,
            timestampOffset: event.timestamp_offset,
            movementType: event.movement_type,
            environmentChanges: event.environment_changes
          }))
        });
      }
    }

    // 7. Summary statistics
    await tx.summaryStatistics.create({
      data: {
        sessionId: session.id,
        temperatureMean: summary_statistics.temperature_stats.mean,
        temperatureMin: summary_statistics.temperature_stats.min,
        temperatureMax: summary_statistics.temperature_stats.max,
        heartRateMean: summary_statistics.heart_rate_stats.mean,
        heartRateMin: summary_statistics.heart_rate_stats.min,
        heartRateMax: summary_statistics.heart_rate_stats.max
      }
    });

    // 8. System status
    await tx.systemStatus.create({
      data: {
        sessionId: session.id,
        batteryLevel: system_status.battery_level,
        memoryUsagePercent: system_status.memory_usage_percent,
        storageAvailableMb: system_status.storage_available_mb
      }
    });

    // 9. Update device status
    await tx.device.update({
      where: { id: device.id },
      data: {
        lastOnlineAt: new Date(),
        lastSyncAt: new Date(),
        batteryLevel: system_status.battery_level,
        status: 'active'
      }
    });

    // 10. Alerts
    const alerts = [];

    if (offline_inference.health_assessment.abnormalities_detected.length > 0) {
      for (const abnormality of offline_inference.health_assessment.abnormalities_detected) {
        const alert = await tx.healthAlert.create({
          data: {
            sessionId: session.id,
            deviceId: device.id,
            alertType: 'health_anomaly',
            severity: 'warning',
            message: `Health anomaly detected: ${abnormality}`,
            data: { abnormality, healthScore: offline_inference.health_assessment.overall_health_score }
          } as any
        });
        alerts.push(alert);
      }
    }

    if (system_status.battery_level < 20) {
      const alert = await tx.healthAlert.create({
        data: {
          sessionId: session.id,
          deviceId: device.id,
          alertType: 'battery_low',
          severity: system_status.battery_level < 10 ? 'critical' : 'warning',
          message: `Battery level is ${system_status.battery_level}%`,
          data: { batteryLevel: system_status.battery_level }
        } as any
      });
      alerts.push(alert);
    }

    if (offline_inference.behavior_analysis.unusual_behavior_detected) {
      const alert = await tx.healthAlert.create({
        data: {
          sessionId: session.id,
          deviceId: device.id,
          alertType: 'unusual_behavior',
          severity: 'warning',
          message: 'Unusual behavior pattern detected',
          data: {
            behaviorPattern: offline_inference.behavior_analysis.behavior_pattern,
            activityLevel: offline_inference.behavior_analysis.activity_level,
            moodState: offline_inference.behavior_analysis.mood_state
          }
        } as any
      });
      alerts.push(alert);
    }

    return { session, alerts };
  });

  app.log.info(
    {
      sessionId: result.session.id,
      alertsCount: result.alerts.length,
      deviceId: metadata.device_id
    },
    'Sensor data processed successfully'
  );

  // Fire-and-forget AI analysis
  const { performAnalysis } = await import('../routes/analysis.js');
  performAnalysis(result.session.id, app).catch((err: any) => {
    app.log.error(
      {
        err: err?.message,
        errStack: err?.stack,
        sessionId: result.session.id,
        agentUrl: process.env.AGENT_BASE_URL || 'http://localhost:8001'
      },
      'Background AI analysis failed - check agent service logs'
    );
  });

  return {
    sessionId: result.session.id,
    alertsCount: result.alerts.length,
    deviceId: metadata.device_id
  };
}


