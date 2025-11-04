import { FastifyInstance } from 'fastify';

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => ({ 
    status: 'healthy', 
    service: 'backend', 
    ts: new Date().toISOString() 
  }));
  
  app.get('/ready', async () => ({ 
    status: 'ready', 
    ts: new Date().toISOString() 
  }));
}
