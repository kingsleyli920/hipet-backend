import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
