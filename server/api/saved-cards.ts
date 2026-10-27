/**
 * Saved cards: `GET /api/saved-cards`, `POST /api/saved-cards`, `DELETE /api/saved-cards/:slug`.
 *
 * Identity is server-derived from the validated Better Auth session (never from the body).
 * Keys to canonical trope_graph cards by slug; idempotent save via unique (userId, cardSlug).
 */

import { Router, type Request } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { z } from 'zod'

export type SessionActor = { readonly userId: string }

export type GetSession = (req: Request) => Promise<SessionActor | null>

export interface SavedCardStore {
  list(userId: string): Promise<Array<{ slug: string; createdAt: Date }>>
  save(input: { userId: string; cardSlug: string }): Promise<void>
  unsave(input: { userId: string; cardSlug: string }): Promise<void>
  isSaved(input: { userId: string; cardSlug: string }): Promise<boolean>
}

export type SavedCardsRouterDeps = {
  readonly store?: SavedCardStore
  readonly getSession?: GetSession
}

const saveSchema = z.object({ cardSlug: z.string().min(1).max(200) }).strict()

export function createSavedCardsRouter(deps: SavedCardsRouterDeps = {}): Router {
  let store = deps.store
  let getSession = deps.getSession

  const resolveStore = async (): Promise<SavedCardStore> => {
    if (!store) {
      const { default: prisma } = await import('../lib/db.js')
      store = {
        async list(userId) {
          const rows = await prisma.savedCard.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { cardSlug: true, createdAt: true },
          })
          return rows.map((r) => ({ slug: r.cardSlug, createdAt: r.createdAt }))
        },
        async save(input) {
          await prisma.savedCard.upsert({
            where: { userId_cardSlug: { userId: input.userId, cardSlug: input.cardSlug } },
            create: { userId: input.userId, cardSlug: input.cardSlug },
            update: {},
          })
        },
        async unsave(input) {
          try {
            await prisma.savedCard.delete({
              where: { userId_cardSlug: { userId: input.userId, cardSlug: input.cardSlug } },
            })
          } catch {
            // ignore if not found
          }
        },
        async isSaved(input) {
          const row = await prisma.savedCard.findUnique({
            where: { userId_cardSlug: { userId: input.userId, cardSlug: input.cardSlug } },
            select: { id: true },
          })
          return row !== null
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
        return session ? { userId: session.user.id } : null
      }
    }
    return getSession
  }

  const router = Router()

  router.get('/', async (req, res) => {
    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to view saved cards' })
        return
      }
      const saved = await (await resolveStore()).list(actor.userId)
      res.json({ saved })
    } catch (error) {
      console.error('Error listing saved cards:', error)
      res.status(500).json({ error: 'Failed to list saved cards' })
    }
  })

  router.get('/check/:slug', async (req, res) => {
    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.json({ saved: false })
        return
      }
      const saved = await (await resolveStore()).isSaved({ userId: actor.userId, cardSlug: req.params.slug })
      res.json({ saved })
    } catch (error) {
      console.error('Error checking saved card:', error)
      res.status(500).json({ error: 'Failed to check saved card' })
    }
  })

  router.post('/', async (req, res) => {
    const parsed = saveSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues })
      return
    }
    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to save cards' })
        return
      }
      await (await resolveStore()).save({ userId: actor.userId, cardSlug: parsed.data.cardSlug })
      res.status(201).json({ saved: true })
    } catch (error) {
      console.error('Error saving card:', error)
      res.status(500).json({ error: 'Failed to save card' })
    }
  })

  router.delete('/:slug', async (req, res) => {
    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to unsave cards' })
        return
      }
      await (await resolveStore()).unsave({ userId: actor.userId, cardSlug: req.params.slug })
      res.json({ saved: false })
    } catch (error) {
      console.error('Error unsaving card:', error)
      res.status(500).json({ error: 'Failed to unsave card' })
    }
  })

  return router
}

const router = createSavedCardsRouter()
export default router
