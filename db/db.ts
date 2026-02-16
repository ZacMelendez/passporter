import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Export Prisma client instance
export const db = prisma;

// Export Prisma types for convenience
export type { Entry } from '@prisma/client';

