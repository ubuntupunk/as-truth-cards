/**
 * Host-schema cards: `GET /api/cards`, `GET /api/cards/:id`, and the write verbs
 * `POST|PUT|DELETE /api/cards`.
 *
 * Reads are public — the deck (`CardDeck.tsx`) and the graph browse cards signed-out — so
 * they stay open. The write verbs mutate the canonical host `Card` table that the whole
 * deck is built from, and the only caller is the admin panel (`Admin.tsx`), which already
 * gates the UI on an `ADMIN` session. The server enforces that same rule here rather than
 * trusting the client: signed-out writers get 401, signed-in non-admins get 403.
 *
 * Every collaborator is injected with a lazy default. The Prisma-backed store imports
 * `lib/db.js`, which opens a connection pool, so resolving it at module scope would make
 * this file unimportable without a database; tests pass a fake store and never touch the pool.
 */

import { Router, type Request, type Response } from 'express'
import { fromNodeHeaders } from 'better-auth/node'

/** The signed-in actor a route trusts: who they are, and the role the write gate checks. */
export type SessionActor = { readonly userId: string; readonly role: string }

/** Resolves the current session, or `null` when signed out. Injected in tests. */
export type GetSession = (req: Request) => Promise<SessionActor | null>

/** The role permitted to create, update, and delete canonical cards. */
export const CARD_WRITE_ROLE = 'ADMIN'

/** Fields a card create accepts. Mirrors the host `Card` columns the panel edits. */
export interface CardInput {
  readonly title: string
  readonly frontDescription: string
  readonly backDescription: string
  readonly symbol: string
  readonly imageUrl?: string
  readonly tags?: string[]
  readonly includedInPalestineStack?: boolean
  readonly isFeatured?: boolean
  readonly sources?: unknown
}

/** A stored card, structurally the Prisma row the router and the store share. */
export type StoredCard = {
  readonly id: number
  readonly createdAt: Date
  readonly title: string
  readonly frontDescription: string
  readonly backDescription: string
  readonly symbol: string
  readonly imageUrl: string | null
  readonly tags: string[]
  readonly includedInPalestineStack: boolean
  readonly isFeatured: boolean
  readonly sources: unknown
}

/** What the router reads and writes. The Prisma implementation is lazily injected. */
export interface HostCardStore {
  listAll(): Promise<StoredCard[]>
  getById(id: number): Promise<StoredCard | null>
  create(input: CardInput): Promise<StoredCard>
  update(id: number, input: Partial<CardInput>): Promise<StoredCard>
  remove(id: number): Promise<void>
}

/** Collaborators the router needs. All optional; production defaults resolve lazily. */
export type CardsRouterDeps = {
  readonly store?: HostCardStore
  readonly getSession?: GetSession
}

/** Parse a path id once, so both the public read and the gated writes agree on what is valid. */
function parseId(raw: string): number | null {
  const id = parseInt(raw, 10)
  return Number.isNaN(id) ? null : id
}

/**
 * Build the cards router.
 *
 * @param deps Optional collaborators. Production omits them and the lazily-resolved Prisma
 * defaults are used; tests supply a fake store and session so the route can be exercised
 * without a database or an auth server.
 * @returns A configured `express` router.
 */
