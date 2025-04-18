// lib/db.ts
import { neon } from '@neondatabase/serverless';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? (() => {
  const sql = neon(process.env.DATABASE_URL!);
  const adapter = new PrismaNeonHTTP(sql);
  return new PrismaClient({ adapter });
})();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
