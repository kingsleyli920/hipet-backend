import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import emailService from '../services/emailService';
import oauthService from '../services/oauthService';

const prisma = new PrismaClient();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8)
});

const verifyEmailSchema = z.object({
  token: z.string()
});

// Helper functions
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '30m' } // Increased from 15m to 30m
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

const hashToken = (token) => {
  return bcrypt.hashSync(token, 10);
};

const verifyToken = (token, hash) => {
  return bcrypt.compareSync(token, hash);
};

// Email and OAuth services are now imported from separate modules

export default async function authRoutes(fastify, options) {
  // Register user
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password, firstName, lastName, phone } = registerSchema.parse(request.body);
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existingUser) {
        return reply.status(400).send({
          error: 'User already exists',
          message: 'An account with this email already exists'
        });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          emailVerified: false
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          emailVerified: true,
          createdAt: true
        }
      });
      
      // Generate verification token
      const verificationToken = jwt.sign(
        { userId: user.id, email, type: 'email_verification' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Store verification token
      await prisma.emailVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          token: verificationToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });
      
      // Send verification email
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      await emailService.sendVerificationEmail(
        user.email,
        verificationUrl,
        user.firstName || 'User'
      );
      
      return reply.status(201).send({
        message: 'User registered successfully. Please check your email for verification.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified
        }
      });
      
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }
      
      console.error('Registration error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to register user'
      });
    }
  });
  
  // Login user
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);
      
      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          isActive: true
        }
      });
      
      if (!user || !user.passwordHash) {
        return reply.status(401).send({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }
      
      if (!user.isActive) {
        return reply.status(401).send({
          error: 'Account disabled',
          message: 'Your account has been disabled'
        });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return reply.status(401).send({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }
      
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user.id);
      
      // Store session
      const tokenHash = hashToken(refreshToken);
      await prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip
        }
      });
      
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      
      return reply.send({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });
      
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }
      
      console.error('Login error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to login'
      });
    }
  });
  
  // Google OAuth login
  fastify.post('/google', {
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { token } = request.body;
      
      // Verify Google token
      const googleUser = await oauthService.verifyGoogleToken(token);
      if (!googleUser.success) {
        return reply.status(401).send({
          error: 'Invalid Google token',
          message: 'Failed to verify Google authentication'
        });
      }
      
      // Find or create user
      let user = await prisma.user.findUnique({
        where: { email: googleUser.user.email }
      });
      
      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: googleUser.user.email,
            firstName: googleUser.user.given_name || googleUser.user.name,
            lastName: googleUser.user.family_name,
            emailVerified: googleUser.user.verified_email || true,
            avatarUrl: googleUser.user.picture
          }
        });
      } else {
        // Update existing user with latest Google info if needed
        await prisma.user.update({
          where: { id: user.id },
          data: {
            firstName: googleUser.user.given_name || googleUser.user.name,
            lastName: googleUser.user.family_name,
            emailVerified: googleUser.user.verified_email || true,
            avatarUrl: googleUser.user.picture
          }
        });
      }
      
      // Create or update OAuth account
      await prisma.oAuthAccount.upsert({
        where: {
          provider_providerId: {
            provider: 'google',
            providerId: googleUser.user.id
          }
        },
        update: {
          accessToken: token,
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          provider: 'google',
          providerId: googleUser.user.id,
          accessToken: token
        }
      });
      
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user.id);
      
      // Store session
      const tokenHash = hashToken(refreshToken);
      await prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip
        }
      });
      
      return reply.send({
        message: 'Google login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });
      
    } catch (error) {
      console.error('Google login error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to process Google login'
      });
    }
  });
  
  // Refresh token
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { refreshToken } = request.body;
      
      if (!refreshToken) {
        console.log('No refresh token provided');
        return reply.status(401).send({
          error: 'No refresh token',
          message: 'Refresh token is required'
        });
      }
      
      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      } catch (jwtError) {
        console.log('JWT verification failed:', jwtError.message);
        return reply.status(401).send({
          error: 'Invalid token',
          message: 'JWT token has expired or is invalid'
        });
      }
      
      if ((decoded as any).type !== 'refresh') {
        console.log('Invalid token type:', (decoded as any).type);
        return reply.status(401).send({
          error: 'Invalid token type',
          message: 'Token is not a refresh token'
        });
      }
      
      // Check session in database
      // Get all active sessions for this user
      const sessions = await prisma.userSession.findMany({
        where: {
          userId: (decoded as any).userId,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });
      
      if (!sessions || sessions.length === 0) {
        console.log('No active sessions found for user:', (decoded as any).userId);
        return reply.status(401).send({
          error: 'Invalid session',
          message: 'No active session found'
        });
      }
      
      // Find matching session by comparing token hash
      let session = null;
      for (const s of sessions) {
        if (verifyToken(refreshToken, s.tokenHash)) {
          session = s;
          break;
        }
      }
      
      if (!session) {
        console.log('Refresh token does not match any session for user:', (decoded as any).userId);
        return reply.status(401).send({
          error: 'Invalid session',
          message: 'Refresh token is invalid or expired'
        });
      }
      
      // Check if user is still active
      if (!session.user.isActive) {
        console.log('User account is inactive:', session.userId);
        return reply.status(401).send({
          error: 'Account inactive',
          message: 'User account is no longer active'
        });
      }
      
      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(session.userId);
      
      // Update session with new refresh token
      const newTokenHash = hashToken(newRefreshToken);
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          tokenHash: newTokenHash,
          lastUsedAt: new Date()
        }
      });
      
      console.log(`Token refreshed successfully for user ${session.userId}`);
      
      return reply.send({
        message: 'Token refreshed successfully',
        tokens: {
          accessToken,
          refreshToken: newRefreshToken
        }
      });
      
    } catch (error) {
      console.error('Token refresh error:', error);
      return reply.status(401).send({
        error: 'Invalid token',
        message: 'Failed to refresh token'
      });
    }
  });
  
  // Logout
  fastify.post('/logout', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { refreshToken } = request.body;
      
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await prisma.userSession.updateMany({
          where: { tokenHash },
          data: { isActive: false }
        });
      }
      
      return reply.send({
        message: 'Logout successful'
      });
      
    } catch (error) {
      console.error('Logout error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to logout'
      });
    }
  });
  
  // Forgot password
  fastify.post('/forgot-password', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email } = forgotPasswordSchema.parse(request.body);
      
      const user = await prisma.user.findUnique({
        where: { email }
      });
      
      if (!user) {
        // Don't reveal if user exists
        return reply.send({
          message: 'If an account with this email exists, a password reset link has been sent.'
        });
      }
      
      // Generate reset token
      const resetToken = jwt.sign(
        { userId: user.id, email, type: 'password_reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      // Store reset token
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          email: user.email,
          token: resetToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        }
      });
      
      // Send reset email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await emailService.sendPasswordResetEmail(
        user.email,
        resetUrl,
        user.firstName || 'User'
      );
      
      return reply.send({
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
      
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }
      
      console.error('Forgot password error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to process password reset request'
      });
    }
  });
  
  // Reset password
  fastify.post('/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { token, password } = resetPasswordSchema.parse(request.body);
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if ((decoded as any).type !== 'password_reset') {
        return reply.status(400).send({
          error: 'Invalid token',
          message: 'Token is not a password reset token'
        });
      }
      
      // Check reset token in database
      const resetRecord = await prisma.passwordReset.findFirst({
        where: {
          token,
          used: false,
          expiresAt: { gt: new Date() }
        }
      });
      
      if (!resetRecord) {
        return reply.status(400).send({
          error: 'Invalid or expired token',
          message: 'Password reset token is invalid or has expired'
        });
      }
      
      // Update password
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash }
      });
      
      // Mark token as used
      await prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true }
      });
      
      // Invalidate all user sessions
      await prisma.userSession.updateMany({
        where: { userId: resetRecord.userId },
        data: { isActive: false }
      });
      
      return reply.send({
        message: 'Password reset successfully'
      });
      
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return reply.status(400).send({
          error: 'Invalid token',
          message: 'Password reset token is invalid'
        });
      }
      
      console.error('Reset password error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to reset password'
      });
    }
  });
  
  // Verify email
  fastify.post('/verify-email', {
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { token } = verifyEmailSchema.parse(request.body);
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if ((decoded as any).type !== 'email_verification') {
        return reply.status(400).send({
          error: 'Invalid token',
          message: 'Token is not an email verification token'
        });
      }
      
      // Check verification token in database
      const verificationRecord = await prisma.emailVerification.findFirst({
        where: {
          token,
          used: false,
          expiresAt: { gt: new Date() }
        }
      });
      
      if (!verificationRecord) {
        return reply.status(400).send({
          error: 'Invalid or expired token',
          message: 'Email verification token is invalid or has expired'
        });
      }
      
      // Update user email verification status
      await prisma.user.update({
        where: { id: verificationRecord.userId },
        data: { emailVerified: true }
      });
      
      // Mark token as used
      await prisma.emailVerification.update({
        where: { id: verificationRecord.id },
        data: { used: true }
      });
      
      return reply.send({
        message: 'Email verified successfully'
      });
      
    } catch (error) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return reply.status(400).send({
          error: 'Invalid token',
          message: 'Email verification token is invalid'
        });
      }
      
      console.error('Email verification error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to verify email'
      });
    }
  });
  
  // Get current user
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
          updatedAt: true
        }
      });
      
      if (!user) {
        return reply.status(404).send({
          error: 'User not found',
          message: 'User account not found'
        });
      }
      
      return reply.send({
        user
      });
      
    } catch (error) {
      console.error('Get user error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to get user information'
      });
    }
  });
}
