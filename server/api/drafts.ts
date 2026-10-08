/**
 * Compose/Decompose drafts: `GET|PUT|DELETE /api/drafts/:cardSlug`, plus
 * `GET /api/drafts/vocabularies`.
 *
 * Signed-in users author a claim decomposition and optional argument chains against a card.
 * That work is *participation data*: it lives in `public.decomposition_drafts`, scoped to
 * the user, and never reaches the canonical `trope_graph` schema. Canonicalising a draft is
 * a separate, deliberate editorial act that this module deliberately cannot perform — see
 * `docs/issue.md` §6 and the ROADMAP acceptance criterion that user analysis cannot silently
 * become canonical. The response therefore carries no "canonical" affordance at all: the
 * only thing a draft can be is a draft.
 *
 * The route enforces structure itself (`draft-contract.ts`) and asks the read-only graph
 * port to confirm that every referenced claim exists *and belongs to the card*. The port is
 * read-only by contract, so the worst a malformed or malicious draft can do is be rejected.
 *
 * Every collaborator is injected with a lazy default. `PrismaDraftStore` opens a connection
 * pool on import and `auth.ts` imports Prisma, so resolving them at module scope would make
 * this file unimportable without a database — by a unit test, a lint pass, or a build. They
 * are resolved on first request instead, and tests pass fakes and never touch the pool.
 */

import { Router, type Request } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { z } from 'zod'
import type { TropeGraphReader } from '../../trope-cards/src/graph/reader.js'
import {
  DECOMPOSITION_VOCABULARIES,
  draftPayloadSchema,
  referencedClaimIds,
} from '../composition/draft-contract.js'
import type { DraftStore } from '../composition/draft-store.js'

/** The signed-in actor a route trusts. Deliberately just an id — drafts need nothing else. */
export type SessionActor = { readonly userId: string }

/** Resolves the current session, or `null` when signed out. Injected in tests. */
export type GetSession = (req: Request) => Promise<SessionActor | null>

/** Collaborators the router needs. All optional; production defaults resolve lazily. */
export type DraftsRouterDeps = {
  readonly store?: DraftStore
  readonly graph?: TropeGraphReader
  readonly getSession?: GetSession
}

const cardSlugSchema = z.string().trim().min(1).max(200)

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
 * Claims in the payload that are not on the given card.
 *
 * Resolved one id at a time through the read port. Drafts are hand-authored and bounded, so
 * this is a handful of lookups, not a hot path — and going through the port (rather than
 * querying) keeps the graph's schema inside the graph layer.
 *
 * @param graph The read-only graph port.
 * @param cardId The card the draft is authored against.
 * @param claimIds The distinct claim ids the draft references.
 * @returns The offending ids, in input order. Empty when every reference is sound.
 */
export async function claimsOffCard(
  graph: TropeGraphReader,
  cardId: string,
  claimIds: readonly string[],
): Promise<string[]> {
  const offenders: string[] = []
  for (const claimId of claimIds) {
    const claim = await graph.findClaimByRef(claimId)
    if (!claim || claim.cardId !== cardId) offenders.push(claimId)
  }
  return offenders
}

/**
 * Build the drafts router.
 *
 * @param deps Optional collaborators. Production omits them and the lazily-resolved
 * defaults are used; tests supply fakes so the route can be exercised without a database or
 * an auth server.
 * @returns A configured `express` router.
 */
export function createDraftsRouter(deps: DraftsRouterDeps = {}): Router {
  let store = deps.store
  let graph = deps.graph
  let getSession = deps.getSession

  const resolveStore = async (): Promise<DraftStore> => {
    store ??= new (await import('../composition/draft-store.js')).PrismaDraftStore()
    return store
  }
  const resolveGraph = async (): Promise<TropeGraphReader> => {
    graph ??= new (await import('../../trope-cards/src/graph/drizzle-reader.js'))
      .DrizzleGraphReader()
    return graph
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

  // Declared before `/:cardSlug` so the literal path is not swallowed by the param route.
  router.get('/vocabularies', (_req, res) => {
    res.json({ vocabularies: DECOMPOSITION_VOCABULARIES })
  })

  router.get('/:cardSlug', async (req, res) => {
    const slug = cardSlugSchema.safeParse(req.params.cardSlug)
    if (!slug.success) {
      res.status(400).json({ error: 'Invalid card reference' })
      return
    }

    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to view your decomposition drafts' })
        return
      }

      const card = await (await resolveGraph()).findCardByRef(slug.data)
      if (!card) {
        res.status(404).json({ error: `Card "${slug.data}" could not be resolved` })
        return
      }

      const draft = await (await resolveStore()).find(actor.userId, card.slug)
      res.json({ draft })
    } catch (error) {
      console.error('Error reading decomposition draft:', error)
      res.status(500).json({ error: 'Failed to read decomposition draft' })
    }
  })

  router.put('/:cardSlug', async (req, res) => {
    const slug = cardSlugSchema.safeParse(req.params.cardSlug)
    if (!slug.success) {
      res.status(400).json({ error: 'Invalid card reference' })
      return
    }

    const body = req.body as { payload?: unknown } | undefined
    const parsed = draftPayloadSchema.safeParse(body?.payload)
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid decomposition draft',
        issues: issuesOf(parsed.error),
      })
      return
    }

    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to save a decomposition draft' })
        return
      }

      const port = await resolveGraph()
      const card = await port.findCardByRef(slug.data)
      if (!card) {
        res.status(404).json({ error: `Card "${slug.data}" could not be resolved` })
        return
      }

      // Structural validity is not enough: a draft may only reason over claims that are on
      // the card it is authored against. This is what stops a valid-looking payload from
      // smuggling another card's claims in under this card's name.
      const offenders = await claimsOffCard(
        port,
        card.id,
        referencedClaimIds(parsed.data),
      )
      if (offenders.length > 0) {
        res.status(400).json({
          error: 'Draft references claims that are not on this card',
          detail: { claims: offenders },
        })
        return
      }

      const draft = await (await resolveStore()).upsert(
        actor.userId,
        card.slug,
        parsed.data,
      )
      res.json({ draft })
    } catch (error) {
      console.error('Error saving decomposition draft:', error)
      res.status(500).json({ error: 'Failed to save decomposition draft' })
    }
  })

  router.delete('/:cardSlug', async (req, res) => {
    const slug = cardSlugSchema.safeParse(req.params.cardSlug)
    if (!slug.success) {
      res.status(400).json({ error: 'Invalid card reference' })
      return
    }

    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to manage decomposition drafts' })
        return
      }

      // Idempotent: deleting a draft that was never saved (or already deleted) is a
      // success, because the caller's intent — "this draft should not exist" — holds.
      await (await resolveStore()).remove(actor.userId, slug.data)
      res.status(204).end()
    } catch (error) {
      console.error('Error deleting decomposition draft:', error)
      res.status(500).json({ error: 'Failed to delete decomposition draft' })
    }
  })

  return router
}

const router = createDraftsRouter()

export default router
