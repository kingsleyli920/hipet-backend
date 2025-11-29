import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { streamChat } from '../services/agentClient.js';

interface ChatStreamBody {
  message: string;
  conversation_summary?: string;
  pet_profile?: any;
  window_stats?: any;
  language?: string;
  sessionId?: string;
  petId?: string; // Add petId to fetch latest status
}

export default async function chatRoutes(app: FastifyInstance): Promise<void> {
  // Handle CORS preflight requests
  app.options('/stream', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.send();
  });

  app.post<{ Body: ChatStreamBody }>('/stream', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['message', 'pet_profile'],
        properties: {
          message: { type: 'string', minLength: 1, maxLength: 2000 },
          conversation_summary: { type: 'string', default: '', maxLength: 4000 },
          pet_profile: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1 },
              breed: { type: ['string', 'null'] },
              age: { type: ['number', 'integer', 'null'], minimum: 0 },
              weight: { type: ['number', 'null'], minimum: 0 }
            },
            additionalProperties: true
          },
          window_stats: { type: ['object', 'null'] },
          language: { type: ['string', 'null'], default: null },
          sessionId: { type: ['string', 'null'], default: null },
          petId: { type: ['string', 'null'], default: null }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const userId = request.user.userId;
      const body = request.body as ChatStreamBody;
      const petId = body.petId || body.pet_profile?.id;

      // Agentic approach: Let Router Agent decide if pet status is needed
      // Step 1: Quick Router Agent call to determine if pet status is needed
      let windowStats = body.window_stats;
      let needsPetStatus = false;

      if (petId && !windowStats) {
        try {
          // Call Router Agent to make intelligent decision
          const routerCheckUrl = `${process.env.AGENT_SERVICE_URL || 'http://localhost:8001'}/chat/router-check`;
          const routerCheckResponse = await fetch(routerCheckUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: body.message,
              conversation_summary: body.conversation_summary || '',
              pet_profile: body.pet_profile || {},
              language: body.language
            })
          });

          if (routerCheckResponse.ok) {
            const routerDecision = await routerCheckResponse.json();
            needsPetStatus = routerDecision.needs_pet_status || false;
            app.log.info({ 
              petId, 
              message: body.message,
              needsPetStatus,
              reason: routerDecision.reason,
              next: routerDecision.next
            }, 'Router Agent decision for pet status');
          } else {
            app.log.warn({ status: routerCheckResponse.status }, 'Router check failed, defaulting to query');
            needsPetStatus = true; // Safe fallback
          }
        } catch (routerError: any) {
          app.log.warn({ error: routerError.message }, 'Failed to check router decision, will query by default');
          // If check fails, default to querying for safety (better to have data than not)
          needsPetStatus = true;
        }

        // Step 2: Query database if Router Agent determined it's needed
        if (needsPetStatus) {
          try {
            // 验证 pet 属于当前用户
            const pet = await prisma.pet.findFirst({
              where: {
                id: petId,
                ownerId: userId
              }
            });

            if (pet) {
              // 获取最新的健康数据（最近24小时）
              const recentHealthData = await prisma.healthData.findMany({
                where: {
                  petId: petId,
                  timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                  }
                },
                orderBy: { timestamp: 'desc' },
                take: 50
              });

              // 获取最新的传感器数据会话（最近24小时）
              const recentSessions = await prisma.sensorDataSession.findMany({
                where: {
                  device: {
                    bindings: {
                      some: {
                        petId: petId,
                        status: 'active'
                      }
                    }
                  },
                  timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                  }
                },
                orderBy: { timestamp: 'desc' },
                take: 5,
                include: {
                  sensorAnalyses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                  }
                }
              });

              // 获取最新的分析结果
              const latestAnalysis = await prisma.sensorAnalysis.findFirst({
                where: {
                  petId: petId
                },
                orderBy: { createdAt: 'desc' }
              });

              // 构建 window_stats
              windowStats = {
                health_data: recentHealthData.map(h => ({
                  heartRate: h.heartRate,
                  temperature: h.temperature,
                  activity: h.activity,
                  timestamp: h.timestamp.toISOString(),
                  anomaly: h.anomaly
                })),
                recent_sessions: recentSessions.map(s => ({
                  sessionId: s.sessionId,
                  timestamp: s.timestamp.toISOString(),
                  hasAnalysis: s.sensorAnalyses.length > 0,
                  analysis: s.sensorAnalyses[0] ? {
                    confidence: s.sensorAnalyses[0].confidence,
                    insights: s.sensorAnalyses[0].insights
                  } : null
                })),
                latest_analysis: latestAnalysis ? {
                  confidence: latestAnalysis.confidence,
                  insights: latestAnalysis.insights,
                  metrics: latestAnalysis.metrics,
                  createdAt: latestAnalysis.createdAt.toISOString()
                } : null,
                summary: {
                  total_health_records: recentHealthData.length,
                  total_sessions: recentSessions.length,
                  has_recent_data: recentHealthData.length > 0 || recentSessions.length > 0,
                  last_update: recentHealthData[0]?.timestamp || recentSessions[0]?.timestamp || null
                }
              };

              app.log.info({ 
                petId, 
                healthRecords: recentHealthData.length, 
                sessions: recentSessions.length,
                hasAnalysis: !!latestAnalysis
              }, 'Fetched latest pet status (agentic decision)');
            }
          } catch (dbError: any) {
            app.log.warn({ error: dbError.message, petId }, 'Failed to fetch pet status, continuing without it');
            // Continue without window_stats if database query fails
          }
        } else {
          app.log.info({ petId, message: body.message }, 'Router Agent determined pet status not needed');
        }
      }

      // Step 3: Call agent service with final window_stats (or null if not needed)
      await streamChat({
        ...body,
        window_stats: windowStats
      }, reply);

    } catch (error: any) {
      app.log.error({ error: error.message }, 'Chat stream error');
      reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to process chat request'
      });
    }
  });

  app.get('/agents', async () => ({
    note: 'Agents list is served by agent-service. Use /chat/stream for unified access.',
    timestamp: new Date().toISOString()
  }));
}
