/**
 * Card interactions: `POST /api/interactions` and `GET /api/interactions/card/:cardId`.
 *
 * This is *participation data*: a card-scoped log of views, shares, and votes. Identity is
 * **server-derived** — the `userId` on a stored interaction comes only from the validated
 * Better Auth session, never from the request body. A client that sends its own identity
 * field is rejected rather than trusted.
 *
 * The anonymous-vs-authenticated policy (issue #11, acceptance criterion 3) is a single,
 * explicitly-typed table below instead of scattered conditionals, so the day email
 * verification lands, changing which interactions require an account is a one-line flip.
 * Today every routed type is anonymous-allowed — the deck vote surface (`Card.tsx`) runs
 * signed-out and gates on `localStorage`, and no account UI/provider is shipped yet.
 * The richer feedback/moderation types in the schema (`STRUCTURED_FEEDBACK`,
 * `ACADEMIC_FEEDBACK`, `MODERATION_ACTION`) are not routable here at all and are rejected as
 * unknown, so nothing content-bearing or authority-bearing can be recorded anonymously.
 *
 * Every collaborator is injected with a lazy default. The Prisma-backed store imports
 * `lib/db.js`, which opens a Prisma client, so resolving it at module scope would make this
 * file unimportable without a database; tests pass fakes and never touch the pool.
 */

import { Router, type Request } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { z } from 'zod'

/** The interaction types this router accepts. A strict subset of the schema's enum. */
export const ROUTED_INTERACTION_TYPES = ['VIEW', 'SHARE', 'RATING_UP', 'RATING_DOWN'] as const

export type RoutedInteractionType = (typeof ROUTED_INTERACTION_TYPES)[number]

/**
 * Which interaction types require an authenticated actor, by accept-criterion 3.
 *
 * Empty assignment today: views, shares, and deck votes are anonymous participation and the
 * app has no account UI shipped yet. When `emailAndPassword`/verification lands, flip
 * `RATING_*` to `'authenticated'` here (one line, tested) rather than in the payload logic.
 * Anything not in this table is rejected as an unknown type before the policy is consulted.
 */
export const INTERACTION_AUTH_POLICY: Readonly<Record<RoutedInteractionType, 'anonymous' | 'authenticated'>> = {
  VIEW: 'anonymous',
  SHARE: 'anonymous',
  RATING_UP: 'anonymous',
  RATING_DOWN: 'anonymous',
}

/** The signed-in actor a route trusts. Deliberately just an id — interactions need nothing else. */
export type SessionActor = { readonly userId: string }

/** Resolves the current session, or `null` when signed out. Injected in tests. */
export type GetSession = (req: Request) => Promise<SessionActor | null>

/**
 * A stored interaction, structurally the Prisma row the router and the store share.
 *
 * `interactionType` is the schema's full enum, not the routed subset: the router only ever
 * writes `RoutedInteractionType`, but a read is a read — it can surface any row already in
 * the table, so the type stays honest about what the column can hold.
 */
export type StoredInteraction = {
  readonly id: number
  readonly cardId: number
  readonly userId: string | null
  readonly interactionType: string
  readonly feedbackRating: number | null
  readonly feedbackText: string | null
  readonly ipAddress: string | null
  readonly createdAt: Date
}

/** What the router can write and read. The Prisma implementation is lazily injected. */
export interface InteractionStore {
  create(input: {
    readonly cardId: number
    readonly interactionType: RoutedInteractionType
    readonly userId: string | null
    readonly feedbackRating: number | null
    readonly feedbackText: string | null
  }): Promise<StoredInteraction>
  listByCard(cardId: number): Promise<StoredInteraction[]>
}

/** Asked whether a card exists, so the router can keep the existing 404 without a second concern. */
export interface CardPresence {
  exists(cardId: number): Promise<boolean>
}

/** Collaborators the router needs. All optional; production defaults resolve lazily. */
export type InteractionsRouterDeps = {
  readonly store?: InteractionStore
  readonly presence?: CardPresence
  readonly getSession?: GetSession
}

