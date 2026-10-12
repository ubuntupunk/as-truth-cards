/**
 * The discovery service: one place that knows the providers and the store, and nothing
 * about HTTP or SQL.
 *
 * The service is the seam the routes depend on. It validates a discovery request, picks the
 * provider, ingests the page, and returns counts; it exposes list/review/promote for the
 * human workflow. It has no opinion about request parsing or status codes beyond the one
 * {@link DiscoveryQueryError} it raises for a bad request, which keeps that translation in
 * the route where it belongs.
 */

import type {
  CandidateListFilter,
  CandidateRow,
  DiscoveryCandidateStore,
  IngestResult,
  ReviewDecision,
  ReviewEvent,
  ReviewOutcome,
} from './store'
import type { DiscoveredRecord, DiscoveryProvider } from './types'

/** Default page size for a discovery query. */
export const DISCOVERY_LIMIT_DEFAULT = 10

/** Hard ceiling on how many provider records one discovery request may ingest. */
export const DISCOVERY_LIMIT_MAX = 100

/**
 * A caller error in a discovery request, carrying the HTTP status the route should send.
 *
 * Kept distinct from {@link DiscoveryProviderError}: a bad request is the caller's fault and
 * is a `400`, while a provider failure is an upstream fault and is a `502`.
 */
export class DiscoveryQueryError extends Error {
  constructor(
    readonly status: 400,
    message: string,
  ) {
    super(message)
    this.name = 'DiscoveryQueryError'
  }
}

/** A discovery request, before provider selection. */
export type DiscoverInput = {
  readonly provider: string
  readonly query: string
  /** Already-validated desired page size; omitted means {@link DISCOVERY_LIMIT_DEFAULT}. */
  readonly limit?: number
}

/**
 * The discovery surface the router depends on. Implementations are injected, so the route
 * can be exercised with a fake that never touches a provider or a database.
 */
export interface DiscoveryServicePort {
  /** Run one provider query and ingest the results as candidates. */
  discover(input: DiscoverInput): Promise<IngestResult>
  /** List candidates for review. */
  listCandidates(
    filter: CandidateListFilter,
  ): Promise<{ readonly items: CandidateRow[]; readonly total: number }>
  /** The append-only review/promotion history for one candidate, newest first. */
  listEvents(candidateId: string): Promise<ReviewEvent[]>
  /** Record a review decision. */
  review(input: {
    readonly id: string
    readonly decision: ReviewDecision
    readonly reviewedBy: string
    readonly notes: string | null
  }): Promise<ReviewOutcome>
  /** Explicitly promote a candidate onto a canonical source. */
  promote(input: {
    readonly id: string
    readonly sourceId: string
    readonly reviewedBy: string
  }): Promise<ReviewOutcome>
}

/** Collaborators the service needs. Both are injected; there are no hidden defaults. */
export type DiscoveryServiceDeps = {
  readonly providers: readonly DiscoveryProvider[]
  readonly store: DiscoveryCandidateStore
}

/**
 * Build the discovery service.
 *
 * @param deps The providers this deployment enables, and the store to write to.
 * @returns A {@link DiscoveryServicePort}.
 */
export function createDiscoveryService(
  deps: DiscoveryServiceDeps,
): DiscoveryServicePort {
  const providers = new Map(
    deps.providers.map((provider) => [provider.name, provider]),
  )

  return {
    async discover(input: DiscoverInput): Promise<IngestResult> {
      const query = input.query.trim()
      if (query.length === 0) {
        throw new DiscoveryQueryError(400, 'query must not be empty')
      }

      const provider = providers.get(input.provider)
      if (!provider) {
        throw new DiscoveryQueryError(
          400,
          `unknown provider "${input.provider}". Known providers: ${[
            ...providers.keys(),
          ]
            .sort()
            .join(', ')}`,
        )
      }

      const requested = input.limit ?? DISCOVERY_LIMIT_DEFAULT
      const limit = Math.max(1, Math.min(requested, DISCOVERY_LIMIT_MAX))

      const records: DiscoveredRecord[] = await provider.search({
        query,
        limit,
      })
      const { created, updated } = await deps.store.upsertMany(records)

      return {
        provider: provider.name,
        query,
        retrieved: records.length,
        created,
        updated,
      }
    },

    listCandidates: (filter) => deps.store.list(filter),

    listEvents: (candidateId) => deps.store.listEvents(candidateId),

    review: (input) => deps.store.review(input),

    promote: (input) => deps.store.promote(input),
  }
}
