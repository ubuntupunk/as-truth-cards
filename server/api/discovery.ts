/**
 * Research-source discovery and review: `/api/discovery/*`.
 *
 * This router is deliberately separate from `/api/graph`. The graph API is a *read-only*
 * projection of `trope_graph` (see `server/api/graph.ts`), and discovery writes candidates
 * and review decisions. Bolting writes onto the read contract would blur the one boundary the
 * graph API exists to keep, so the write workflow gets its own router and its own mount.
 *
 * Every route here is **admin-only**. The review queue is editorial: it holds proposed
 * sources and the decisions a human made about them, and it is not public participation data.
 * Signed-out callers get 401; signed-in non-admins get 403 — the same rule the card write
 * verbs use.
 *
 * What this router cannot do is as important as what it can:
 *   - `POST /search` records candidates; it never creates a source and never approves one.
 *   - `POST /candidates/:id/review` records a decision; approval alone does **not** promote.
 *   - `POST /candidates/:id/promote` links a candidate to a source a human created or matched.
 *     It creates no attribution and no evidence. Support still runs only through
 *     `claim_sources` / `evidence_claims`, never through discovery.
 *
 * Collaborators are injected with lazy defaults, so importing this file never opens a pool or
 * reads the environment; tests pass fakes.
 */

import { Router, type Request, type Response } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { z } from 'zod'

import {
  DISCOVERY_LIMIT_MAX,
  type DiscoveryQueryError,
  type DiscoveryServicePort,
} from '../../trope-cards/src/discovery/service.js'
import {
  REVIEW_DECISIONS,
  type CandidateListFilter,
  type ReviewDecision,
} from '../../trope-cards/src/discovery/store.js'
import { DiscoveryProviderError } from '../../trope-cards/src/discovery/types.js'

/** The signed-in actor a route trusts: who they are, and the role the gate checks. */
export type SessionActor = { readonly userId: string; readonly role: string }

/** Resolves the current session, or `null` when signed out. Injected in tests. */
export type GetSession = (req: Request) => Promise<SessionActor | null>

/** The role permitted to run discovery and review candidates. */
export const DISCOVERY_ROLE = 'ADMIN'

/** Collaborators the router needs. All optional; production defaults resolve lazily. */
export type DiscoveryRouterDeps = {
  readonly service?: DiscoveryServicePort
  readonly getSession?: GetSession
}

/** Default and maximum page sizes for the candidate listing. */
const LIST_LIMIT_DEFAULT = 50
const LIST_LIMIT_MAX = 200
const LIST_OFFSET_MAX = 10_000

/** Every review status a listing may filter on, including the pre-review state. */
const REVIEW_STATUSES = ['CANDIDATE', ...REVIEW_DECISIONS] as const

const reviewBodySchema = z
  .object({
    decision: z.enum(REVIEW_DECISIONS),
    notes: z.string().trim().max(2000).nullish(),
    expectedRevision: z.number().int().min(0),
  })
  .strict()

const promoteBodySchema = z
  .object({
    sourceId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
  })
  .strict()

const searchBodySchema = z
  .object({
    provider: z.string().trim().min(1).max(50),
    query: z.string().trim().min(1).max(500),
    limit: z.number().int().min(1).max(DISCOVERY_LIMIT_MAX).optional(),
  })
  .strict()

/** Flatten Zod issues into a stable, serialisable shape. */
function issuesOf(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}

/** Parse a clamped non-negative integer page parameter. */
function parsePageInt(raw: unknown, name: string, fallback: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (Array.isArray(raw)) return null
  const value = Number(String(raw))
  if (!Number.isInteger(value) || value < 0) return null
  return Math.min(value, max)
}

/**
 * Parse and validate the candidate listing query.
 *
 * @param query Express query object.
 * @returns The filter, or `{ error }` when a parameter is malformed.
 */
function parseCandidateListQuery(
  query: Record<string, unknown>,
): { filter: CandidateListFilter } | { error: string } {
  const limit = parsePageInt(query.limit, 'limit', LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX)
  if (limit === null) return { error: 'limit must be a non-negative whole number' }
  const offset = parsePageInt(query.offset, 'offset', 0, LIST_OFFSET_MAX)
  if (offset === null) return { error: 'offset must be a non-negative whole number' }

  let status: CandidateListFilter['status']
  if (query.status !== undefined) {
    if (typeof query.status !== 'string' || !REVIEW_STATUSES.includes(query.status as never)) {
      return { error: `status must be one of: ${REVIEW_STATUSES.join(', ')}` }
    }
    status = query.status as CandidateListFilter['status']
  }

  let provider: string | undefined
  if (query.provider !== undefined) {
    if (typeof query.provider !== 'string' || !/^[a-z0-9_-]{1,50}$/.test(query.provider)) {
      return { error: 'provider must be a lower-case provider key' }
    }
    provider = query.provider
  }

  return { filter: { status, provider, limit, offset } }
}

/**
 * Build the discovery router.
 *
 * @param deps Optional collaborators; production omits them and resolves the Crossref
 * provider plus the Drizzle store on first use.
 * @returns A configured `express` router.
 */
