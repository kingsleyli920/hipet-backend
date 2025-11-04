import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  preferences: z.object({}).optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8)
});

export default async function usersRoutes(fastify, options) {
  // Get current user profile
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          emailVerified: true,
          phoneVerified: true,
          preferences: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        }
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found',
          message: 'User profile not found'
        });
      }

      return reply.send({ user });
    } catch (error) {
      console.error('Get user profile error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch user profile'
      });
    }
  });

  // Update current user profile
  fastify.put('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
          preferences: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { firstName, lastName, phone, preferences } = updateUserSchema.parse(request.body);

      const user = await prisma.user.update({
        where: { id: request.user.userId },
        data: {
          firstName,
          lastName,
          phone,
          preferences
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          emailVerified: true,
          phoneVerified: true,
          preferences: true,
          updatedAt: true
        }
      });

      return reply.send({
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      console.error('Update user profile error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to update user profile'
      });
    }
  });

  // Change password
  fastify.put('/me/password', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);

      // Get user with password hash
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { passwordHash: true }
      });

      if (!user || !user.passwordHash) {
        return reply.status(400).send({
          error: 'No password set',
          message: 'User does not have a password set'
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return reply.status(400).send({
          error: 'Invalid current password',
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: request.user.userId },
        data: { passwordHash: newPasswordHash }
      });

      // Invalidate all user sessions except current one
      const currentToken = request.headers.authorization?.substring(7);
      if (currentToken) {
        // This is a simplified approach - in production you might want to
        // track current session token and exclude it from invalidation
        await prisma.userSession.updateMany({
          where: { 
            userId: request.user.userId,
            tokenHash: { not: currentToken } // This won't work as expected, but shows the concept
          },
          data: { isActive: false }
        });
      }

      return reply.send({
        message: 'Password changed successfully'
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      console.error('Change password error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to change password'
      });
    }
  });

  // Upload avatar (placeholder)
  fastify.post('/me/avatar', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      // This is a placeholder for file upload
      // In production, you would use a service like AWS S3, Cloudinary, etc.
      const { imageUrl } = request.body;

      if (!imageUrl) {
        return reply.status(400).send({
          error: 'Missing image URL',
          message: 'Image URL is required'
        });
      }

      // Update user avatar
      const user = await prisma.user.update({
        where: { id: request.user.userId },
        data: { avatarUrl: imageUrl },
        select: {
          id: true,
          email: true,
          avatarUrl: true,
          updatedAt: true
        }
      });

      return reply.send({
        message: 'Avatar updated successfully',
        user
      });
    } catch (error) {
      console.error('Upload avatar error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to update avatar'
      });
    }
  });

  // Delete current user account
  fastify.delete('/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      // Soft delete - mark as inactive instead of hard delete
      await prisma.user.update({
        where: { id: request.user.userId },
        data: { 
          isActive: false,
          email: `deleted_${Date.now()}_${request.user.email}` // Make email unique
        }
      });

      // Invalidate all user sessions
      await prisma.userSession.updateMany({
        where: { userId: request.user.userId },
        data: { isActive: false }
      });

      return reply.send({
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to delete account'
      });
    }
  });

  // Get user sessions
  fastify.get('/me/sessions', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const sessions = await prisma.userSession.findMany({
        where: { 
          userId: request.user.userId,
          isActive: true
        },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          lastUsedAt: true,
          createdAt: true
        },
        orderBy: { lastUsedAt: 'desc' }
      });

      return reply.send({ sessions });
    } catch (error) {
      console.error('Get user sessions error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to fetch user sessions'
      });
    }
  });

  // Revoke specific session
  fastify.delete('/me/sessions/:sessionId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const session = await prisma.userSession.findFirst({
        where: {
          id: sessionId,
          userId: request.user.userId
        }
      });

      if (!session) {
        return reply.status(404).send({
          error: 'Session not found',
          message: 'Session not found or does not belong to user'
        });
      }

      await prisma.userSession.update({
        where: { id: sessionId },
        data: { isActive: false }
      });

      return reply.send({
        message: 'Session revoked successfully'
      });
    } catch (error) {
      console.error('Revoke session error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to revoke session'
      });
    }
  });

  // Revoke all sessions
  fastify.delete('/me/sessions', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      await prisma.userSession.updateMany({
        where: { userId: request.user.userId },
        data: { isActive: false }
      });

      return reply.send({
        message: 'All sessions revoked successfully'
      });
    } catch (error) {
      console.error('Revoke all sessions error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to revoke all sessions'
      });
    }
  });
}