/** Rejects any payload that is not exactly the routed shape — including a `userId` field. */
const interactionInputSchema = z
  .object({
    cardId: z.number().int().positive(),
    interactionType: z.enum(ROUTED_INTERACTION_TYPES),
    feedbackRating: z.number().int().min(1).max(5).nullish(),
    feedbackText: z.string().trim().max(2000).nullish(),
  })
  .strict()

type ZodIssueView = { path: string; message: string }

/**
 * Flatten Zod issues into a stable, serialisable shape.
 *
 * @param error A failed parse.
 * @returns One `{ path, message }` entry per issue, path rendered dot-joined.
 */
function issuesOf(error: z.ZodError): ZodIssueView[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}

/**
 * Build the interactions router.
 *
 * @param deps Optional collaborators. Production omits them and the lazily-resolved Prisma
 * defaults are used; tests supply fakes so the route can be exercised without a database or
 * an auth server.
 * @returns A configured `express` router.
 */
export function createInteractionsRouter(deps: InteractionsRouterDeps = {}): Router {
  let store = deps.store
  let presence = deps.presence
  let getSession = deps.getSession

  const resolveStore = async (): Promise<InteractionStore> => {
    if (!store) {
      const { default: prisma } = await import('../lib/db.js')
      store = {
        async create(input) {
          return prisma.userInteraction.create({
            data: {
              cardId: input.cardId,
              interactionType: input.interactionType,
              userId: input.userId,
              feedbackRating: input.feedbackRating,
              feedbackText: input.feedbackText,
              status: 'APPROVED',
            },
          })
        },
        async listByCard(cardId) {
          return prisma.userInteraction.findMany({
            where: { cardId },
            orderBy: { createdAt: 'desc' },
          })
        },
      }
    }
    return store
  }

  const resolvePresence = async (): Promise<CardPresence> => {
    if (!presence) {
      const { default: prisma } = await import('../lib/db.js')
      presence = {
        async exists(cardId) {
          return (
            (await prisma.card.findUnique({
              where: { id: cardId },
              select: { id: true },
            })) !== null
          )
        },
      }
    }
    return presence
  }

  const resolveSession = async (): Promise<GetSession> => {
    if (!getSession) {
      getSession = async (req) => {
        const { auth } = await import('../auth.js')
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(req.headers),
        })
        return session ? { userId: session.user.id } : null
      }
    }
    return getSession
  }

  const router = Router()

  router.post('/', async (req, res) => {
    const parsed = interactionInputSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid interaction',
        issues: issuesOf(parsed.error),
      })
      return
    }

    try {
      // Identity is the actor's session, never the body. The payload schema `.strict()`
      // already rejected a client-supplied `userId`; nothing below even looks for one.
      const actor = await (await resolveSession())(req)

      const { cardId, interactionType, feedbackRating, feedbackText } = parsed.data
      if (INTERACTION_AUTH_POLICY[interactionType] === 'authenticated' && !actor) {
        res.status(401).json({ error: 'Sign in to record this interaction' })
        return
      }

      if (!(await (await resolvePresence()).exists(cardId))) {
        res.status(404).json({ error: 'Card not found' })
        return
      }

      const interaction = await (await resolveStore()).create({
        cardId,
        interactionType,
        userId: actor?.userId ?? null,
        feedbackRating: feedbackRating ?? null,
        feedbackText: feedbackText ?? null,
      })

      res.status(201).json(interaction)
    } catch (error) {
      console.error('Error creating interaction:', error)
      res.status(500).json({ error: 'Failed to create interaction' })
    }
  })

  router.get('/card/:cardId', async (req, res) => {
    const cardId = parseInt(req.params.cardId, 10)
    if (Number.isNaN(cardId)) {
      res.status(400).json({ error: 'Invalid card id' })
      return
    }

    try {
      // Card-scoped activity includes who interacted and any feedback text, so it is not
      // served to the public; participation reads require a signed-in account.
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to view card interactions' })
        return
      }

      const interactions = await (await resolveStore()).listByCard(cardId)
      res.json(interactions)
    } catch (error) {
      console.error('Error fetching interactions:', error)
      res.status(500).json({ error: 'Failed to fetch interactions' })
    }
  })

  return router
}

const router = createInteractionsRouter()

export default router