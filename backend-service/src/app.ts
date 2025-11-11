import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

import healthRoutes from './routes/health.js';
import chatRoutes from './routes/chat.js';
import hardwareRoutes from './routes/hardware.js';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import usersRoutes from './routes/users.js';
import petsRoutes from './routes/pets.js';
import healthDataRoutes from './routes/healthdata.js';
import sessionsRoutes from './routes/sessions.js';
import uploadRoutes from './routes/upload.js';
import devicesRoutes from './routes/devices.js';
import analysisRoutes from './routes/analysis.js';
import { authenticate } from './middleware/auth.js';
import registerErrorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    },
    ajv: { customOptions: { allowUnionTypes: true } }
  });

  app.register(cors, { origin: true });

  // Error handler
  registerErrorHandler(app);

  // Register authentication middleware
  app.decorate('authenticate', authenticate);

  app.register(swagger, {
    openapi: {
      info: {
        title: 'HiPet Backend Service',
        version: '1.0.0',
        description: 'Backend service for HiPet - AI-powered pet health monitoring'
      },
      servers: [
        {
          url: process.env.API_BASE_URL || 'http://localhost:8000',
          description: 'Development server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  });
  
  app.register(swaggerUI, { routePrefix: '/docs' });

  app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
    index: false
  });
  
  app.get('/demo', async (req, reply) => reply.sendFile('demo.html'));

  // Register routes
  app.register(healthRoutes, { prefix: '/health' });
  app.register(authRoutes, { prefix: '/auth' });
  app.register(oauthRoutes, { prefix: '/auth' });
  app.register(chatRoutes, { prefix: '/chat' });
  app.register(hardwareRoutes, { prefix: '/hardware' });
  app.register(usersRoutes, { prefix: '/users' });
  app.register(petsRoutes, { prefix: '/pets' });
  app.register(healthDataRoutes, { prefix: '/healthdata' });
  app.register(sessionsRoutes, { prefix: '/sessions' });
  app.register(uploadRoutes, { prefix: '/upload' });
  app.register(devicesRoutes, { prefix: '/devices' });
  app.register(analysisRoutes, { prefix: '/analysis' });

  app.get('/', async () => ({ 
    service: 'HiPet Backend Service', 
    status: 'ok',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      users: '/users',
      pets: '/pets',
      devices: '/devices',
      chat: '/chat',
      sessions: '/sessions',
      upload: '/upload',
      analysis: '/analysis',
      hardware: '/hardware',
      health: '/health',
      docs: '/docs'
    }
  }));

  return app;
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

