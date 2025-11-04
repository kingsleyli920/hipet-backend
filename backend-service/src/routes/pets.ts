import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const createPetSchema = z.object({
  name: z.string().min(1),
  species: z.string().optional(),
  breed: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  weight: z.number().positive().optional(),
  gender: z.enum(['male', 'female', 'unknown']).optional(),
  avatarUrl: z.string().url().optional(),
  healthNotes: z.string().optional()
});

const updatePetSchema = z.object({
  name: z.string().min(1).optional(),
  species: z.string().optional(),
  breed: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  weight: z.number().positive().optional(),
  gender: z.enum(['male', 'female', 'unknown']).optional(),
  avatarUrl: z.string().url().optional(),
  healthNotes: z.string().optional()
});

export default async function petsRoutes(fastify, options) {
  // Get user's pets
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const pets = await prisma.pet.findMany({
        where: { ownerId: request.user.userId },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          birthDate: true,
          weight: true,
          gender: true,
          avatarUrl: true,
          healthNotes: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({ pets });
    } catch (error) {
      console.error('Get pets error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch pets'
      });
    }
  });

  // Get specific pet
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const pet = await prisma.pet.findFirst({
        where: {
          id,
          ownerId: request.user.userId
        },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          birthDate: true,
          weight: true,
          gender: true,
          avatarUrl: true,
          healthNotes: true,
          createdAt: true,
          updatedAt: true,
          healthData: {
            select: {
              id: true,
              heartRate: true,
              temperature: true,
              activity: true,
              timestamp: true,
              anomaly: true
            },
            orderBy: { timestamp: 'desc' },
            take: 10 // Last 10 health data points
          }
        }
      });

      if (!pet) {
        return reply.status(404).send({
          error: 'Pet not found',
          message: 'Pet not found or does not belong to user'
        });
      }

      return reply.send({ pet });
    } catch (error) {
      console.error('Get pet error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch pet'
      });
    }
  });

  // Create new pet
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          species: { type: 'string' },
          breed: { type: 'string' },
          birthDate: { type: 'string', format: 'date-time' },
          weight: { type: 'number', minimum: 0 },
          gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
          avatarUrl: { type: 'string', format: 'uri' },
          healthNotes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = createPetSchema.parse(request.body);

      // Parse birthDate if provided
      const birthDate = data.birthDate ? new Date(data.birthDate).toISOString() : undefined;

      const pet = await prisma.pet.create({
        data: {
          name: data.name,
          species: data.species,
          breed: data.breed,
          birthDate,
          weight: data.weight,
          gender: data.gender,
          avatarUrl: data.avatarUrl,
          healthNotes: data.healthNotes,
          ownerId: request.user.userId
        } as any,
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          birthDate: true,
          weight: true,
          gender: true,
          avatarUrl: true,
          healthNotes: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return reply.status(201).send({
        message: 'Pet created successfully',
        pet
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      console.error('Create pet error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to create pet'
      });
    }
  });

  // Update pet
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          species: { type: 'string' },
          breed: { type: 'string' },
          birthDate: { type: 'string', format: 'date-time' },
          weight: { type: 'number', minimum: 0 },
          gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
          avatarUrl: { type: 'string', format: 'uri' },
          healthNotes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const data = updatePetSchema.parse(request.body);

      // Check if pet exists and belongs to user
      const existingPet = await prisma.pet.findFirst({
        where: {
          id,
          ownerId: request.user.userId
        }
      });

      if (!existingPet) {
        return reply.status(404).send({
          error: 'Pet not found',
          message: 'Pet not found or does not belong to user'
        });
      }

      // Parse birthDate if provided
      const birthDateUpdate = data.birthDate ? new Date(data.birthDate).toISOString() : undefined;

      const pet = await prisma.pet.update({
        where: { id },
        data: {
          ...data,
          ...(birthDateUpdate ? { birthDate: birthDateUpdate } : {})
        },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          birthDate: true,
          weight: true,
          gender: true,
          avatarUrl: true,
          healthNotes: true,
          updatedAt: true
        }
      });

      return reply.send({
        message: 'Pet updated successfully',
        pet
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      console.error('Update pet error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to update pet'
      });
    }
  });

  // Delete pet
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if pet exists and belongs to user
      const existingPet = await prisma.pet.findFirst({
        where: {
          id,
          ownerId: request.user.userId
        }
      });

      if (!existingPet) {
        return reply.status(404).send({
          error: 'Pet not found',
          message: 'Pet not found or does not belong to user'
        });
      }

      // Delete pet (this will cascade delete health data)
      await prisma.pet.delete({
        where: { id }
      });

      return reply.send({
        message: 'Pet deleted successfully'
      });
    } catch (error) {
      console.error('Delete pet error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to delete pet'
      });
    }
  });

  // Upload pet avatar (placeholder)
  fastify.post('/:id/avatar', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { imageUrl } = request.body;

      if (!imageUrl) {
        return reply.status(400).send({
          error: 'Missing image URL',
          message: 'Image URL is required'
        });
      }

      // Check if pet exists and belongs to user
      const existingPet = await prisma.pet.findFirst({
        where: {
          id,
          ownerId: request.user.userId
        }
      });

      if (!existingPet) {
        return reply.status(404).send({
          error: 'Pet not found',
          message: 'Pet not found or does not belong to user'
        });
      }

      // Update pet avatar
      const pet = await prisma.pet.update({
        where: { id },
        data: { avatarUrl: imageUrl },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          updatedAt: true
        }
      });

      return reply.send({
        message: 'Pet avatar updated successfully',
        pet
      });
    } catch (error) {
      console.error('Upload pet avatar error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to update pet avatar'
      });
    }
  });

  // Get pet health data
  fastify.get('/:id/health', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { limit = 50, offset = 0 } = request.query;

      // Check if pet exists and belongs to user
      const existingPet = await prisma.pet.findFirst({
        where: {
          id,
          ownerId: request.user.userId
        }
      });

      if (!existingPet) {
        return reply.status(404).send({
          error: 'Pet not found',
          message: 'Pet not found or does not belong to user'
        });
      }

      const healthData = await prisma.healthData.findMany({
        where: { petId: id },
        select: {
          id: true,
          heartRate: true,
          temperature: true,
          activity: true,
          timestamp: true,
          anomaly: true
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      const total = await prisma.healthData.count({
        where: { petId: id }
      });

      return reply.send({
        healthData,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        }
      });
    } catch (error) {
      console.error('Get pet health data error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch pet health data'
      });
    }
  });
}
