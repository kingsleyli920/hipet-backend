import { FastifyInstance } from 'fastify';
import { request } from 'undici';
import { ensureRedis } from './redisClient.js';

const AGENT_BASE = process.env.AGENT_SERVICE_URL || 'http://localhost:8001';
const SESSION_PREFIX = 'chat:session:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24h

export async function streamChat(
  { message, conversation_summary = '', pet_profile = {}, window_stats = null, language = null, sessionId = null },
  reply
) {
  const url = `${AGENT_BASE}/chat/stream`;
  const { body, statusCode } = await request(url, {
    method: 'POST',
    body: JSON.stringify({ message, conversation_summary, pet_profile, window_stats, language }),
    headers: {
      'content-type': 'application/json'
    }
  });

  if (statusCode >= 400) {
    reply.code(statusCode);
    reply.send({ error: 'agent-service error' });
    return;
  }

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('Access-Control-Allow-Origin', '*');
  reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  let buffer = '';
  let lastRouterNext = null;
  let expectingSpecialist = false;
  let specialistCaptured = false;
  for await (const chunk of body) {
    const text = chunk.toString();

    // 1) 直通转发给前端
    reply.raw.write(text);

    // 2) 解析并采样关键事件到 Redis（有 sessionId 时）
    buffer += text;
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const line = block.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload);
        if (!sessionId) continue;
        const type = evt.type;
        if (type !== 'router' && type !== 'transfer' && type !== 'specialist') continue;
        const role = type === 'specialist' ? 'agent' : 'system';
        const content = evt.content || {};
        if (type === 'router') { lastRouterNext = content.next || lastRouterNext; expectingSpecialist = ['doctor','nutritionist','trainer','faq','avatar'].includes(lastRouterNext||''); }
        if (type === 'transfer') { expectingSpecialist = true; }
        if (type === 'specialist') { specialistCaptured = true; }

        const r = await ensureRedis();
        const key = SESSION_PREFIX + sessionId;
        const raw = await r.get(key);
        if (!raw) continue; // 会话可能已结束或过期
        const arr = JSON.parse(raw);
        arr.push({ role, content, meta: { type }, ts: new Date().toISOString() });
        await r.set(key, JSON.stringify(arr), { EX: DEFAULT_TTL_SECONDS });
      } catch {
        // 忽略解析错误
      }
    }
  }
    // Fallback: if expecting specialist but not captured, record a pending marker
  if (sessionId && expectingSpecialist && !specialistCaptured && lastRouterNext) {
    try {
      const r = await ensureRedis();
      const key = SESSION_PREFIX + sessionId;
      const raw = await r.get(key);
      if (raw) {
        const arr = JSON.parse(raw);
        arr.push({ role: "system", content: { target: lastRouterNext, note: "specialist_not_emitted_in_stream" }, meta: { type: "specialist_pending" }, ts: new Date().toISOString() });
        await r.set(key, JSON.stringify(arr), { EX: DEFAULT_TTL_SECONDS });
      }
    } catch {}
  }
  reply.raw.end();
}
