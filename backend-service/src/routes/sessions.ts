import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';
import { ensureRedis } from '../services/redisClient.js';

const SESSION_PREFIX = 'chat:session:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24h

async function getRedis() {
  const r = await ensureRedis();
  return r;
}

interface StartSessionBody {
  userId: string;
  petId: string;
  title?: string | null;
  meta?: any;
}

interface AppendMessagesBody {
  sessionId: string;
  messages: Array<{ role: string; content: string; meta?: any }>;
}

interface UpdateSessionBody {
  sessionId: string;
  summary?: string;
  title?: string;
}

interface ListSessionsBody {
  userId: string;
  petId?: string;
  status?: string;
  take?: number;
  cursor?: string;
}

async function sessionsRoutes(app: FastifyInstance): Promise<void> {
  // 开始会话
  app.post<{ Body: StartSessionBody }>('/start', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'petId'],
        properties: {
          userId: { type: 'string' },
          petId: { type: 'string' },
          title: { type: ['string', 'null'], maxLength: 200 },
          meta: { type: ['object', 'null'] }
        }
      }
    }
  }, async (req) => {
    const { userId, petId, title = null, meta = null } = req.body;
    const session = await prisma.chatSession.create({
      data: { userId, petId, status: 'active', title, meta }
    });
    const redis = await getRedis();
    const key = SESSION_PREFIX + session.id;
    await redis.set(key, JSON.stringify([]), { EX: DEFAULT_TTL_SECONDS });
    return { sessionId: session.id };
  });

  // 追加消息（批量）: [{ role, content, meta }]
  app.post<{ Body: AppendMessagesBody }>('/append', {
    schema: {
      body: {
        type: 'object',
        required: ['sessionId', 'messages'],
        properties: {
          sessionId: { type: 'string' },
          messages: {
            type: 'array',
            maxItems: 100,
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string', enum: ['user','agent','system'] },
                content: { type: ['string', 'object', 'array'] },
                meta: { type: ['object', 'null'] }
              }
            },
            minItems: 1
          }
        }
      }
    }
  }, async (req, reply) => {
    const { sessionId, messages } = req.body;
    const redis = await getRedis();
    const key = SESSION_PREFIX + sessionId;
    const raw = await redis.get(key);
    if (!raw) {
      reply.code(404);
      return { error: 'session not found or expired' };
    }
    const arr = JSON.parse(raw);
    for (const m of messages) arr.push({ ...m, ts: new Date().toISOString() });
    await redis.set(key, JSON.stringify(arr), { EX: DEFAULT_TTL_SECONDS });
    return { success: true, buffered: arr.length };
  });

  // 结束会话：合并Redis内容写入Postgres，删除Redis
  app.post<{ Body: UpdateSessionBody }>('/end', {
    schema: {
      body: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
          summary: { type: ['object', 'null'] },
          title: { type: ['string', 'null'] }
        }
      }
    }
  }, async (req, reply) => {
    const { sessionId, summary = null, title = null } = req.body;
    const redis = await getRedis();
    const key = SESSION_PREFIX + sessionId;
    const raw = await redis.get(key);
    if (!raw) {
      reply.code(404);
      return { error: 'session not found or expired' };
    }
    const transcript = JSON.parse(raw);
    const endedAt = new Date();
    const session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { status: 'ended', endedAt, transcript, summary, ...(title ? { title } : {}) }
    });
    await redis.del(key);
    return { success: true, sessionId: session.id, messages: transcript.length };
  });

  // 列表
  app.get<{ Querystring: Partial<ListSessionsBody> }>('/', async (req) => {
    const { userId, petId, status, take = '20', cursor } = req.query as any;
    return prisma.chatSession.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(petId ? { petId } : {}),
        ...(status ? { status } : {})
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(parseInt(String(take), 10) || 20, 100),
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {})
    });
  });

  // 详情
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const s = await prisma.chatSession.findUnique({ where: { id: req.params.id } });
    if (!s) {
      reply.code(404);
      return { error: 'not found' };
    }
    return s;
  });
}

export default sessionsRoutes;
