import { PrismaClient } from '@prisma/client';

// Reuse a single PrismaClient across the whole app. On serverless (Vercel) a
// new client per module/invocation exhausts the database connection pool, so
// we cache one instance on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// How stale (ms) a source's lastFetched must be before we re-collect it within
// a run cycle. Shared so collection and the pipeline "is there work left?"
// checks agree.
export const STALE_SOURCE_MS = 12 * 60 * 60 * 1000; // 12h
