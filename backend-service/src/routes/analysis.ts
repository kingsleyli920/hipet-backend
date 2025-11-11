import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

const AGENT_BASE_URL = process.env.AGENT_BASE_URL || 'http://localhost:8001';

/**
 * Call agent service to analyze sensor data
 * This function is used for synchronous analysis (no worker polling)
 */
async function callAgentAnalyze(payload: any, language = 'en', options: any = { conservative_fill: true, max_penalty: 0.25 }, app?: FastifyInstance) {
  const timeout = 120000; // 2 minutes timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    if (app) {
      app.log.info({ agentUrl: `${AGENT_BASE_URL}/analyze/sensor-data`, payloadSize: JSON.stringify(payload).length }, 'Calling agent service for analysis');
    }

    const resp = await fetch(`${AGENT_BASE_URL}/analyze/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload_json: payload, language, options }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'Unknown error');
      const error = new Error(`Agent analyze failed: ${resp.status} - ${errorText}`);
      if (app) {
        app.log.error({ status: resp.status, errorText, agentUrl: `${AGENT_BASE_URL}/analyze/sensor-data` }, 'Agent service returned error');
      }
      throw error;
    }

    const result = await resp.json();
    if (app) {
      app.log.info({ resultKeys: Object.keys(result), hasMetrics: !!result.metrics, hasInsights: !!result.insights }, 'Agent service response received');
    }
    return result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const error = new Error(`Agent analyze timeout after ${timeout}ms`);
      if (app) {
        app.log.error({ timeout, agentUrl: `${AGENT_BASE_URL}/analyze/sensor-data` }, 'Agent service request timeout');
      }
      throw error;
    }
    throw err;
  }
}

/**
 * Perform AI analysis on sensor data session
 * This is called synchronously when sensor data is received
 */
export async function performAnalysis(sessionId: string, app: FastifyInstance): Promise<void> {
  const startTime = Date.now();
  try {
    app.log.info({ sessionId }, 'Starting AI analysis');

    const session = await prisma.sensorDataSession.findUnique({
      where: { id: sessionId },
      include: {
        device: { include: { bindings: { where: { status: 'active' }, select: { petId: true } } } },
        vitalSignsSamples: true,
        motionSamples: true,
        healthAssessment: true,
        behaviorAnalysis: true,
        mediaAnalysis: { include: { audioEvents: true, videoEvents: true } },
        summaryStatistics: true,
        systemStatus: true,
      } as any
    });

    if (!session) {
      app.log.error({ sessionId }, 'Session not found for analysis');
      throw new Error('Session not found for analysis');
    }

    app.log.info({ 
      sessionId, 
      deviceId: (session as any).device?.deviceId,
      vitalSignsCount: session.vitalSignsSamples.length,
      motionCount: session.motionSamples.length
    }, 'Session data loaded for analysis');

        // Build payload similar to device upload JSON
    const deviceObj: any = (session as any).device;
    const ha: any = (session as any).healthAssessment;
    const ba: any = (session as any).behaviorAnalysis;
    const ma: any = (session as any).mediaAnalysis;
    const ss: any = (session as any).summaryStatistics;
    const sys: any = (session as any).systemStatus;
    
        const payload = {
          metadata: {
        device_id: deviceObj?.deviceId,
            session_id: session.sessionId,
            timestamp: new Date(session.timestamp).getTime(),
            firmware_version: session.firmwareVersion || undefined,
            data_interval_seconds: session.dataIntervalSeconds || undefined,
            upload_reason: session.uploadReason || undefined
          },
          raw_sensor_data: {
            vital_signs_samples: session.vitalSignsSamples.map(s => ({
              timestamp_offset: s.timestampOffset,
              temperature_c: s.temperatureC ?? undefined,
              heart_rate_bpm: s.heartRateBpm ?? undefined
            })),
            motion_samples: session.motionSamples.map(s => ({
              timestamp_offset: s.timestampOffset,
              acceleration: { x: s.accelerationX ?? 0, y: s.accelerationY ?? 0, z: s.accelerationZ ?? 0 },
              movement_intensity: s.movementIntensity ?? 0
            }))
          },
          offline_inference: {
        health_assessment: ha ? {
          overall_health_score: ha.overallHealthScore ?? undefined,
          vital_signs_stability: ha.vitalSignsStability ?? undefined,
          abnormalities_detected: ha.abnormalitiesDetected || [],
          trend_analysis: ha.trendAnalysis || 'stable'
            } : { overall_health_score: 7, vital_signs_stability: 7, abnormalities_detected: [], trend_analysis: 'stable' },
        behavior_analysis: ba ? {
          activity_level: ba.activityLevel ?? 5,
          mood_state: ba.moodState ?? 5,
          behavior_pattern: ba.behaviorPattern || 'normal_activity',
          unusual_behavior_detected: ba.unusualBehaviorDetected || false
            } : { activity_level: 5, mood_state: 5, behavior_pattern: 'normal_activity', unusual_behavior_detected: false },
            media_analysis: {
          audio_events: ((ma?.audioEvents) || []).map((e: any) => ({
                timestamp_offset: e.timestampOffset,
                event_type: e.eventType || 'unknown',
                duration_ms: e.durationMs || 0,
                emotional_tone: e.emotionalTone || 'neutral'
              })),
          video_analysis: ((ma?.videoEvents) || []).map((e: any) => ({
                timestamp_offset: e.timestampOffset,
                movement_type: e.movementType || 'unknown',
                environment_changes: e.environmentChanges || 'unknown'
              }))
            }
          },
      summary_statistics: ss ? {
            temperature_stats: {
          mean: ss.temperatureMean ?? 0,
          min: ss.temperatureMin ?? 0,
          max: ss.temperatureMax ?? 0
            },
            heart_rate_stats: {
          mean: ss.heartRateMean ?? 0,
          min: ss.heartRateMin ?? 0,
          max: ss.heartRateMax ?? 0
            }
          } : undefined,
      system_status: sys ? {
        battery_level: sys.batteryLevel ?? 0,
        memory_usage_percent: sys.memoryUsagePercent ?? 0,
        storage_available_mb: sys.storageAvailableMb ?? 0
          } : undefined
        };

    app.log.info({ sessionId, agentUrl: AGENT_BASE_URL }, 'Calling agent service...');
    const result = await callAgentAnalyze(payload, 'en', { conservative_fill: true, max_penalty: 0.25 }, app);
    app.log.info({ resultKeys: Object.keys(result), hasMetrics: !!result.metrics, hasInsights: !!result.insights }, 'Agent analysis result received');

    const petId = deviceObj?.bindings?.[0]?.petId || null;
    app.log.info({ petId, sessionId: session.id, deviceId: session.deviceId }, 'Creating sensor analysis record');

    // Check if analysis already exists (idempotency)
    const existingAnalysis = await (prisma as any).sensorAnalysis.findFirst({
      where: { sessionId: session.id }
    });

    if (existingAnalysis) {
      app.log.info({ sessionId: session.id, analysisId: existingAnalysis.id }, 'Analysis already exists, skipping create');
      return; // Analysis already exists, no need to create again
    }

    await (prisma as any).sensorAnalysis.create({
      data: {
        sessionId: session.id,
        deviceId: session.deviceId,
        petId: petId,
        metrics: result.metrics as any,
        metricsMeta: (result.metricsMeta || null) as any,
        insights: result.insights as any,
        confidence: Number((result.confidence ?? 0).toFixed(2)),
        model: process.env.AGENT_MODEL || 'genini',
        options: { conservative_fill: true, max_penalty: 0.25 } as any
      }
    });

    const elapsed = Date.now() - startTime;
    app.log.info({ sessionId, elapsedMs: elapsed }, 'AI analysis completed successfully');
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    app.log.error({ 
      err: err?.message, 
      errStack: err?.stack,
      sessionId, 
      elapsedMs: elapsed,
      agentUrl: AGENT_BASE_URL
    }, 'AI analysis failed');
    throw err;
  }
}

export default async function analysisRoutes(app: FastifyInstance): Promise<void> {
  // Worker polling removed - analysis is now synchronous when sensor data is received

  // Manual analysis trigger (for retry or manual analysis)
  app.post('/analyze/:sessionId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { sessionId } = request.params as any;
      const userId = request.user.userId;
      
      // Check if session exists and user has access
      const session = await prisma.sensorDataSession.findUnique({
        where: { id: sessionId },
        include: {
          device: {
            include: {
              bindings: {
                where: { status: 'active' },
                include: {
                  pet: {
                    select: { ownerId: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!session) {
        return reply.status(404).send({ success: false, error: 'Session not found' });
      }

      // Check if user has access to this session's device
      const hasAccess = session.device?.bindings?.some(b => b.pet.ownerId === userId);
      if (!hasAccess) {
        return reply.status(403).send({ success: false, error: 'Access denied' });
      }

      // Check if analysis already exists
      const existingAnalysis = await (prisma as any).sensorAnalysis.findFirst({
        where: { sessionId: sessionId }
      });

      if (existingAnalysis) {
        app.log.info({ sessionId, analysisId: existingAnalysis.id }, 'Analysis already exists, returning existing result');
        return reply.send({ 
          success: true, 
          message: 'Analysis already exists',
          analysis: existingAnalysis
        });
      }

      await performAnalysis(sessionId, app);
      return reply.send({ success: true, message: 'Analysis completed' });
    } catch (err: any) {
      app.log.error({ err: err?.message, errStack: err?.stack }, 'Manual analysis failed');
      return reply.status(500).send({ success: false, error: err?.message || 'Analysis failed' });
    }
  });

  // List analysis
  app.get('/', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const userId = request.user.userId;
    const { petId, deviceId, sessionId, limit = 20, offset = 0 } = request.query || {};

    const where: any = {};
    
    // If sessionId is provided, query by sessionId and verify ACL through session
    if (sessionId) {
      // Find session and verify user has access
      const session = await prisma.sensorDataSession.findUnique({
        where: { id: sessionId },
        include: {
          device: {
            include: {
              bindings: {
                where: { status: 'active' },
                include: {
                  pet: {
                    select: { ownerId: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!session) {
        return reply.send({ success: true, analyses: [], total: 0, limit: Number(limit), offset: Number(offset) });
      }

      // Check if user has access to this session's device
      const hasAccess = session.device?.bindings?.some(b => b.pet.ownerId === userId);
      if (!hasAccess) {
        return reply.send({ success: true, analyses: [], total: 0, limit: Number(limit), offset: Number(offset) });
      }

      // User has access, query by sessionId
      where.sessionId = sessionId;
    } else {
      // ACL: restrict to user's pets/devices
      const pets = await prisma.pet.findMany({ 
        where: { ownerId: userId }, 
        include: { deviceBindings: { select: { deviceId: true } } } 
      });
      const allowedDeviceIds = new Set(pets.flatMap(p => p.deviceBindings.map(b => b.deviceId)));

      if (deviceId) {
        // Verify device belongs to user
        if (!allowedDeviceIds.has(deviceId)) {
          return reply.send({ success: true, analyses: [], total: 0, limit: Number(limit), offset: Number(offset) });
        }
        where.deviceId = deviceId;
      } else if (petId) {
        // Verify pet belongs to user
        const pet = await prisma.pet.findFirst({
          where: { id: petId, ownerId: userId },
          include: { deviceBindings: { select: { deviceId: true } } }
        });
        if (!pet) {
          return reply.send({ success: true, analyses: [], total: 0, limit: Number(limit), offset: Number(offset) });
        }
        const petDeviceIds = new Set(pet.deviceBindings.map(b => b.deviceId));
        if (petDeviceIds.size > 0) {
          where.deviceId = { in: Array.from(petDeviceIds) };
        } else {
          return reply.send({ success: true, analyses: [], total: 0, limit: Number(limit), offset: Number(offset) });
        }
      } else {
        // No specific filter, apply device ACL
        if (allowedDeviceIds.size > 0) {
          where.deviceId = { in: Array.from(allowedDeviceIds) };
        } else {
          // User has no devices, return empty result
          return reply.send({ success: true, analyses: [], total: 0, limit: Number(limit), offset: Number(offset) });
        }
      }

      // Apply petId filter if provided (and not already filtered by device)
      if (petId && !where.deviceId) {
        where.petId = petId;
      }
    }

    const [rows, total] = await Promise.all([
      (prisma as any).sensorAnalysis.findMany({ where, orderBy: { createdAt: 'desc' }, take: Number(limit), skip: Number(offset) }),
      (prisma as any).sensorAnalysis.count({ where })
    ]);

    return reply.send({ success: true, analyses: rows, total, limit: Number(limit), offset: Number(offset) });
  });

  // Latest analysis for a pet
  app.get('/latest', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const userId = request.user.userId;
    const { petId } = request.query || {};
    if (!petId) return reply.status(400).send({ success: false, error: 'petId required' });

    const pet = await prisma.pet.findFirst({ where: { id: petId, ownerId: userId } });
    if (!pet) return reply.status(404).send({ success: false, error: 'Pet not found' });

    // Get device IDs for this pet
    const deviceBindings = await prisma.deviceBinding.findMany({
      where: { petId, status: 'active' },
      select: { deviceId: true }
    });
    const deviceIds = deviceBindings.map(b => b.deviceId);

    // Find latest analysis for this pet or its devices
    const latest = await (prisma as any).sensorAnalysis.findFirst({
      where: {
        OR: [
          { petId },
          ...(deviceIds.length > 0 ? [{ deviceId: { in: deviceIds } }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    // If no analysis found, return null instead of error
    return reply.send({ success: true, analysis: latest || null });
  });
}