export function createDiscoveryRouter(deps: DiscoveryRouterDeps = {}): Router {
  let service = deps.service
  let getSession = deps.getSession

  const resolveService = async (): Promise<DiscoveryServicePort> => {
    if (!service) {
      const { DrizzleDiscoveryStore } = await import(
        '../../trope-cards/src/discovery/store.js'
      )
      const { createCrossrefProvider } = await import(
        '../../trope-cards/src/discovery/providers/crossref.js'
      )
      const { createDiscoveryService } = await import(
        '../../trope-cards/src/discovery/service.js'
      )
      const mailto = process.env.CROSSREF_MAILTO?.trim()
      service = createDiscoveryService({
        providers: [createCrossrefProvider(mailto ? { mailto } : {})],
        store: new DrizzleDiscoveryStore(),
      })
    }
    return service
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

  const allowAdmin = async (req: Request, res: Response): Promise<boolean> => {
    const actor = await (await resolveSession())(req)
    if (!actor) {
      res.status(401).json({ error: 'Sign in to review research sources' })
      return false
    }
    if (actor.role !== DISCOVERY_ROLE) {
      res.status(403).json({ error: 'Admin role required to review research sources' })
      return false
    }
    return true
  }

  const router = Router()

  router.get('/candidates', async (req, res) => {
    if (!(await allowAdmin(req, res))) return

    const parsed = parseCandidateListQuery(req.query as Record<string, unknown>)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }

    try {
      const { items, total } = await (await resolveService()).listCandidates(
        parsed.filter,
      )
      res.json({
        items,
        total,
        limit: parsed.filter.limit,
        offset: parsed.filter.offset,
      })
    } catch (error) {
      console.error('Error listing discovery candidates:', error)
      res.status(500).json({ error: 'Failed to list discovery candidates' })
    }
  })

  router.post('/search', async (req, res) => {
    if (!(await allowAdmin(req, res))) return

    const parsed = searchBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', issues: issuesOf(parsed.error) })
      return
    }

    try {
      const result = await (await resolveService()).discover(parsed.data)
      res.status(201).json(result)
    } catch (error) {
      handleServiceError(res, error, 'discovery search')
    }
  })

  router.get('/candidates/:id/events', async (req, res) => {
    if (!(await allowAdmin(req, res))) return

    if (!z.string().uuid().safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid candidate id' })
      return
    }

    try {
      const events = await (await resolveService()).listEvents(req.params.id)
      res.json({ events })
    } catch (error) {
      console.error('Error reading discovery candidate events:', error)
      res.status(500).json({ error: 'Failed to read candidate events' })
    }
  })

  router.post('/candidates/:id/review', async (req, res) => {
    if (!(await allowAdmin(req, res))) return

    if (!z.string().uuid().safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid candidate id' })
      return
    }
    const parsed = reviewBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', issues: issuesOf(parsed.error) })
      return
    }

    try {
      const outcome = await (await resolveService()).review({
        id: req.params.id,
        decision: parsed.data.decision as ReviewDecision,
        reviewedBy: (await (await resolveSession())(req))?.userId ?? 'unknown',
        notes: parsed.data.notes ?? null,
        expectedRevision: parsed.data.expectedRevision,
      })
      sendOutcome(res, outcome)
    } catch (error) {
      handleServiceError(res, error, 'candidate review')
    }
  })

  router.post('/candidates/:id/promote', async (req, res) => {
    if (!(await allowAdmin(req, res))) return

    if (!z.string().uuid().safeParse(req.params.id).success) {
      res.status(400).json({ error: 'Invalid candidate id' })
      return
    }
    const parsed = promoteBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', issues: issuesOf(parsed.error) })
      return
    }

    try {
      const outcome = await (await resolveService()).promote({
        id: req.params.id,
        sourceId: parsed.data.sourceId,
        reviewedBy: (await (await resolveSession())(req))?.userId ?? 'unknown',
        expectedRevision: parsed.data.expectedRevision,
      })
      sendOutcome(res, outcome)
    } catch (error) {
      handleServiceError(res, error, 'candidate promotion')
    }
  })

  return router
}

/** Send a review/promotion outcome, mapping a refusal to its status code. */
function sendOutcome(
  res: Response,
  outcome: Awaited<ReturnType<DiscoveryServicePort['review']>>,
): void {
  if (outcome.ok) {
    res.json({ candidate: outcome.row })
    return
  }
  if (outcome.reason === 'not_found') {
    res.status(404).json({ error: 'Candidate not found' })
    return
  }
  if (outcome.reason === 'source_not_found') {
    res.status(400).json({ error: 'Source not found' })
    return
  }
  if (outcome.reason === 'stale') {
    res.status(409).json({
      error: 'Candidate changed since it was read; reload and retry',
    })
    return
  }
  res.status(409).json({ error: 'Candidate was already promoted' })
}

/** Map a service failure to a response, keeping provider faults distinct from caller faults. */
function handleServiceError(res: Response, error: unknown, context: string): void {
  if (error instanceof DiscoveryProviderError) {
    res.status(502).json({
      error: `Discovery provider "${error.provider}" failed (${error.kind})`,
    })
    return
  }
  if (isDiscoveryQueryError(error)) {
    res.status(error.status).json({ error: error.message })
    return
  }
  console.error(`Error during ${context}:`, error)
  res.status(500).json({ error: `Failed during ${context}` })
}

/** Narrow an unknown error to this codebase's discovery query error without a value import. */
function isDiscoveryQueryError(
  error: unknown,
): error is DiscoveryQueryError {
  return (
    error instanceof Error &&
    error.name === 'DiscoveryQueryError' &&
    (error as { status?: unknown }).status === 400
  )
}

/** The production router, wired to the lazily-resolved Crossref provider and Drizzle store. */
const router = createDiscoveryRouter()
export default router
