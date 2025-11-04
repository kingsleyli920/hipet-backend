import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

const AGENT_BASE_URL = process.env.AGENT_BASE_URL || 'http://localhost:8001';
const ANALYSIS_INTERVAL_MS = Number(process.env.ANALYSIS_WORKER_INTERVAL_MS || 3000);
const ANALYSIS_MAX_ATTEMPTS = Number(process.env.ANALYSIS_MAX_ATTEMPTS || 3);

async function callAgentAnalyze(payload: any, language = 'en', options: any = { conservative_fill: true, max_penalty: 0.25 }) {
  const resp = await fetch(`${AGENT_BASE_URL}/analyze/sensor-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload_json: payload, language, options })
  });
  if (!resp.ok) throw new Error(`Agent analyze failed: ${resp.status}`);
  return resp.json();
}

export default async function analysisRoutes(app: FastifyInstance): Promise<void> {
  // Background worker (lightweight DB polling)
  const startWorker = () => {
    app.log.info('Starting analysis worker...');
    const tick = async () => {
      try {
        const job = await prisma.analysisJob.findFirst({
          where: { status: { in: ['enqueued', 'failed'] }, attempts: { lt: ANALYSIS_MAX_ATTEMPTS } },
          orderBy: { createdAt: 'asc' }
        });
        if (!job) return;
        
        app.log.info({ jobId: job.id, sessionId: job.sessionId }, 'Processing analysis job');

        await prisma.analysisJob.update({ where: { id: job.id }, data: { status: 'processing', attempts: { increment: 1 } } });

        const session = await prisma.sensorDataSession.findUnique({
          where: { id: job.sessionId },
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
        if (!session) throw new Error('Session not found for analysis');

        // Build payload similar to device upload JSON
        const payload = {
          metadata: {
            device_id: session.device.deviceId,
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
            health_assessment: session.healthAssessment ? {
              overall_health_score: session.healthAssessment.overallHealthScore ?? undefined,
              vital_signs_stability: session.healthAssessment.vitalSignsStability ?? undefined,
              abnormalities_detected: session.healthAssessment.abnormalitiesDetected || [],
              trend_analysis: session.healthAssessment.trendAnalysis || 'stable'
            } : { overall_health_score: 7, vital_signs_stability: 7, abnormalities_detected: [], trend_analysis: 'stable' },
            behavior_analysis: session.behaviorAnalysis ? {
              activity_level: session.behaviorAnalysis.activityLevel ?? 5,
              mood_state: session.behaviorAnalysis.moodState ?? 5,
              behavior_pattern: session.behaviorAnalysis.behaviorPattern || 'normal_activity',
              unusual_behavior_detected: session.behaviorAnalysis.unusualBehaviorDetected || false
            } : { activity_level: 5, mood_state: 5, behavior_pattern: 'normal_activity', unusual_behavior_detected: false },
            media_analysis: {
              audio_events: (session.mediaAnalysis?.audioEvents || []).map(e => ({
                timestamp_offset: e.timestampOffset,
                event_type: e.eventType || 'unknown',
                duration_ms: e.durationMs || 0,
                emotional_tone: e.emotionalTone || 'neutral'
              })),
              video_analysis: (session.mediaAnalysis?.videoEvents || []).map(e => ({
                timestamp_offset: e.timestampOffset,
                movement_type: e.movementType || 'unknown',
                environment_changes: e.environmentChanges || 'unknown'
              }))
            }
          },
          summary_statistics: session.summaryStatistics ? {
            temperature_stats: {
              mean: session.summaryStatistics.temperatureMean ?? 0,
              min: session.summaryStatistics.temperatureMin ?? 0,
              max: session.summaryStatistics.temperatureMax ?? 0
            },
            heart_rate_stats: {
              mean: session.summaryStatistics.heartRateMean ?? 0,
              min: session.summaryStatistics.heartRateMin ?? 0,
              max: session.summaryStatistics.heartRateMax ?? 0
            }
          } : undefined,
          system_status: session.systemStatus ? {
            battery_level: session.systemStatus.batteryLevel ?? 0,
            memory_usage_percent: session.systemStatus.memoryUsagePercent ?? 0,
            storage_available_mb: session.systemStatus.storageAvailableMb ?? 0
          } : undefined
        };

        const result = await callAgentAnalyze(payload, 'en', { conservative_fill: true, max_penalty: 0.25 });
        app.log.info({ resultKeys: Object.keys(result) }, 'Agent analysis result received');

        const petId = session.device.bindings[0]?.petId || null;
        app.log.info({ petId, sessionId: session.id, deviceId: session.deviceId }, 'Creating sensor analysis record');

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
        app.log.info('Sensor analysis record created successfully');

        await prisma.analysisJob.update({ where: { id: job.id }, data: { status: 'succeeded', lastError: null } });
        app.log.info({ jobId: job.id }, 'Analysis job completed successfully');
      } catch (err: any) {
        app.log.error({ err: err?.message, jobId: job?.id }, 'analysis worker tick failed');
        if (job) {
          await prisma.analysisJob.update({ 
            where: { id: job.id }, 
            data: { status: 'failed', lastError: err?.message } 
          });
        }
      }
    };
    setInterval(tick, ANALYSIS_INTERVAL_MS);
  };
  startWorker();

  // Enqueue job manually (internal use or retry)
  app.post('/enqueue/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as any;
    await prisma.analysisJob.create({ data: { sessionId, status: 'enqueued' } });
    return reply.send({ success: true, message: 'enqueued' });
  });

  // List analysis
  app.get('/', { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const userId = request.user.userId;
    const { petId, deviceId, sessionId, limit = 20, offset = 0 } = request.query || {};

    // ACL: restrict to user's pets/devices
    const pets = await prisma.pet.findMany({ where: { ownerId: userId }, include: { deviceBindings: { select: { deviceId: true } } } });
    const allowedDeviceIds = new Set(pets.flatMap(p => p.deviceBindings.map(b => b.deviceId)));

    const where: any = {};
    if (sessionId) where.sessionId = sessionId;
    if (deviceId) where.deviceId = deviceId;
    if (petId) where.petId = petId;
    
    // Always apply device ACL filter
    if (allowedDeviceIds.size > 0) {
      where.deviceId = { in: Array.from(allowedDeviceIds) };
    } else {
      // User has no devices, return empty result
      return reply.send({ success: true, analyses: [], total: 0, limit: Number(limit), offset: Number(offset) });
    }

    const [rows, total] = await Promise.all([
      prisma.sensorAnalysis.findMany({ where, orderBy: { createdAt: 'desc' }, take: Number(limit), skip: Number(offset) }),
      prisma.sensorAnalysis.count({ where })
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

    const latest = await prisma.sensorAnalysis.findFirst({ where: { petId }, orderBy: { createdAt: 'desc' } });
    return reply.send({ success: true, analysis: latest });
  });
}


