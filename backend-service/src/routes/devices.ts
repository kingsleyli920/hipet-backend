import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const bindDeviceSchema = z.object({
  deviceId: z.string().min(1),
  petId: z.string().min(1),
  bindingCode: z.string().optional(),
  bindingType: z.enum(['owner', 'shared', 'temporary']).default('owner'),
  permissions: z.object({
    canTrack: z.boolean().optional(),
    canControl: z.boolean().optional(),
    canShare: z.boolean().optional()
  }).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  endDate: z.string().datetime().optional() // For temporary bindings
});

const unbindDeviceSchema = z.object({
  petId: z.string().min(1),
  reason: z.string().optional()
});

const updateDeviceStatusSchema = z.object({
  batteryLevel: z.number().int().min(0).max(100).optional(),
  signalStrength: z.number().int().min(0).max(100).optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional()
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export default async function devicesRoutes(fastify, options) {
  
  // Get user's all devices (through pets)
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;

      // Get all pets owned by user
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

      // Flatten devices
      const devices = [];
      const deviceMap = new Map();

      for (const pet of pets) {
        for (const binding of pet.deviceBindings) {
          if (!deviceMap.has(binding.device.id)) {
            deviceMap.set(binding.device.id, {
              ...binding.device,
              bindings: []
            });
          }
          
          deviceMap.get(binding.device.id).bindings.push({
            id: binding.id,
            pet: {
              id: pet.id,
              name: pet.name,
              avatarUrl: pet.avatarUrl
            },
            isPrimary: binding.isPrimary,
            bindingType: binding.bindingType,
            startDate: binding.startDate
          });
        }
      }

      return reply.send({
        devices: Array.from(deviceMap.values())
      });

    } catch (error) {
      console.error('Get devices error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch devices'
      });
    }
  });

  // Get specific device details
  fastify.get('/:deviceId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { deviceId } = request.params;
      const userId = request.user.userId;

      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: {
          bindings: {
            where: { status: 'active' },
            include: {
              pet: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  ownerId: true
                }
              }
            }
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });

      if (!device) {
        return reply.status(404).send({
          error: 'Device not found',
          message: 'Device not found'
        });
      }

      // Check if user has access to this device
      const hasAccess = device.bindings.some(b => b.pet.ownerId === userId);
      if (!hasAccess) {
        return reply.status(403).send({
          error: 'Access denied',
          message: 'You do not have access to this device'
        });
      }

      // Get recent health data from bound pets
      const petIds = device.bindings.map(b => b.petId);
      const healthData = await prisma.healthData.findMany({
        where: {
          petId: { in: petIds }
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      return reply.send({
        device,
        healthData
      });

    } catch (error) {
      console.error('Get device error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch device'
      });
    }
  });

  // Bind device to pet
  fastify.post('/bind', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['deviceId', 'petId'],
        properties: {
          deviceId: { type: 'string' },
          petId: { type: 'string' },
          bindingCode: { type: 'string' },
          bindingType: { type: 'string', enum: ['owner', 'shared', 'temporary'] },
          permissions: { type: 'object' },
          settings: { type: 'object' },
          endDate: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const data = bindDeviceSchema.parse(request.body);

      // Verify device exists by deviceId (the physical ID)
      const device = await prisma.device.findUnique({
        where: { deviceId: data.deviceId }
      });

      if (!device) {
        return reply.status(404).send({
          error: 'Device not found',
          message: 'Device with this ID not found'
        });
      }

      // Verify pet exists and belongs to user
      const pet = await prisma.pet.findFirst({
        where: {
          id: data.petId,
          ownerId: userId
        }
      });

      if (!pet) {
        return reply.status(404).send({
          error: 'Pet not found',
          message: 'Pet not found or does not belong to you'
        });
      }

      // Check if device is already bound to this pet
      const existingBinding = await prisma.deviceBinding.findFirst({
        where: {
          deviceId: device.id,
          petId: data.petId,
          status: 'active'
        }
      });

      if (existingBinding) {
        return reply.status(400).send({
          error: 'Already bound',
          message: 'This device is already bound to this pet'
        });
      }

      // TODO: Verify bindingCode if provided
      // This would be used for device verification during pairing

      // Create binding
      const binding = await prisma.deviceBinding.create({
        data: {
          deviceId: device.id,
          petId: data.petId,
          userId,
          bindingType: data.bindingType || 'owner',
          status: 'active',
          isPrimary: true, // TODO: Check if there are other devices
          permissions: data.permissions || {
            canTrack: true,
            canControl: true,
            canShare: data.bindingType === 'owner'
          },
          settings: data.settings || {} as any,
          endDate: data.endDate ? new Date(data.endDate) : null
        },
        include: {
          device: true,
          pet: true
        }
      });

      // Update device status to active
      await prisma.device.update({
        where: { id: device.id },
        data: {
          status: 'active',
          lastOnlineAt: new Date()
        }
      });

      // Create binding event
      await prisma.deviceEvent.create({
        data: {
          deviceId: device.id,
          eventType: 'binding_created',
          severity: 'info',
          message: `Device bound to pet ${pet.name}`,
          data: {
            petId: pet.id,
            userId,
            bindingType: data.bindingType || 'owner'
          }
        }
      });

      return reply.status(201).send({
        message: 'Device bound successfully',
        binding
      });

    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      console.error('Bind device error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to bind device'
      });
    }
  });

  // Unbind device from pet
  fastify.post('/:deviceId/unbind', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['petId'],
        properties: {
          petId: { type: 'string' },
          reason: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { deviceId } = request.params;
      const userId = request.user.userId;
      const data = unbindDeviceSchema.parse(request.body);

      // Find the binding
      const binding = await prisma.deviceBinding.findFirst({
        where: {
          deviceId,
          petId: data.petId,
          status: 'active'
        },
        include: {
          pet: true,
          device: true
        }
      });

      if (!binding) {
        return reply.status(404).send({
          error: 'Binding not found',
          message: 'Active binding not found'
        });
      }

      // Check permission (only owner can unbind)
      if (binding.pet.ownerId !== userId) {
        return reply.status(403).send({
          error: 'Access denied',
          message: 'Only the pet owner can unbind devices'
        });
      }

      // Update binding
      await prisma.deviceBinding.update({
        where: { id: binding.id },
        data: {
          status: 'inactive',
          unboundAt: new Date(),
          unboundBy: userId,
          unboundReason: data.reason || 'user_request'
        }
      });

      // Check if device has any other active bindings
      const otherBindings = await prisma.deviceBinding.count({
        where: {
          deviceId,
          status: 'active',
          id: { not: binding.id }
        }
      });

      // If no other bindings, set device to inactive
      if (otherBindings === 0) {
        await prisma.device.update({
          where: { id: deviceId },
          data: { status: 'inactive' }
        });
      }

      // Create event
      await prisma.deviceEvent.create({
        data: {
          deviceId,
          eventType: 'binding_removed',
          severity: 'info',
          message: `Device unbound from pet ${binding.pet.name}`,
          data: {
            petId: data.petId,
            userId,
            reason: data.reason || 'user_request'
          }
        }
      });

      return reply.send({
        message: 'Device unbound successfully'
      });

    } catch (error) {
      console.error('Unbind device error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to unbind device'
      });
    }
  });

  // Update device status (called by IoT device)
  fastify.post('/:deviceId/status', {
    // TODO: Add device authentication instead of user authentication
    schema: {
      body: {
        type: 'object',
        properties: {
          batteryLevel: { type: 'integer', minimum: 0, maximum: 100 },
          signalStrength: { type: 'integer', minimum: 0, maximum: 100 },
          location: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' },
              accuracy: { type: 'number' }
            }
          },
          metadata: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { deviceId } = request.params;
      const data = updateDeviceStatusSchema.parse(request.body);

      const device = await prisma.device.findUnique({
        where: { id: deviceId }
      });

      if (!device) {
        return reply.status(404).send({
          error: 'Device not found',
          message: 'Device not found'
        });
      }

      // Update device
      const updateData: any = {
        lastOnlineAt: new Date(),
        lastSyncAt: new Date()
      };

      if (data.batteryLevel !== undefined) {
        updateData.batteryLevel = data.batteryLevel;
        
        // Create event for low battery
        if (data.batteryLevel < 20 && device.batteryLevel >= 20) {
          await prisma.deviceEvent.create({
            data: {
              deviceId,
              eventType: 'battery_low',
              severity: data.batteryLevel < 10 ? 'critical' : 'warning',
              message: `Battery level is ${data.batteryLevel}%`,
              data: { level: data.batteryLevel }
            }
          });
        }
      }

      if (data.signalStrength !== undefined) {
        updateData.signalStrength = data.signalStrength;
      }

      if (data.metadata) {
        updateData.metadata = data.metadata;
      }

      const updatedDevice = await prisma.device.update({
        where: { id: deviceId },
        data: updateData
      });

      // Handle location update
      if (data.location) {
        await prisma.deviceEvent.create({
          data: {
            deviceId,
            eventType: 'location_update',
            severity: 'info',
            data: data.location
          }
        });
      }

      return reply.send({
        message: 'Device status updated',
        device: updatedDevice
      });

    } catch (error) {
      console.error('Update device status error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to update device status'
      });
    }
  });

  // Get device events
  fastify.get('/:deviceId/events', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { deviceId } = request.params;
      const { eventType, severity, limit = 50 } = request.query;
      const userId = request.user.userId;

      // Verify user has access to this device
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: {
          bindings: {
            where: { status: 'active' },
            include: {
              pet: {
                select: { ownerId: true }
              }
            }
          }
        }
      });

      if (!device) {
        return reply.status(404).send({
          error: 'Device not found',
          message: 'Device not found'
        });
      }

      const hasAccess = device.bindings.some(b => b.pet.ownerId === userId);
      if (!hasAccess) {
        return reply.status(403).send({
          error: 'Access denied',
          message: 'You do not have access to this device'
        });
      }

      // Build query
      const where: any = { deviceId };
      if (eventType) where.eventType = eventType;
      if (severity) where.severity = severity;

      const events = await prisma.deviceEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      });

      return reply.send({ events });

    } catch (error) {
      console.error('Get device events error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch events'
      });
    }
  });

  // Get pet's devices
  fastify.get('/pets/:petId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { petId } = request.params;
      const userId = request.user.userId;

      // Verify pet belongs to user
      const pet = await prisma.pet.findFirst({
        where: {
          id: petId,
          ownerId: userId
        },
        include: {
          deviceBindings: {
            where: { status: 'active' },
            include: {
              device: true
            },
            orderBy: { isPrimary: 'desc' }
          }
        }
      });

      if (!pet) {
        return reply.status(404).send({
          error: 'Pet not found',
          message: 'Pet not found or does not belong to you'
        });
      }

      const devices = pet.deviceBindings.map(binding => ({
        device: binding.device,
        binding: {
          id: binding.id,
          isPrimary: binding.isPrimary,
          bindingType: binding.bindingType,
          startDate: binding.startDate,
          permissions: binding.permissions,
          settings: binding.settings
        }
      }));

      return reply.send({ devices });

    } catch (error) {
      console.error('Get pet devices error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch pet devices'
      });
    }
  });
}
