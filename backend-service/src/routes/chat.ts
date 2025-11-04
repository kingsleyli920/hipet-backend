import { FastifyInstance } from 'fastify';
interface ChatStreamBody {
  message: string;
  conversation_summary?: string;
  pet_profile?: any;
  window_stats?: any;
  language?: string;
  sessionId?: string;
}
import { streamChat } from '../services/agentClient.js';

export default async function chatRoutes(app: FastifyInstance): Promise<void> {
  // Handle CORS preflight requests
  app.options('/stream', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.send();
  });

  app.post<{ Body: ChatStreamBody }>('/stream', {
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
          sessionId: { type: ['string', 'null'], default: null }
        }
      }
    }
  }, async (request, reply) => {
    await streamChat(request.body, reply);
  });

  app.get('/agents', async () => ({
    note: 'Agents list is served by agent-service. Use /chat/stream for unified access.',
    timestamp: new Date().toISOString()
  }));
}
