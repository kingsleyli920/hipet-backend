import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import fileUploadService from '../services/fileUploadService';
import emailService from '../services/emailService';
import oauthService from '../services/oauthService';
import avatarService from '../services/avatarService';

const prisma = new PrismaClient();

export default async function uploadRoutes(fastify, options) {
  // Upload user avatar
  fastify.post('/avatar', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['imageUrl'],
        properties: {
          imageUrl: { type: 'string', format: 'uri' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { imageUrl } = request.body;

      // Validate URL format
      try {
        new URL(imageUrl);
      } catch (error) {
        return reply.status(400).send({
          error: 'Invalid URL',
          message: 'Please provide a valid image URL'
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

  // Upload pet photo
  fastify.post('/pet/:petId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['petId'],
        properties: {
          petId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['imageUrl'],
        properties: {
          imageUrl: { type: 'string', format: 'uri' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { petId } = request.params;
      const { imageUrl } = request.body;

      // Validate URL format
      try {
        new URL(imageUrl);
      } catch (error) {
        return reply.status(400).send({
          error: 'Invalid URL',
          message: 'Please provide a valid image URL'
        });
      }

      // Check if pet exists and belongs to user
      const existingPet = await prisma.pet.findFirst({
        where: {
          id: petId,
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
        where: { id: petId },
        data: { avatarUrl: imageUrl },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          updatedAt: true
        }
      });

      return reply.send({
        message: 'Pet photo updated successfully',
        pet
      });
    } catch (error) {
      console.error('Upload pet photo error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to update pet photo'
      });
    }
  });

  // Get presigned URL for direct upload
  fastify.post('/presigned', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['filename', 'mimeType'],
        properties: {
          filename: { type: 'string' },
          mimeType: { type: 'string' },
          prefix: { type: 'string', default: 'uploads' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { filename, mimeType, prefix = 'uploads' } = request.body;

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(mimeType)) {
        return reply.status(400).send({
          error: 'Invalid file type',
          message: `File type ${mimeType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        });
      }

      // Generate unique filename
      const uniqueFilename = fileUploadService.generateUniqueFilename(filename, prefix);

      // Generate presigned URL
      const result = await fileUploadService.generatePresignedUrl(uniqueFilename, mimeType);

      if (!result.success) {
        return reply.status(500).send({
          error: 'Upload service error',
          message: 'Failed to generate upload URL'
        });
      }

      return reply.send({
        message: 'Presigned URL generated successfully',
        uploadUrl: result.url,
        filename: uniqueFilename,
        expiresIn: result.expiresIn
      });
    } catch (error) {
      console.error('Generate presigned URL error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate upload URL'
      });
    }
  });

  // Delete file
  fastify.delete('/:filename', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { filename } = request.params;

      // Delete file from storage
      const result = await fileUploadService.deleteFile(filename);

      if (!result.success) {
        return reply.status(500).send({
          error: 'Delete service error',
          message: 'Failed to delete file'
        });
      }

      return reply.send({
        message: 'File deleted successfully'
      });
    } catch (error) {
      console.error('Delete file error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to delete file'
      });
    }
  });

  // Generate pet avatar with AI
  fastify.post('/pet/:petId/avatar/generate', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['petId'],
        properties: {
          petId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          style: { type: 'string' },
          language: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { petId } = request.params;
      const { message, style, language } = request.body;

      // Check if pet exists and belongs to user
      const pet = await prisma.pet.findFirst({
        where: {
          id: petId,
          ownerId: request.user.userId
        }
      });

      if (!pet) {
        return reply.status(404).send({
          error: 'Pet not found',
          message: 'Pet not found or does not belong to user'
        });
      }

      // Generate avatar parameters using AI Agent
      const avatarResult = await avatarService.generateAvatarWithStyle(
        message,
        style,
        true, // pet photo uploaded
        language
      );

      if (!avatarResult.success) {
        return reply.status(500).send({
          error: 'Avatar generation failed',
          message: avatarResult.error
        });
      }

      const { avatar } = avatarResult;

      // Update pet with generated avatar parameters
      const updatedPet = await prisma.pet.update({
        where: { id: petId },
        data: {
          avatarUrl: `generated_${avatar.style}_${Date.now()}`, // Placeholder URL
          healthNotes: avatar.notes
        },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          updatedAt: true
        }
      });

      return reply.send({
        message: 'Pet avatar generated successfully',
        pet: updatedPet,
        avatar: {
          style: avatar.style,
          quality: avatar.quality,
          notes: avatar.notes,
          okToGenerate: avatar.ok_to_generate,
          language: avatar.language
        }
      });
    } catch (error) {
      console.error('Generate pet avatar error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate pet avatar'
      });
    }
  });

  // Get available avatar styles
  fastify.get('/avatar/styles', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const stylesResult = await avatarService.getAvailableStyles();

      if (!stylesResult.success) {
        return reply.status(500).send({
          error: 'Failed to get avatar styles',
          message: stylesResult.error
        });
      }

      return reply.send({
        message: 'Avatar styles retrieved successfully',
        styles: stylesResult.styles
      });
    } catch (error) {
      console.error('Get avatar styles error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to get avatar styles'
      });
    }
  });

  // Validate avatar generation request
  fastify.post('/avatar/validate', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          language: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { message, language } = request.body;

      const validationResult = await avatarService.validateAvatarRequest(
        message,
        true, // pet photo uploaded
        language
      );

      if (!validationResult.success) {
        return reply.status(500).send({
          error: 'Avatar validation failed',
          message: validationResult.error
        });
      }

      return reply.send({
        message: 'Avatar request validated successfully',
        valid: validationResult.valid,
        language: validationResult.language,
        error: validationResult.error
      });
    } catch (error) {
      console.error('Validate avatar request error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to validate avatar request'
      });
    }
  });

  // Get upload status
  fastify.get('/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const status = {
        emailService: emailService.isConfigured,
        oauthService: oauthService.isConfigured,
        fileUploadService: fileUploadService.isConfigured,
        avatarService: avatarService.getStatus(),
        services: {
          email: emailService.isConfigured ? 'AWS SES' : 'Placeholder',
          oauth: oauthService.isConfigured ? 'Google OAuth' : 'Placeholder',
          fileUpload: fileUploadService.isConfigured ? 'AWS S3' : 'Placeholder',
          avatar: avatarService.getStatus().service
        }
      };

      return reply.send({
        message: 'Service status retrieved successfully',
        status
      });
    } catch (error) {
      console.error('Get upload status error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to get upload status'
      });
    }
  });
}
