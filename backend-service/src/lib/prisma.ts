import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Enhance DATABASE_URL with connection pool parameters if not already present
 * This helps prevent "connection pool timeout" errors in production
 */
function enhanceDatabaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // If URL already has connection_limit, return as-is (user configured)
  if (baseUrl.includes('connection_limit=')) {
    return baseUrl;
  }

  // Get connection pool settings from environment variables
  const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT || '20';
  const poolTimeout = process.env.DATABASE_POOL_TIMEOUT || '30';
  const connectTimeout = process.env.DATABASE_CONNECT_TIMEOUT || '10';

  // Append connection pool parameters to DATABASE_URL
  const separator = baseUrl.includes('?') ? '&' : '?';
  const params = [
    `connection_limit=${connectionLimit}`,
    `pool_timeout=${poolTimeout}`,
    `connect_timeout=${connectTimeout}`
  ].join('&');

  return `${baseUrl}${separator}${params}`;
}

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: enhanceDatabaseUrl(process.env.DATABASE_URL)
    }
  }
});

// Warm up connection pool on startup (production only)
if (process.env.NODE_ENV === 'production') {
  prisma.$connect().catch((err) => {
    console.error('Failed to connect to database on startup:', err);
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

