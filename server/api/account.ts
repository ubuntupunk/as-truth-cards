/**
 * Account onboarding state: `GET /api/account/onboarding` and
 * `POST /api/account/onboarding/complete`.
 *
 * Onboarding completion is *account state*, not a navigation detail. It is stored
 * on the user row (`user.onboarded_at`) so it survives reloads, devices and
 * sign-out, and it is set through this authenticated endpoint rather than
 * inferred from the onboarding page having been visited. The field is
 * `input: false` in `server/auth.ts`, so a client cannot mark itself onboarded by
 * putting it in a sign-up/session payload — only this route can.
 *
 * `markComplete` is **set-once**: the first completion timestamp is preserved and
 * repeat calls are a no-op, so "onboarded at" means the same thing no matter how
 * many times the client retries or re-renders.
 *
 * The store and session resolver are injected with lazy defaults, mirroring
 * `drafts.ts`: `lib/db.ts` opens a connection pool on import, so resolving it at
 * module scope would make this file unimportable without a database (by a unit
 * test, a lint pass or a build).
 */

import { Router, type Request } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { createOriginGuard } from '../lib/origin.js'

/** The signed-in actor a route trusts. Onboarding needs only an id. */
export type SessionActor = { readonly userId: string }

/** Resolves the current session, or `null` when signed out. Injected in tests. */
export type GetSession = (req: Request) => Promise<SessionActor | null>

/** The account state this module reads and writes. `null` means "not completed". */
export interface OnboardingState {
  readonly onboardedAt: string | null
}

/** Persistence port for onboarding state. Injected in tests. */
export interface OnboardingStore {
  /** Read the current state; never throws for a missing user (returns not-complete). */
  read(userId: string): Promise<OnboardingState>
  /** Set completion once; preserves the first timestamp on repeat calls. */
  markComplete(userId: string, at: Date): Promise<OnboardingState>
}

/** Collaborators the router needs. All optional; production defaults resolve lazily. */
export interface AccountRouterDeps {
  readonly store?: OnboardingStore
  readonly getSession?: GetSession
  /** Clock, injected so a test can assert the exact timestamp written. */
  readonly now?: () => Date
  /**
   * Trusted browser origins for the CSRF origin guard. Defaults to the shared
   * list; injected in tests so the guard can be exercised deterministically.
   */
  readonly trustedOrigins?: readonly string[]
}

/**
 * Prisma-backed store. `prisma` is imported lazily inside each method so merely
 * importing this module never opens a database connection.
 */
const prismaOnboardingStore: OnboardingStore = {
  async read(userId: string): Promise<OnboardingState> {
    const { prisma } = await import('../lib/db.js')
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardedAt: true },
    })
    return { onboardedAt: user?.onboardedAt?.toISOString() ?? null }
  },

  async markComplete(userId: string, at: Date): Promise<OnboardingState> {
    const { prisma } = await import('../lib/db.js')
    // `onboardedAt: null` in the WHERE clause is what makes this set-once: a second
    // call matches no row and leaves the original timestamp intact.
    await prisma.user.updateMany({
      where: { id: userId, onboardedAt: null },
      data: { onboardedAt: at },
    })
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardedAt: true },
    })
    return { onboardedAt: user?.onboardedAt?.toISOString() ?? null }
  },
}

/**
 * Build the account router.
 *
 * @param deps Optional collaborators. Production omits them and the lazily
 *   resolved defaults are used; tests supply fakes so the routes run without a
 *   database or an auth server.
 * @returns A configured `express` router.
 */
export function createAccountRouter(deps: AccountRouterDeps = {}): Router {
  let store = deps.store
  let getSession = deps.getSession
  const now = deps.now ?? (() => new Date())

  const resolveStore = (): OnboardingStore => {
    store ??= prismaOnboardingStore
    return store
  }
  const resolveSession = async (): Promise<GetSession> => {
    getSession ??= async (req) => {
      const { auth } = await import('../auth.js')
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      })
      return session ? { userId: session.user.id } : null
    }
    return getSession
  }

  const router = Router()

  // CSRF: the session cookie is sent on this endpoint, so reject state-changing
  // requests from an untrusted Origin *before* any session/DB work. CORS alone is
  // a browser control and does not stop a cross-site request from arriving.
  router.use(createOriginGuard({ trustedOrigins: deps.trustedOrigins }))

  router.get('/onboarding', async (req, res) => {
    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to view your account state' })
        return
      }
      res.json(await resolveStore().read(actor.userId))
    } catch (error) {
      console.error('Error reading onboarding state:', error)
      res.status(500).json({ error: 'Failed to read onboarding state' })
    }
  })

  router.post('/onboarding/complete', async (req, res) => {
    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to complete onboarding' })
        return
      }
      res.json(await resolveStore().markComplete(actor.userId, now()))
    } catch (error) {
      console.error('Error completing onboarding:', error)
      res.status(500).json({ error: 'Failed to complete onboarding' })
    }
  })

  return router
}

const router = createAccountRouter()

export default router
