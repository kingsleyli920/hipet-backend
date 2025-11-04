import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import type { 
  SensorDataRequest, 
  SensorDataResponse, 
  MonitoringStatusResponse,
  AuthenticatedRequest 
} from '../types';

// Validation schemas
const sensorDataSchema = z.object({
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

export default async function hardwareRoutes(app: FastifyInstance): Promise<void> {
  // 传感器数据接收接口
  app.post('/sensor-data', {
    schema: {
      body: {
        type: 'object',
        required: ['metadata', 'raw_sensor_data', 'offline_inference', 'summary_statistics', 'system_status'],
        properties: {
          metadata: { type: 'object' },
          raw_sensor_data: { type: 'object' },
          offline_inference: { type: 'object' },
          summary_statistics: { type: 'object' },
          system_status: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // 验证请求数据
      const data = sensorDataSchema.parse(request.body);
      const { metadata, raw_sensor_data, offline_inference, summary_statistics, system_status } = data;

      app.log.info({ 
        deviceId: metadata.device_id, 
        sessionId: metadata.session_id,
        timestamp: metadata.timestamp 
      }, 'Processing sensor data');

      // 检查设备是否存在
      const device = await prisma.device.findUnique({
        where: { deviceId: metadata.device_id }
      });

      if (!device) {
        app.log.warn({ deviceId: metadata.device_id }, 'Device not found');
        return reply.status(404).send({
          success: false,
          error: 'Device not found',
          message: `Device with ID ${metadata.device_id} not found`
        });
      }

      // 检查会话是否已存在
      const existingSession = await prisma.sensorDataSession.findUnique({
        where: { sessionId: metadata.session_id }
      });

      if (existingSession) {
        app.log.warn({ sessionId: metadata.session_id }, 'Session already exists');
        return reply.status(409).send({
          success: false,
          error: 'Session already exists',
          message: `Session ${metadata.session_id} already exists`,
          sessionId: existingSession.id
        });
      }

      // 开始事务处理
      const result = await prisma.$transaction(async (tx) => {
        // 1. 创建传感器数据会话
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

        // 2. 存储生命体征样本
        if (raw_sensor_data.vital_signs_samples.length > 0) {
          await tx.vitalSignsSample.createMany({
            data: raw_sensor_data.vital_signs_samples.map(sample => ({
              sessionId: session.id,
              timestampOffset: sample.timestamp_offset,
              temperatureC: sample.temperature_c,
              heartRateBpm: sample.heart_rate_bpm
            }))
          });
        }

        // 3. 存储运动样本
        if (raw_sensor_data.motion_samples.length > 0) {
          await tx.motionSample.createMany({
            data: raw_sensor_data.motion_samples.map(sample => ({
              sessionId: session.id,
              timestampOffset: sample.timestamp_offset,
              accelerationX: sample.acceleration.x,
              accelerationY: sample.acceleration.y,
              accelerationZ: sample.acceleration.z,
              movementIntensity: sample.movement_intensity
            }))
          });
        }

        // 4. 存储健康评估
        await tx.healthAssessment.create({
          data: {
            sessionId: session.id,
            overallHealthScore: offline_inference.health_assessment.overall_health_score,
            vitalSignsStability: offline_inference.health_assessment.vital_signs_stability,
            abnormalitiesDetected: offline_inference.health_assessment.abnormalities_detected,
            trendAnalysis: offline_inference.health_assessment.trend_analysis
          }
        });

        // 5. 存储行为分析
        await tx.behaviorAnalysis.create({
          data: {
            sessionId: session.id,
            activityLevel: offline_inference.behavior_analysis.activity_level,
            moodState: offline_inference.behavior_analysis.mood_state,
            behaviorPattern: offline_inference.behavior_analysis.behavior_pattern,
            unusualBehaviorDetected: offline_inference.behavior_analysis.unusual_behavior_detected
          }
        });

        // 6. 存储媒体分析
        if (offline_inference.media_analysis.audio_events.length > 0 || 
            offline_inference.media_analysis.video_analysis.length > 0) {
          const mediaAnalysis = await tx.mediaAnalysis.create({
            data: {
              sessionId: session.id
            }
          });

          // 存储音频事件
          if (offline_inference.media_analysis.audio_events.length > 0) {
            await tx.audioEvent.createMany({
              data: offline_inference.media_analysis.audio_events.map(event => ({
                mediaAnalysisId: mediaAnalysis.id,
                timestampOffset: event.timestamp_offset,
                eventType: event.event_type,
                durationMs: event.duration_ms,
                emotionalTone: event.emotional_tone
              }))
            });
          }

          // 存储视频事件
          if (offline_inference.media_analysis.video_analysis.length > 0) {
            await tx.videoEvent.createMany({
              data: offline_inference.media_analysis.video_analysis.map(event => ({
                mediaAnalysisId: mediaAnalysis.id,
                timestampOffset: event.timestamp_offset,
                movementType: event.movement_type,
                environmentChanges: event.environment_changes
              }))
            });
          }
        }

        // 7. 存储统计摘要
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

        // 8. 存储系统状态
        await tx.systemStatus.create({
          data: {
            sessionId: session.id,
            batteryLevel: system_status.battery_level,
            memoryUsagePercent: system_status.memory_usage_percent,
            storageAvailableMb: system_status.storage_available_mb
          }
        });

        // 9. 更新设备状态
        await tx.device.update({
          where: { id: device.id },
          data: {
            lastOnlineAt: new Date(),
            lastSyncAt: new Date(),
            batteryLevel: system_status.battery_level,
            status: 'active'
          }
        });

        // 10. 生成健康警报
        const alerts = [];
        
        // 检查异常情况
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

        // 检查电池电量
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

        // 检查异常行为
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

        // 11. 创建AI分析任务
        await (tx as any).analysisJob.create({
          data: {
            sessionId: session.id,
            status: 'enqueued'
          }
        });

        return { session, alerts };
      });

      app.log.info({ 
        sessionId: result.session.id,
        alertsCount: result.alerts.length,
        deviceId: metadata.device_id 
      }, 'Sensor data processed successfully');

      const response: SensorDataResponse = {
        success: true,
        message: 'Sensor data processed successfully',
        sessionId: result.session.id,
        ts: new Date().toISOString()
      };

      return reply.status(201).send(response);

    } catch (error) {
      app.log.error({ error: error.message, stack: error.stack }, 'Sensor data processing failed');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          message: 'Invalid sensor data format',
          details: error.errors
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process sensor data'
      });
    }
  });

  // 监控状态查询接口
  app.get('/monitoring-status', {
    preHandler: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;

      // 获取用户的所有设备（通过宠物绑定）
      const pets = await prisma.pet.findMany({
        where: { ownerId: userId },
        include: {
          deviceBindings: {
            where: { status: 'active' },
            include: {
              device: true
            }
          }
        }
      });

      const activeDevices = [];
      const deviceMap = new Map();

      for (const pet of pets) {
        for (const binding of pet.deviceBindings) {
          if (!deviceMap.has(binding.device.id)) {
            deviceMap.set(binding.device.id, {
              deviceId: binding.device.deviceId,
              deviceType: binding.device.deviceType,
              status: binding.device.status,
              batteryLevel: binding.device.batteryLevel,
              lastOnlineAt: binding.device.lastOnlineAt?.toISOString(),
              boundPets: []
            });
          }
          
          deviceMap.get(binding.device.id).boundPets.push({
            petId: pet.id,
            petName: pet.name
          });
        }
      }

      const response: MonitoringStatusResponse = {
        success: true,
        active_devices: Array.from(deviceMap.values()),
        monitoring_count: deviceMap.size,
        ts: new Date().toISOString()
      };

      return reply.send(response);

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get monitoring status');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get monitoring status'
      });
    }
  });

  // 设备类型查询接口
  app.get('/device-types', async () => ({
    supported_types: [
      { 
        type: 'heart_rate', 
        description: '心率监测器',
        data_format: '心率(2字节) + 置信度(1字节) + 电池(1字节)'
      },
      { 
        type: 'temperature', 
        description: '体温监测器',
        data_format: '温度(2字节) + 置信度(1字节) + 电池(1字节)'
      },
      { 
        type: 'activity', 
        description: '活动监测器',
        data_format: '活动量(2字节) + 步数(4字节) + 置信度(1字节) + 电池(1字节)'
      },
      { 
        type: 'location', 
        description: '位置追踪器',
        data_format: '纬度(4字节) + 经度(4字节) + 精度(2字节) + 电池(1字节)'
      },
      { 
        type: 'battery', 
        description: '电池状态监测器',
        data_format: '电池电量(1字节) + 充电状态(1字节) + 温度(2字节)'
      }
    ],
    data_header_format: '数据类型(4字节) + 时间戳(4字节) + 数据长度(4字节)',
    ts: new Date().toISOString()
  }));

  // 异常检测阈值查询接口
  app.get('/anomaly-thresholds', async () => ({
    thresholds: {
      temperature: {
        normal_min: 36.0,
        normal_max: 39.5,
        warning_min: 35.0,
        warning_max: 40.5,
        critical_min: 34.0,
        critical_max: 41.5
      },
      heart_rate: {
        normal_min: 60,
        normal_max: 120,
        warning_min: 50,
        warning_max: 140,
        critical_min: 40,
        critical_max: 160
      },
      battery_level: {
        warning: 20,
        critical: 10
      },
      activity_level: {
        low_threshold: 3,
        high_threshold: 8
      }
    },
    ts: new Date().toISOString()
  }));

  // 批量数据接收接口（占位）
  app.post('/batch-data', async (request) => {
    app.log.info({ path: '/hardware/batch-data', payload: request.body }, 'batch-data placeholder');
    return { success: true, message: 'batch-data received (placeholder)', ts: new Date().toISOString() };
  });

  // 开始监控接口（占位）
  app.post('/start-monitoring', async (request) => {
    app.log.info({ path: '/hardware/start-monitoring', payload: request.body }, 'start-monitoring placeholder');
    return { success: true, message: 'start-monitoring scheduled (placeholder)', ts: new Date().toISOString() };
  });

  // 停止监控接口（占位）
  app.post('/stop-monitoring', async (request) => {
    app.log.info({ path: '/hardware/stop-monitoring', payload: request.body }, 'stop-monitoring placeholder');
    return { success: true, message: 'stop-monitoring scheduled (placeholder)', ts: new Date().toISOString() };
  });

  // 流式传感器数据接口（占位）
  app.post('/stream-sensor-data', async (request) => {
    app.log.info({ path: '/hardware/stream-sensor-data', payload: request.body }, 'stream-sensor-data placeholder');
    return { success: true, message: 'stream-sensor-data received (placeholder)', ts: new Date().toISOString() };
  });

  // ============================================
  // 传感器数据查询API
  // ============================================

  // 获取传感器数据会话列表
  app.get('/sensor-data/sessions', {
    preHandler: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          petId: { type: 'string' },
          deviceId: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { petId, deviceId, startDate, endDate, limit = 50, offset = 0 } = request.query as any;

      // 构建查询条件
      const where: any = {};
      
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }

      if (deviceId) {
        where.device = { deviceId };
      }

      // 如果指定了petId，需要通过设备绑定来过滤
      if (petId) {
        // 验证pet属于当前用户
        const pet = await prisma.pet.findFirst({
          where: { id: petId, ownerId: userId }
        });

        if (!pet) {
          return reply.status(404).send({
            success: false,
            error: 'Pet not found',
            message: 'Pet not found or does not belong to you'
          });
        }

        // 获取该宠物的设备绑定
        const bindings = await prisma.deviceBinding.findMany({
          where: { petId, status: 'active' },
          select: { deviceId: true }
        });

        if (bindings.length === 0) {
          return reply.send({
            success: true,
            sessions: [],
            total: 0,
            limit,
            offset
          });
        }

        where.deviceId = { in: bindings.map(b => b.deviceId) };
      } else {
        // 如果没有指定petId，获取用户所有宠物的设备
        const pets = await prisma.pet.findMany({
          where: { ownerId: userId },
          include: {
            deviceBindings: {
              where: { status: 'active' },
              select: { deviceId: true }
            }
          }
        });

        const deviceIds = pets.flatMap(pet => 
          pet.deviceBindings.map(binding => binding.deviceId)
        );

        if (deviceIds.length === 0) {
          return reply.send({
            success: true,
            sessions: [],
            total: 0,
            limit,
            offset
          });
        }

        where.deviceId = { in: deviceIds };
      }

      // 查询会话
      const [sessions, total] = await Promise.all([
        prisma.sensorDataSession.findMany({
          where,
          include: {
            device: {
              select: {
                id: true,
                deviceId: true,
                deviceType: true,
                model: true
              }
            },
            healthAssessment: true,
            behaviorAnalysis: true,
            summaryStatistics: true,
            systemStatus: true,
            _count: {
              select: {
                vitalSignsSamples: true,
                motionSamples: true
              }
            }
          },
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.sensorDataSession.count({ where })
      ]);

      return reply.send({
        success: true,
        sessions: sessions.map(session => ({
          id: session.id,
          sessionId: session.sessionId,
          device: session.device,
          timestamp: session.timestamp,
          firmwareVersion: session.firmwareVersion,
          dataIntervalSeconds: session.dataIntervalSeconds,
          uploadReason: session.uploadReason,
          healthAssessment: session.healthAssessment,
          behaviorAnalysis: session.behaviorAnalysis,
          summaryStatistics: session.summaryStatistics,
          systemStatus: session.systemStatus,
          sampleCounts: session._count,
          createdAt: session.createdAt
        })),
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get sensor data sessions');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get sensor data sessions'
      });
    }
  });

  // 获取单个传感器数据会话详情
  app.get('/sensor-data/sessions/:sessionId', {
    preHandler: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { sessionId } = request.params as any;

      const session = await prisma.sensorDataSession.findUnique({
        where: { id: sessionId },
        include: {
          device: {
            include: {
              bindings: {
                where: { status: 'active' },
                include: {
                  pet: {
                    select: {
                      id: true,
                      name: true,
                      ownerId: true
                    }
                  }
                }
              }
            }
          },
          vitalSignsSamples: {
            orderBy: { timestampOffset: 'asc' }
          },
          motionSamples: {
            orderBy: { timestampOffset: 'asc' }
          },
          healthAssessment: true,
          behaviorAnalysis: true,
          mediaAnalysis: {
            include: {
              audioEvents: {
                orderBy: { timestampOffset: 'asc' }
              },
              videoEvents: {
                orderBy: { timestampOffset: 'asc' }
              }
            }
          },
          summaryStatistics: true,
          systemStatus: true,
          healthAlerts: {
            orderBy: { createdAt: 'desc' }
          }
        } as any
      });

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: 'Session not found',
          message: 'Sensor data session not found'
        });
      }

      // 检查用户是否有权限访问此会话
      const hasAccess = (session as any).device.bindings.some((binding: any) => 
        binding.pet.ownerId === userId
      );

      if (!hasAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this session'
        });
      }

      return reply.send({
        success: true,
        session: {
          id: session.id,
          sessionId: session.sessionId,
          device: {
            id: (session as any).device.id,
            deviceId: (session as any).device.deviceId,
            deviceType: (session as any).device.deviceType,
            model: (session as any).device.model
          },
          timestamp: session.timestamp,
          firmwareVersion: session.firmwareVersion,
          dataIntervalSeconds: session.dataIntervalSeconds,
          uploadReason: session.uploadReason,
          vitalSignsSamples: (session as any).vitalSignsSamples,
          motionSamples: (session as any).motionSamples,
          healthAssessment: (session as any).healthAssessment,
          behaviorAnalysis: (session as any).behaviorAnalysis,
          mediaAnalysis: (session as any).mediaAnalysis,
          summaryStatistics: (session as any).summaryStatistics,
          systemStatus: (session as any).systemStatus,
          healthAlerts: (session as any).healthAlerts,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get sensor data session');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get sensor data session'
      });
    }
  });

  // 获取生命体征样本数据
  app.get('/sensor-data/vital-signs', {
    preHandler: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          petId: { type: 'string' },
          deviceId: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { sessionId, petId, deviceId, startDate, endDate, limit = 100, offset = 0 } = request.query as any;

      // 构建查询条件
      const where: any = {};

      if (sessionId) {
        where.sessionId = sessionId;
      } else {
        // 构建会话查询条件
        const sessionWhere: any = {};
        
        if (startDate || endDate) {
          sessionWhere.timestamp = {};
          if (startDate) sessionWhere.timestamp.gte = new Date(startDate);
          if (endDate) sessionWhere.timestamp.lte = new Date(endDate);
        }

        if (deviceId) {
          sessionWhere.device = { deviceId };
        }

        if (petId) {
          // 验证pet属于当前用户
          const pet = await prisma.pet.findFirst({
            where: { id: petId, ownerId: userId }
          });

          if (!pet) {
            return reply.status(404).send({
              success: false,
              error: 'Pet not found',
              message: 'Pet not found or does not belong to you'
            });
          }

          // 获取该宠物的设备绑定
          const bindings = await prisma.deviceBinding.findMany({
            where: { petId, status: 'active' },
            select: { deviceId: true }
          });

          if (bindings.length === 0) {
            return reply.send({
              success: true,
              samples: [],
              total: 0,
              limit,
              offset
            });
          }

          sessionWhere.deviceId = { in: bindings.map(b => b.deviceId) };
        } else if (!deviceId) {
          // 获取用户所有宠物的设备
          const pets = await prisma.pet.findMany({
            where: { ownerId: userId },
            include: {
              deviceBindings: {
                where: { status: 'active' },
                select: { deviceId: true }
              }
            }
          });

          const deviceIds = pets.flatMap(pet => 
            pet.deviceBindings.map(binding => binding.deviceId)
          );

          if (deviceIds.length === 0) {
            return reply.send({
              success: true,
              samples: [],
              total: 0,
              limit,
              offset
            });
          }

          sessionWhere.deviceId = { in: deviceIds };
        }

        where.session = sessionWhere;
      }

      // 查询生命体征样本
      const [samples, total] = await Promise.all([
        prisma.vitalSignsSample.findMany({
          where,
          include: {
            session: {
              include: {
                device: {
                  select: {
                    id: true,
                    deviceId: true,
                    deviceType: true
                  }
                }
              }
            }
          },
          orderBy: [
            { session: { timestamp: 'desc' } },
            { timestampOffset: 'asc' }
          ],
          take: limit,
          skip: offset
        }),
        prisma.vitalSignsSample.count({ where })
      ]);

      return reply.send({
        success: true,
        samples: samples.map(sample => ({
          id: sample.id,
          sessionId: sample.sessionId,
          device: sample.session.device,
          timestamp: sample.session.timestamp,
          timestampOffset: sample.timestampOffset,
          temperatureC: sample.temperatureC,
          heartRateBpm: sample.heartRateBpm,
          createdAt: sample.createdAt
        })),
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get vital signs data');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get vital signs data'
      });
    }
  });

  // 获取运动样本数据
  app.get('/sensor-data/motion', {
    preHandler: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          petId: { type: 'string' },
          deviceId: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { sessionId, petId, deviceId, startDate, endDate, limit = 100, offset = 0 } = request.query as any;

      // 构建查询条件（与生命体征查询逻辑相同）
      const where: any = {};

      if (sessionId) {
        where.sessionId = sessionId;
      } else {
        const sessionWhere: any = {};
        
        if (startDate || endDate) {
          sessionWhere.timestamp = {};
          if (startDate) sessionWhere.timestamp.gte = new Date(startDate);
          if (endDate) sessionWhere.timestamp.lte = new Date(endDate);
        }

        if (deviceId) {
          sessionWhere.device = { deviceId };
        }

        if (petId) {
          const pet = await prisma.pet.findFirst({
            where: { id: petId, ownerId: userId }
          });

          if (!pet) {
            return reply.status(404).send({
              success: false,
              error: 'Pet not found',
              message: 'Pet not found or does not belong to you'
            });
          }

          const bindings = await prisma.deviceBinding.findMany({
            where: { petId, status: 'active' },
            select: { deviceId: true }
          });

          if (bindings.length === 0) {
            return reply.send({
              success: true,
              samples: [],
              total: 0,
              limit,
              offset
            });
          }

          sessionWhere.deviceId = { in: bindings.map(b => b.deviceId) };
        } else if (!deviceId) {
          const pets = await prisma.pet.findMany({
            where: { ownerId: userId },
            include: {
              deviceBindings: {
                where: { status: 'active' },
                select: { deviceId: true }
              }
            }
          });

          const deviceIds = pets.flatMap(pet => 
            pet.deviceBindings.map(binding => binding.deviceId)
          );

          if (deviceIds.length === 0) {
            return reply.send({
              success: true,
              samples: [],
              total: 0,
              limit,
              offset
            });
          }

          sessionWhere.deviceId = { in: deviceIds };
        }

        where.session = sessionWhere;
      }

      // 查询运动样本
      const [samples, total] = await Promise.all([
        prisma.motionSample.findMany({
          where,
          include: {
            session: {
              include: {
                device: {
                  select: {
                    id: true,
                    deviceId: true,
                    deviceType: true
                  }
                }
              }
            }
          },
          orderBy: [
            { session: { timestamp: 'desc' } },
            { timestampOffset: 'asc' }
          ],
          take: limit,
          skip: offset
        }),
        prisma.motionSample.count({ where })
      ]);

      return reply.send({
        success: true,
        samples: samples.map(sample => ({
          id: sample.id,
          sessionId: sample.sessionId,
          device: sample.session.device,
          timestamp: sample.session.timestamp,
          timestampOffset: sample.timestampOffset,
          acceleration: {
            x: sample.accelerationX,
            y: sample.accelerationY,
            z: sample.accelerationZ
          },
          movementIntensity: sample.movementIntensity,
          createdAt: sample.createdAt
        })),
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get motion data');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get motion data'
      });
    }
  });

  // 获取健康数据统计
  app.get('/sensor-data/stats/health', {
    preHandler: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          petId: { type: 'string' },
          deviceId: { type: 'string' },
          days: { type: 'integer', minimum: 1, maximum: 365, default: 7 }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { petId, deviceId, days = 7 } = request.query as any;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 构建查询条件
      const where: any = {
        timestamp: { gte: startDate }
      };

      if (deviceId) {
        where.device = { deviceId };
      }

      if (petId) {
        // 验证pet属于当前用户
        const pet = await prisma.pet.findFirst({
          where: { id: petId, ownerId: userId }
        });

        if (!pet) {
          return reply.status(404).send({
            success: false,
            error: 'Pet not found',
            message: 'Pet not found or does not belong to you'
          });
        }

        // 获取该宠物的设备绑定
        const bindings = await prisma.deviceBinding.findMany({
          where: { petId, status: 'active' },
          select: { deviceId: true }
        });

        if (bindings.length === 0) {
          return reply.send({
            success: true,
            stats: {
              temperature: { avg: null, min: null, max: null, count: 0 },
              heartRate: { avg: null, min: null, max: null, count: 0 },
              activity: { avg: null, min: null, max: null, count: 0 },
              healthScore: { avg: null, min: null, max: null, count: 0 },
              sessionCount: 0,
              alertCount: 0
            },
            period: { days, startDate, endDate: new Date() }
          });
        }

        where.deviceId = { in: bindings.map(b => b.deviceId) };
      } else if (!deviceId) {
        // 获取用户所有宠物的设备
        const pets = await prisma.pet.findMany({
          where: { ownerId: userId },
          include: {
            deviceBindings: {
              where: { status: 'active' },
              select: { deviceId: true }
            }
          }
        });

        const deviceIds = pets.flatMap(pet => 
          pet.deviceBindings.map(binding => binding.deviceId)
        );

        if (deviceIds.length === 0) {
          return reply.send({
            success: true,
            stats: {
              temperature: { avg: null, min: null, max: null, count: 0 },
              heartRate: { avg: null, min: null, max: null, count: 0 },
              activity: { avg: null, min: null, max: null, count: 0 },
              healthScore: { avg: null, min: null, max: null, count: 0 },
              sessionCount: 0,
              alertCount: 0
            },
            period: { days, startDate, endDate: new Date() }
          });
        }

        where.deviceId = { in: deviceIds };
      }

      // 获取统计数据
      const [
        temperatureStats,
        heartRateStats,
        activityStats,
        healthScoreStats,
        sessionCount,
        alertCount
      ] = await Promise.all([
        // 温度统计
        prisma.vitalSignsSample.aggregate({
          where: {
            session: where,
            temperatureC: { not: null }
          },
          _avg: { temperatureC: true },
          _min: { temperatureC: true },
          _max: { temperatureC: true },
          _count: { temperatureC: true }
        }),
        // 心率统计
        prisma.vitalSignsSample.aggregate({
          where: {
            session: where,
            heartRateBpm: { not: null }
          },
          _avg: { heartRateBpm: true },
          _min: { heartRateBpm: true },
          _max: { heartRateBpm: true },
          _count: { heartRateBpm: true }
        }),
        // 活动强度统计
        prisma.motionSample.aggregate({
          where: {
            session: where,
            movementIntensity: { not: null }
          },
          _avg: { movementIntensity: true },
          _min: { movementIntensity: true },
          _max: { movementIntensity: true },
          _count: { movementIntensity: true }
        }),
        // 健康评分统计
        prisma.healthAssessment.aggregate({
          where: {
            session: where,
            overallHealthScore: { not: null }
          },
          _avg: { overallHealthScore: true },
          _min: { overallHealthScore: true },
          _max: { overallHealthScore: true },
          _count: { overallHealthScore: true }
        }),
        // 会话数量
        prisma.sensorDataSession.count({ where }),
        // 警报数量
        prisma.healthAlert.count({
          where: {
            sessionId: { in: [] } // 临时修复，需要根据实际需求调整
          }
        })
      ]);

      return reply.send({
        success: true,
        stats: {
          temperature: {
            avg: temperatureStats._avg.temperatureC,
            min: temperatureStats._min.temperatureC,
            max: temperatureStats._max.temperatureC,
            count: temperatureStats._count.temperatureC
          },
          heartRate: {
            avg: heartRateStats._avg.heartRateBpm,
            min: heartRateStats._min.heartRateBpm,
            max: heartRateStats._max.heartRateBpm,
            count: heartRateStats._count.heartRateBpm
          },
          activity: {
            avg: activityStats._avg.movementIntensity,
            min: activityStats._min.movementIntensity,
            max: activityStats._max.movementIntensity,
            count: activityStats._count.movementIntensity
          },
          healthScore: {
            avg: healthScoreStats._avg.overallHealthScore,
            min: healthScoreStats._min.overallHealthScore,
            max: healthScoreStats._max.overallHealthScore,
            count: healthScoreStats._count.overallHealthScore
          },
          sessionCount,
          alertCount
        },
        period: {
          days,
          startDate,
          endDate: new Date()
        }
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get health statistics');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get health statistics'
      });
    }
  });

  // ============================================
  // 健康警报系统API
  // ============================================

  // 获取健康警报列表
  app.get('/health-alerts', {
    preHandler: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          petId: { type: 'string' },
          deviceId: { type: 'string' },
          alertType: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
          isRead: { type: 'boolean' },
          isResolved: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { petId, deviceId, alertType, severity, isRead, isResolved, limit = 50, offset = 0 } = request.query as any;

      // 构建查询条件
      const where: any = {};

      if (alertType) where.alertType = alertType;
      if (severity) where.severity = severity;
      if (isRead !== undefined) where.isRead = isRead;
      if (isResolved !== undefined) where.isResolved = isResolved;

      if (deviceId) {
        where.device = { deviceId };
      }

      if (petId) {
        // 验证pet属于当前用户
        const pet = await prisma.pet.findFirst({
          where: { id: petId, ownerId: userId }
        });

        if (!pet) {
          return reply.status(404).send({
            success: false,
            error: 'Pet not found',
            message: 'Pet not found or does not belong to you'
          });
        }

        where.petId = petId;
      } else if (!deviceId) {
        // 获取用户所有宠物的设备
        const pets = await prisma.pet.findMany({
          where: { ownerId: userId },
          include: {
            deviceBindings: {
              where: { status: 'active' },
              select: { deviceId: true }
            }
          }
        });

        const deviceIds = pets.flatMap(pet => 
          pet.deviceBindings.map(binding => binding.deviceId)
        );

        if (deviceIds.length === 0) {
          return reply.send({
            success: true,
            alerts: [],
            total: 0,
            limit,
            offset
          });
        }

        where.deviceId = { in: deviceIds };
      }

      // 查询警报
      const [alerts, total] = await Promise.all([
        prisma.healthAlert.findMany({
          where,
          include: {
            device: {
              select: {
                id: true,
                deviceId: true,
                deviceType: true,
                model: true
              }
            },
            pet: {
              select: {
                id: true,
                name: true,
                species: true,
                avatarUrl: true
              }
            },
            session: {
              select: {
                id: true,
                sessionId: true,
                timestamp: true
              }
            }
          } as any,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.healthAlert.count({ where })
      ]);

      return reply.send({
        success: true,
        alerts: alerts.map(alert => ({
          id: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          data: alert.data,
          isRead: alert.isRead,
          isResolved: alert.isResolved,
          resolvedAt: alert.resolvedAt,
          resolvedBy: alert.resolvedBy,
          device: alert.device,
          pet: alert.pet,
          session: alert.session,
          createdAt: alert.createdAt
        })),
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get health alerts');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get health alerts'
      });
    }
  });

  // 获取单个健康警报详情
  app.get('/health-alerts/:alertId', {
    preHandler: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { alertId } = request.params as any;

      const alert = await prisma.healthAlert.findUnique({
        where: { id: alertId },
        include: {
          device: {
            include: {
              bindings: {
                where: { status: 'active' },
                include: {
                  pet: {
                    select: {
                      id: true,
                      name: true,
                      ownerId: true
                    }
                  }
                }
              }
            }
          },
          pet: {
            select: {
              id: true,
              name: true,
              species: true,
              avatarUrl: true,
              ownerId: true
            }
          },
          session: {
            select: {
              id: true,
              sessionId: true,
              timestamp: true,
              firmwareVersion: true
            }
          }
        } as any
      });

      if (!alert) {
        return reply.status(404).send({
          success: false,
          error: 'Alert not found',
          message: 'Health alert not found'
        });
      }

      // 检查用户是否有权限访问此警报
      let hasAccess = false;
      
      if ((alert as any).pet && (alert as any).pet.ownerId === userId) {
        hasAccess = true;
      } else if ((alert as any).device && (alert as any).device.bindings) {
        hasAccess = (alert as any).device.bindings.some((binding: any) => 
          binding.pet.ownerId === userId
        );
      }

      if (!hasAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this alert'
        });
      }

      return reply.send({
        success: true,
        alert: {
          id: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          data: alert.data,
          isRead: alert.isRead,
          isResolved: alert.isResolved,
          resolvedAt: alert.resolvedAt,
          resolvedBy: alert.resolvedBy,
          device: {
            id: (alert as any).device.id,
            deviceId: (alert as any).device.deviceId,
            deviceType: (alert as any).device.deviceType,
            model: (alert as any).device.model
          },
          pet: alert.pet,
          session: alert.session,
          createdAt: alert.createdAt
        }
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get health alert');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get health alert'
      });
    }
  });

  // 标记警报为已读
  app.patch('/health-alerts/:alertId/read', {
    preHandler: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { alertId } = request.params as any;

      const alert = await prisma.healthAlert.findUnique({
        where: { id: alertId },
        include: {
          device: {
            include: {
              bindings: {
                where: { status: 'active' },
                include: {
                  pet: {
                    select: {
                      id: true,
                      name: true,
                      ownerId: true
                    }
                  }
                }
              }
            }
          },
          pet: {
            select: {
              id: true,
              name: true,
              ownerId: true
            }
          }
        }
      });

      if (!alert) {
        return reply.status(404).send({
          success: false,
          error: 'Alert not found',
          message: 'Health alert not found'
        });
      }

      // 检查用户是否有权限访问此警报
      let hasAccess = false;
      
      if ((alert as any).pet && (alert as any).pet.ownerId === userId) {
        hasAccess = true;
      } else if ((alert as any).device && (alert as any).device.bindings) {
        hasAccess = (alert as any).device.bindings.some((binding: any) => 
          binding.pet.ownerId === userId
        );
      }

      if (!hasAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this alert'
        });
      }

      // 更新警报状态
      const updatedAlert = await prisma.healthAlert.update({
        where: { id: alertId },
        data: { isRead: true }
      });

      return reply.send({
        success: true,
        message: 'Alert marked as read',
        alert: {
          id: updatedAlert.id,
          isRead: updatedAlert.isRead
        }
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to mark alert as read');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to mark alert as read'
      });
    }
  });

  // 解决警报
  app.patch('/health-alerts/:alertId/resolve', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          resolution: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { alertId } = request.params as any;
      const { resolution, notes } = request.body as any;

      const alert = await prisma.healthAlert.findUnique({
        where: { id: alertId },
        include: {
          device: {
            include: {
              bindings: {
                where: { status: 'active' },
                include: {
                  pet: {
                    select: {
                      id: true,
                      name: true,
                      ownerId: true
                    }
                  }
                }
              }
            }
          },
          pet: {
            select: {
              id: true,
              name: true,
              ownerId: true
            }
          }
        }
      });

      if (!alert) {
        return reply.status(404).send({
          success: false,
          error: 'Alert not found',
          message: 'Health alert not found'
        });
      }

      // 检查用户是否有权限访问此警报
      let hasAccess = false;
      
      if ((alert as any).pet && (alert as any).pet.ownerId === userId) {
        hasAccess = true;
      } else if ((alert as any).device && (alert as any).device.bindings) {
        hasAccess = (alert as any).device.bindings.some((binding: any) => 
          binding.pet.ownerId === userId
        );
      }

      if (!hasAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this alert'
        });
      }

      // 更新警报状态
      const updateData: any = {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId
      };

      if (resolution || notes) {
        updateData.data = {
          ...(alert.data as any || {}),
          resolution: resolution || 'Resolved by user',
          notes: notes || '',
          resolvedAt: new Date().toISOString()
        };
      }

      const updatedAlert = await prisma.healthAlert.update({
        where: { id: alertId },
        data: updateData
      });

      return reply.send({
        success: true,
        message: 'Alert resolved successfully',
        alert: {
          id: updatedAlert.id,
          isResolved: updatedAlert.isResolved,
          resolvedAt: updatedAlert.resolvedAt,
          resolvedBy: updatedAlert.resolvedBy
        }
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to resolve alert');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to resolve alert'
      });
    }
  });

  // 批量标记警报为已读
  app.patch('/health-alerts/batch/read', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['alertIds'],
        properties: {
          alertIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 100
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;
      const { alertIds } = request.body as any;

      // 获取用户有权限访问的警报
      const userPets = await prisma.pet.findMany({
        where: { ownerId: userId },
        include: {
          deviceBindings: {
            where: { status: 'active' },
            select: { deviceId: true }
          }
        }
      });

      const userDeviceIds = userPets.flatMap(pet => 
        pet.deviceBindings.map(binding => binding.deviceId)
      );

      const userPetIds = userPets.map(pet => pet.id);

      // 批量更新用户有权限的警报
      const result = await prisma.healthAlert.updateMany({
        where: {
          id: { in: alertIds },
          OR: [
            { petId: { in: userPetIds } },
            { deviceId: { in: userDeviceIds } }
          ]
        },
        data: { isRead: true }
      });

      return reply.send({
        success: true,
        message: `${result.count} alerts marked as read`,
        updatedCount: result.count
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to batch mark alerts as read');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to batch mark alerts as read'
      });
    }
  });

  // 获取警报统计信息
  app.get('/health-alerts/stats', {
    preHandler: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const userId = request.user.userId;

      // 获取用户所有宠物的设备
      const pets = await prisma.pet.findMany({
        where: { ownerId: userId },
        include: {
          deviceBindings: {
            where: { status: 'active' },
            select: { deviceId: true }
          }
        }
      });

      const deviceIds = pets.flatMap(pet => 
        pet.deviceBindings.map(binding => binding.deviceId)
      );

      const petIds = pets.map(pet => pet.id);

      if (deviceIds.length === 0) {
        return reply.send({
          success: true,
          stats: {
            total: 0,
            unread: 0,
            unresolved: 0,
            bySeverity: {
              info: 0,
              warning: 0,
              error: 0,
              critical: 0
            },
            byType: {}
          }
        });
      }

      // 获取统计信息
      const [
        totalCount,
        unreadCount,
        unresolvedCount,
        severityStats,
        typeStats
      ] = await Promise.all([
        // 总警报数
        prisma.healthAlert.count({
          where: {
            OR: [
              { petId: { in: petIds } },
              { deviceId: { in: deviceIds } }
            ]
          }
        }),
        // 未读警报数
        prisma.healthAlert.count({
          where: {
            isRead: false,
            OR: [
              { petId: { in: petIds } },
              { deviceId: { in: deviceIds } }
            ]
          }
        }),
        // 未解决警报数
        prisma.healthAlert.count({
          where: {
            isResolved: false,
            OR: [
              { petId: { in: petIds } },
              { deviceId: { in: deviceIds } }
            ]
          }
        }),
        // 按严重程度统计
        prisma.healthAlert.groupBy({
          by: ['severity'],
          where: {
            OR: [
              { petId: { in: petIds } },
              { deviceId: { in: deviceIds } }
            ]
          },
          _count: { severity: true }
        }),
        // 按类型统计
        prisma.healthAlert.groupBy({
          by: ['alertType'],
          where: {
            OR: [
              { petId: { in: petIds } },
              { deviceId: { in: deviceIds } }
            ]
          },
          _count: { alertType: true }
        })
      ]);

      // 格式化严重程度统计
      const bySeverity = {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0
      };

      severityStats.forEach(stat => {
        bySeverity[stat.severity as keyof typeof bySeverity] = stat._count.severity;
      });

      // 格式化类型统计
      const byType: Record<string, number> = {};
      typeStats.forEach(stat => {
        byType[stat.alertType] = stat._count.alertType;
      });

      return reply.send({
        success: true,
        stats: {
          total: totalCount,
          unread: unreadCount,
          unresolved: unresolvedCount,
          bySeverity,
          byType
        }
      });

    } catch (error) {
      app.log.error({ error: error.message }, 'Failed to get alert statistics');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get alert statistics'
      });
    }
  });
}