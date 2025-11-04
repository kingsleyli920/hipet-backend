import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import * as bcrypt from 'bcrypt';
import oauthService from '../services/oauthService';

const prisma = new PrismaClient();

// Validation schemas
const googleAuthSchema = z.object({
  code: z.string(),
  state: z.string().optional()
});

export default async function oauthRoutes(fastify, options) {
  // Generate Google OAuth authorization URL (no auth required for login)
  fastify.get('/google/auth-url', async (request, reply) => {
    try {
      const state = jwt.sign(
        { timestamp: Date.now(), source: 'login' },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );

      const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:8000'}/auth/google/callback`;
      const authUrl = oauthService.getGoogleAuthUrl(redirectUri, state);

      return reply.send({
        message: 'Google OAuth authorization URL generated',
        authUrl,
        state
      });
    } catch (error) {
      console.error('Generate auth URL error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate authorization URL'
      });
    }
  });

  // Handle Google OAuth callback
  fastify.get('/google/callback', async (request, reply) => {
    try {
      const { code, state, error } = request.query;

      if (error) {
        return reply.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent(error)}`);
      }

      if (!code) {
        return reply.redirect(`${process.env.FRONTEND_URL}/auth/error?error=missing_code`);
      }

      // Verify state parameter
      let decodedState;
      try {
        decodedState = jwt.verify(state, process.env.JWT_SECRET);
      } catch (error) {
        return reply.redirect(`${process.env.FRONTEND_URL}/auth/error?error=invalid_state`);
      }

      // Exchange code for tokens
      const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:8000'}/auth/google/callback`;
      const tokenResult = await oauthService.exchangeCodeForTokens(code, redirectUri);

      if (!tokenResult.success) {
        console.error('Token exchange failed:', tokenResult);
        return reply.redirect(`${process.env.FRONTEND_URL}/auth/error?error=token_exchange_failed`);
      }

      const tokens = tokenResult;

      // Get user info from Google using oauthService
      const userInfoResult = await oauthService.verifyGoogleToken(tokens.access_token);
      
      if (!userInfoResult.success) {
        console.error('User info retrieval failed:', userInfoResult);
        return reply.redirect(`${process.env.FRONTEND_URL}/auth/error?error=user_info_failed`);
      }

      const userInfo = userInfoResult.user;

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { email: userInfo.email }
      });

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: userInfo.email,
            firstName: userInfo.given_name || userInfo.name,
            lastName: userInfo.family_name,
            avatarUrl: userInfo.picture,
            emailVerified: userInfo.verified_email || true
          }
        });
      } else {
        // Update existing user with latest Google info
        await prisma.user.update({
          where: { id: user.id },
          data: {
            firstName: userInfo.given_name || userInfo.name,
            lastName: userInfo.family_name,
            avatarUrl: userInfo.picture,
            emailVerified: userInfo.verified_email || true
          }
        });
      }

      // Create or update OAuth account
      await prisma.oAuthAccount.upsert({
        where: {
          provider_providerId: {
            provider: 'google',
            providerId: userInfo.id
          }
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          provider: 'google',
          providerId: userInfo.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
        }
      });

      // Generate JWT tokens
      const accessToken = jwt.sign(
        { userId: user.id, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' } // Consistent with regular login
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Store session
      const tokenHash = bcrypt.hashSync(refreshToken, 10);
      await prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip
        }
      });

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Redirect to frontend with tokens (use existing /auth/callback page)
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
      redirectUrl.searchParams.set('access_token', accessToken);
      redirectUrl.searchParams.set('refresh_token', refreshToken);
      redirectUrl.searchParams.set('user_id', user.id);

      return reply.redirect(redirectUrl.toString());

    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return reply.redirect(`${process.env.FRONTEND_URL}/auth/error?error=callback_failed`);
    }
  });

  // Handle OAuth errors
  fastify.get('/error', async (request, reply) => {
    const { error } = request.query;
    
    return reply.send({
      error: 'OAuth authentication failed',
      details: error,
      message: 'Please try again or contact support if the problem persists'
    });
  });

  // Revoke Google OAuth access
  fastify.post('/google/revoke', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      // Get user's Google OAuth account
      const oauthAccount = await prisma.oAuthAccount.findFirst({
        where: {
          userId: request.user.userId,
          provider: 'google'
        }
      });

      if (!oauthAccount) {
        return reply.status(404).send({
          error: 'OAuth account not found',
          message: 'No Google OAuth account linked to this user'
        });
      }

      // Revoke access with Google using oauthService
      if (oauthAccount.accessToken) {
        const revokeResult = await oauthService.revokeToken(oauthAccount.accessToken);
        if (!revokeResult.success) {
          console.error('Failed to revoke token with Google:', revokeResult);
        }
      }

      // Remove OAuth account from database
      await prisma.oAuthAccount.delete({
        where: { id: oauthAccount.id }
      });

      return reply.send({
        message: 'Google OAuth access revoked successfully'
      });

    } catch (error) {
      console.error('Revoke OAuth error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to revoke OAuth access'
      });
    }
  });

  // Get OAuth status
  fastify.get('/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const oauthAccounts = await prisma.oAuthAccount.findMany({
        where: { userId: request.user.userId },
        select: {
          provider: true,
          createdAt: true,
          expiresAt: true
        }
      });

      return reply.send({
        message: 'OAuth status retrieved successfully',
        accounts: oauthAccounts
      });

    } catch (error) {
      console.error('Get OAuth status error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to get OAuth status'
      });
    }
  });
}
