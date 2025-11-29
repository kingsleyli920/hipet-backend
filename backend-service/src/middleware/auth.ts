import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import type { AuthenticatedRequest, JWTPayload } from '../types/index.js';

// JWT Authentication middleware
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JWTPayload;
    
    if (decoded.type !== 'access') {
      return reply.status(401).send({
        error: 'Invalid token type',
        message: 'Token is not an access token'
      });
    }
    
    // Check if user exists and is active
    const user = await prisma.user.findFirst({
      where: { 
        id: decoded.userId,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        isActive: true
      }
    });
    
    if (!user) {
      return reply.status(401).send({
        error: 'User not found',
        message: 'User account not found or inactive'
      });
    }
    
    // Attach user to request
    (request as AuthenticatedRequest).user = {
      userId: user.id,
      type: 'access'
    };
    
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return reply.status(401).send({
        error: 'Invalid token',
        message: 'JWT token is invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return reply.status(401).send({
        error: 'Token expired',
        message: 'JWT token has expired'
      });
    }
    
    console.error('Authentication error:', error);
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      (request as any).user = null;
      return;
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JWTPayload;
    
    if (decoded.type !== 'access') {
      (request as any).user = null;
      return;
    }
    
    // Check if user exists and is active
    const user = await prisma.user.findFirst({
      where: { 
        id: decoded.userId,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        isActive: true
      }
    });
    
    if (user) {
      (request as AuthenticatedRequest).user = {
        userId: user.id,
        type: 'access'
      };
    } else {
      (request as any).user = null;
    }
    
  } catch (error) {
    // If any error occurs, continue without authentication
    (request as any).user = null;
  }
}

// Role-based authorization middleware
export function authorize(roles: string[] = []) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = (request as AuthenticatedRequest).user;
    
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    // For now, we don't have roles implemented
    // This is a placeholder for future role-based access control
    // You can extend this based on your requirements
  };
}

// Email verification required middleware
export async function requireEmailVerification(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = (request as AuthenticatedRequest).user;
  
  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  // Check email verification status from database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { emailVerified: true }
  });
  
  if (!dbUser?.emailVerified) {
    return reply.status(403).send({
      error: 'Email verification required',
      message: 'Please verify your email address to access this resource'
    });
  }
}

// Device authentication middleware
// Supports both user token and device token authentication
export async function authenticateDevice(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // First, try to verify as user JWT token
    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'your-secret-key'
      ) as JWTPayload;
      
      if (decoded.type === 'access') {
        // User token - verify user exists
        const user = await prisma.user.findFirst({
          where: { 
            id: decoded.userId,
            isActive: true
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            emailVerified: true,
            isActive: true
          }
        });
        
        if (user) {
          (request as AuthenticatedRequest).user = {
            userId: user.id,
            type: 'access'
          };
          (request as any).device = null;
          return; // User authentication successful
        }
      }
    } catch (jwtError) {
      // Not a valid JWT token, continue to check device token
    }
    
    // Try device token authentication
    const device = await prisma.device.findUnique({
      where: { deviceToken: token },
      select: {
        id: true,
        deviceId: true,
        status: true,
        deviceTokenExpiresAt: true
      }
    });
    
    if (!device) {
      return reply.status(401).send({
        error: 'Invalid token',
        message: 'Device token is invalid'
      });
    }
    
    // Check if device token has expired
    if (device.deviceTokenExpiresAt && device.deviceTokenExpiresAt < new Date()) {
      return reply.status(401).send({
        error: 'Token expired',
        message: 'Device token has expired'
      });
    }
    
    // Check if device is active
    if (device.status !== 'active') {
      return reply.status(403).send({
        error: 'Device inactive',
        message: 'Device is not active'
      });
    }
    
    // Attach device to request
    (request as any).device = {
      deviceId: device.id,
      physicalDeviceId: device.deviceId,
      type: 'device'
    };
    (request as any).user = null;
    
  } catch (error: any) {
    console.error('Device authentication error:', error);
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

// Flexible authentication: supports both user and device tokens
// For hardware endpoints that can accept either authentication method
export async function authenticateUserOrDevice(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Try user token first
    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'your-secret-key'
      ) as JWTPayload;
      
      if (decoded.type === 'access') {
        const user = await prisma.user.findFirst({
          where: { 
            id: decoded.userId,
            isActive: true
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            emailVerified: true,
            isActive: true
          }
        });
        
        if (user) {
          (request as AuthenticatedRequest).user = {
            userId: user.id,
            type: 'access'
          };
          (request as any).device = null;
          return;
        }
      }
    } catch (jwtError) {
      // Not a valid JWT, continue to device token
    }
    
    // Try device token
    const device = await prisma.device.findUnique({
      where: { deviceToken: token },
      select: {
        id: true,
        deviceId: true,
        status: true,
        deviceTokenExpiresAt: true
      }
    });
    
    if (device) {
      if (device.deviceTokenExpiresAt && device.deviceTokenExpiresAt < new Date()) {
        return reply.status(401).send({
          error: 'Token expired',
          message: 'Device token has expired'
        });
      }
      
      if (device.status === 'active') {
        (request as any).device = {
          deviceId: device.id,
          physicalDeviceId: device.deviceId,
          type: 'device'
        };
        (request as any).user = null;
        return;
      }
    }
    
    // Neither authentication method worked
    return reply.status(401).send({
      error: 'Invalid token',
      message: 'Token is invalid or expired'
    });
    
  } catch (error: any) {
    console.error('Authentication error:', error);
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

