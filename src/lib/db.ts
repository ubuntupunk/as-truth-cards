// lib/db.ts
import { neon } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? (() => {
  if (typeof process === 'undefined') {
    return null as any; // Or some other placeholder
  }
  const sql = neon(process.env.DATABASE_URL!);
  return new PrismaClient();
})();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
