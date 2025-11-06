import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

const AGENT_BASE_URL = process.env.AGENT_BASE_URL || 'http://localhost:8001';
const BASE_INTERVAL_MS = Number(process.env.ANALYSIS_WORKER_INTERVAL_MS || 5000);
const MAX_BACKOFF_MS = Number(process.env.ANALYSIS_WORKER_MAX_MS || 30000);
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
    let currentInterval = BASE_INTERVAL_MS;
    const scheduleNext = () => setTimeout(tick, currentInterval);
    const tick = async () => {
      let job: any | null = null;
      try {
        job = await prisma.analysisJob.findFirst({
          where: { status: { in: ['enqueued', 'failed'] }, attempts: { lt: ANALYSIS_MAX_ATTEMPTS } },
          orderBy: { createdAt: 'asc' }
        });
        if (!job) {
          // idle backoff: 放大间隔，直到上限
          currentInterval = Math.min(currentInterval * 2, MAX_BACKOFF_MS);
          return scheduleNext();
        }

        // 有任务：恢复基础间隔，并输出简洁日志
        currentInterval = BASE_INTERVAL_MS;
        app.log.info({ jobId: job.id }, 'Processing analysis job');

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

        const result = await callAgentAnalyze(payload, 'en', { conservative_fill: true, max_penalty: 0.25 });
        app.log.info({ resultKeys: Object.keys(result) }, 'Agent analysis result received');

        const petId = deviceObj?.bindings?.[0]?.petId || null;
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
        app.log.error({ err: err?.message, jobId: job?.id || null }, 'analysis worker tick failed');
        if (job?.id) {
          await prisma.analysisJob.update({ 
            where: { id: job.id }, 
            data: { status: 'failed', lastError: err?.message } 
          });
        }
      } finally {
        scheduleNext();
      }
    };
    scheduleNext();
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


