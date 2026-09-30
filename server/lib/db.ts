// Named import, not default. Prisma's generated client is CommonJS without an
// `__esModule` marker, so under Node's ESM interop a default import resolves to the
// whole `module.exports` object and `new Default()` throws "not a constructor".
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  // The instance type, not `typeof PrismaClient` (the constructor). Caching the
  // constructor here would defeat the dev-mode singleton this guard exists for.
  prisma: InstanceType<typeof PrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma