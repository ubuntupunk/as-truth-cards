import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './lib/db.js'
import { assertAuthSecretConfigured } from './lib/auth-secret.js'

/**
 * Refuse to construct an auth instance that silently signs sessions with Better Auth's
 * published fallback secret.
 *
 * This must happen here rather than in `server/index.ts`: ES module imports are hoisted and
 * evaluated before the importing module's body runs, so `betterAuth()` below would already
 * have been called by the time any statement in `index.ts` could check anything.
 */
assertAuthSecretConfigured()

/**
 * Better Auth configuration.
 *
 * Replaces Stack Auth, which was never actually wired up: it had env vars and an
 * orphaned `useUser()` call but no provider, no route handler, and no sign-in UI.
 * Users previously lived in Neon Auth's external `neon_auth.users_sync` table.
 *
 * Identity and sessions are Better Auth's job. Authorization is ours: the `role`
 * field below is the single source of truth for the UserRole ladder, folded onto
 * the user row so there is no second profile table to keep in sync.
 */
export const auth = betterAuth({
  appName: 'Trope Cards',

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
  },

  user: {
    additionalFields: {
      /**
       * Server-owned. `input: false` makes Better Auth reject a client-supplied
       * `role` and substitute the default instead, so a user cannot promote
       * themselves through the sign-up payload. Escalation is a deliberate,
       * server-side act.
       *
       * The string-literal union makes the Prisma generator emit a real Postgres
       * enum rather than free text, so the database rejects unknown roles too.
       */
      role: {
        type: ['ANONYMOUS', 'VERIFIED', 'ACADEMIC', 'RESEARCHER', 'MODERATOR', 'ADMIN'],
        required: false,
        defaultValue: 'ANONYMOUS',
        input: false,
      },
      bio: { type: 'string', required: false },
      website: { type: 'string', required: false },
      location: { type: 'string', required: false },
    },
  },

  /**
   * In development the browser talks to Vite on :8080, which proxies /api to the
   * Express server on :3001. Better Auth validates the Origin header against these,
   * so both need to be listed. Production is same-origin, so nothing extra is needed.
   */
  trustedOrigins: [
    'http://localhost:8080',
    'http://localhost:3001',
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
})

export type AuthSession = typeof auth.$Infer.Session
