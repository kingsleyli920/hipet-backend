import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db.js';

interface HealthDataBody {
  petId: string;
  date: string;
  dataType: string;
  value: string;
  unit?: string;
  source?: string;
  notes?: string;
}

interface HealthDataParams {
  id: string;
}

export default async function healthDataRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => prisma.healthData.findMany());
  app.post<{ Body: HealthDataBody }>('/', async (req) => prisma.healthData.create({ data: req.body as any }));
  app.get<{ Params: HealthDataParams }>('/:id', async (req) => prisma.healthData.findUnique({ where: { id: req.params.id } }));
  app.put<{ Params: HealthDataParams; Body: Partial<HealthDataBody> }>('/:id', async (req) => prisma.healthData.update({ where: { id: req.params.id }, data: req.body as any }));
  app.delete<{ Params: HealthDataParams }>('/:id', async (req) => prisma.healthData.delete({ where: { id: req.params.id } }));
}