export function createCardsRouter(deps: CardsRouterDeps = {}): Router {
  let store = deps.store
  let getSession = deps.getSession

  const resolveStore = async (): Promise<HostCardStore> => {
    if (!store) {
      const { default: prisma } = await import('../lib/db.js')
      store = {
        listAll: async () =>
          prisma.card.findMany({ orderBy: { createdAt: 'desc' } }),
        getById: async (id) => prisma.card.findUnique({ where: { id } }),
        create: async (input) =>
          prisma.card.create({
            data: {
              title: input.title,
              frontDescription: input.frontDescription,
              backDescription: input.backDescription,
              symbol: input.symbol,
              imageUrl: input.imageUrl,
              tags: input.tags ?? [],
              includedInPalestineStack: input.includedInPalestineStack ?? false,
              isFeatured: input.isFeatured ?? false,
              sources: input.sources as object | undefined,
            },
          }),
        update: async (id, input) =>
          prisma.card.update({
            where: { id },
            data: {
              ...(input.title && { title: input.title }),
              ...(input.frontDescription && {
                frontDescription: input.frontDescription,
              }),
              ...(input.backDescription && {
                backDescription: input.backDescription,
              }),
              ...(input.symbol && { symbol: input.symbol }),
              ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
              ...(input.tags && { tags: input.tags }),
              ...(input.includedInPalestineStack !== undefined && {
                includedInPalestineStack: input.includedInPalestineStack,
              }),
              ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
              ...(input.sources !== undefined && {
                sources: input.sources as object,
              }),
            },
          }),
        remove: async (id) => {
          await prisma.card.delete({ where: { id } })
        },
      }
    }
    return store
  }

  const resolveSession = async (): Promise<GetSession> => {
    if (!getSession) {
      getSession = async (req) => {
        const { auth } = await import('../auth.js')
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(req.headers),
        })
        return session
          ? { userId: session.user.id, role: String(session.user.role) }
          : null
      }
    }
    return getSession
  }

  /**
   * Gate a write verb: 401 when signed out, 403 when signed in without the write role.
   *
   * @param req The incoming request, used to resolve the session.
   * @param res The response to short-circuit when the caller is not allowed to write.
   * @returns `true` when the caller may proceed; `false` after a 401/403 has been sent.
   */
  const allowWrite = async (req: Request, res: Response): Promise<boolean> => {
    const actor = await (await resolveSession())(req)
    if (!actor) {
      res.status(401).json({ error: 'Sign in to manage cards' })
      return false
    }
    if (actor.role !== CARD_WRITE_ROLE) {
      res.status(403).json({ error: 'Admin role required to manage cards' })
      return false
    }
    return true
  }

  const router = Router()

  router.get('/', async (_req, res) => {
    try {
      res.json(await (await resolveStore()).listAll())
    } catch (error) {
      console.error('Error fetching cards:', error)
      res.status(500).json({ error: 'Failed to fetch cards' })
    }
  })

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id)
    if (id === null) {
      res.status(400).json({ error: 'Invalid card id' })
      return
    }

    try {
      const card = await (await resolveStore()).getById(id)
      if (!card) {
        res.status(404).json({ error: 'Card not found' })
        return
      }
      res.json(card)
    } catch (error) {
      console.error('Error fetching card:', error)
      res.status(500).json({ error: 'Failed to fetch card' })
    }
  })

  router.post('/', async (req, res) => {
    if (!(await allowWrite(req, res))) return

    try {
      const card = await (await resolveStore()).create(req.body as CardInput)
      res.status(201).json(card)
    } catch (error) {
      console.error('Error creating card:', error)
      res.status(500).json({ error: 'Failed to create card' })
    }
  })

  router.put('/:id', async (req, res) => {
    if (!(await allowWrite(req, res))) return

    const id = parseId(req.params.id)
    if (id === null) {
      res.status(400).json({ error: 'Invalid card id' })
      return
    }

    try {
      const card = await (await resolveStore()).update(id, req.body as Partial<CardInput>)
      res.json(card)
    } catch (error) {
      console.error('Error updating card:', error)
      res.status(500).json({ error: 'Failed to update card' })
    }
  })

  router.delete('/:id', async (req, res) => {
    if (!(await allowWrite(req, res))) return

    const id = parseId(req.params.id)
    if (id === null) {
      res.status(400).json({ error: 'Invalid card id' })
      return
    }

    try {
      await (await resolveStore()).remove(id)
      res.status(204).send()
    } catch (error) {
      console.error('Error deleting card:', error)
      res.status(500).json({ error: 'Failed to delete card' })
    }
  })

  return router
}

const router = createCardsRouter()

export default router