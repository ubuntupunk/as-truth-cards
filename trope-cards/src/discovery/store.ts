/**
 * The write side of research-source discovery: candidate ingest and human review.
 *
 * This is the only module in the discovery subsystem that writes, and it writes to exactly
 * one table, `discovery_candidates`. It never inserts a `sources` row, never touches
 * `claim_sources` or the evidence layer, and never derives support from a candidate. Those
 * guarantees are the point of the layer, so they live in the store rather than in a
 * convention a future caller could forget.
 *
 * Ingest is idempotent on `(provider, provider_record_id)`, and the conflict update
 * deliberately omits every review column. Re-running a discovery query refreshes the
 * provider-owned fields and leaves `review_status`, `reviewed_by`, `reviewed_at`,
 * `review_notes`, and `promoted_source_id` untouched — so re-discovery can never silently
 * approve a candidate or overwrite a reviewer's decision.
 *
 * The module imports `getDb` lazily through its default constructor argument, so importing
 * it never requires a configured connection string; the router resolves the store on the
 * first request that needs it, and tests inject an in-memory fake.
 */

import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { getDb } from '../db/client'
import {
  discoveryCandidateEvents,
  discoveryCandidates,
  type discoveryReviewStatus,
} from '../db/schema/researchSources'
import type { DiscoveredRecord, SourceTypeValue } from './types'

/** The review decisions a human can record. `CANDIDATE` is ingest-only. */
export const REVIEW_DECISIONS = ['APPROVED', 'REJECTED', 'DEFERRED'] as const

/** A human review decision. */
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

/** Any value `discovery_candidates.review_status` can hold. */
export type ReviewStatus = 'CANDIDATE' | ReviewDecision

/** The `discovery_review_status` enum values, as the Drizzle column requires them. */
type ReviewStatusValue = (typeof discoveryReviewStatus)['enumValues'][number]

/**
 * One candidate as the review surface reads it.
 *
 * `identifiers` and `provenance` stay `unknown` here: the store transports the JSON the
 * provider supplied and does not re-interpret it, so a reviewer sees exactly what was
 * recorded.
 */
export type CandidateRow = {
  readonly id: string
  readonly provider: string
  readonly providerRecordId: string
  readonly title: string
  readonly authors: string | null
  readonly publicationDate: string | null
  readonly sourceTypeHint: SourceTypeValue | null
  readonly doi: string | null
  readonly url: string | null
  readonly identifiers: unknown
  readonly provenance: unknown
  readonly query: string | null
  readonly retrievedAt: Date
  readonly reviewStatus: ReviewStatusValue
  readonly reviewedBy: string | null
  readonly reviewedAt: Date | null
  readonly reviewNotes: string | null
  readonly promotedSourceId: string | null
  /** Optimistic-concurrency token; present the value you read to review or promote. */
  readonly revision: number
  readonly createdAt: Date
}

/** The result of ingesting one provider page. */
export type IngestResult = {
  readonly provider: string
  readonly query: string
  readonly retrieved: number
  readonly created: number
  readonly updated: number
}

/** A review-queue listing request. `limit`/`offset` are already validated. */
export type CandidateListFilter = {
  readonly status?: ReviewStatus
  readonly provider?: string
  readonly limit: number
  readonly offset: number
}

/**
 * Why a review or promotion could not be recorded.
 *
 * `already_promoted` is terminal — a promoted candidate cannot be re-reviewed.
 * `stale` means the caller's `expectedRevision` predates a decision made in between; the
 * caller should re-read the candidate and retry against the current revision.
 */
export type ReviewRefusal =
  | 'not_found'
  | 'already_promoted'
  | 'source_not_found'
  | 'stale'

/** The outcome of a review or promotion: the updated row, or a reason it was refused. */
export type ReviewOutcome =
  | { readonly ok: true; readonly row: CandidateRow }
  | { readonly ok: false; readonly reason: ReviewRefusal }

/**
 * One append-only review/promotion event. The candidate row carries current state; a
 * sequence of these is the history of how it got there.
 */
export type ReviewEvent = {
  readonly id: string
  readonly candidateId: string
  readonly action: string
  readonly decision: string | null
  readonly actorId: string
  readonly notes: string | null
  readonly sourceId: string | null
  readonly createdAt: Date
}

/**
 * The discovery store port.
 *
 * Every method is explicit about what it can and cannot do. `upsertMany` accepts only
 * {@link DiscoveredRecord}s and returns counts — it has no way to express "and also approve
 * this". `review` and `promote` are separate, human-driven operations, and `promote` is the
 * only thing that sets `promoted_source_id`.
 */
export interface DiscoveryCandidateStore {
  /**
   * Insert new candidates and refresh existing ones, keyed by `(provider, providerRecordId)`.
   *
   * Never changes a review column. Duplicate records within one batch collapse to the last
   * occurrence.
   *
   * @param records Provider-normalized records from one or more providers.
   * @returns How many rows were created and how many existing rows were refreshed.
   */
  upsertMany(
    records: readonly DiscoveredRecord[],
  ): Promise<Omit<IngestResult, 'provider' | 'query' | 'retrieved'>>

  /**
   * List candidates, newest retrieval first.
   *
   * @param filter Optional status/provider filter plus bounds.
   * @returns The page and the total matching count.
   */
  list(
    filter: CandidateListFilter,
  ): Promise<{ readonly items: CandidateRow[]; readonly total: number }>

  /** Read one candidate, or `null`. */
  getById(id: string): Promise<CandidateRow | null>

  /**
   * Read a candidate's review/promotion history, newest first.
   *
   * The candidate row is current state; these events are the append-only audit trail. A
   * candidate that was reviewed and then promoted has at least two events.
   */
  listEvents(candidateId: string): Promise<ReviewEvent[]>

  /**
   * Record a review decision. Reviewing a promoted candidate is refused, so the audit trail
   * of a promotion cannot be rewritten after the fact.
   *
   * `expectedRevision` is the revision the caller read. If the candidate has changed since,
   * the review is refused as `stale` rather than overwriting the intervening decision.
   */
  review(input: {
    readonly id: string
    readonly decision: ReviewDecision
    readonly reviewedBy: string
    readonly notes: string | null
    readonly expectedRevision: number
  }): Promise<ReviewOutcome>

  /**
   * Point a candidate at the canonical source a human created or matched. This is the only
   * operation that sets `promoted_source_id`; it does not create a source and does not
   * create any attribution or evidence row.
   *
   * `expectedRevision` guards against promoting a candidate whose review changed since the
   * caller read it; a mismatch is refused as `stale`.
   */
  promote(input: {
    readonly id: string
    readonly sourceId: string
    readonly reviewedBy: string
    readonly expectedRevision: number
  }): Promise<ReviewOutcome>
}

/** Columns the review surface reads, named once so select and row stay in step. */
const candidateColumns = {
  id: discoveryCandidates.id,
  provider: discoveryCandidates.provider,
  providerRecordId: discoveryCandidates.providerRecordId,
  title: discoveryCandidates.title,
  authors: discoveryCandidates.authors,
  publicationDate: discoveryCandidates.publicationDate,
  sourceTypeHint: discoveryCandidates.sourceTypeHint,
  doi: discoveryCandidates.doi,
  url: discoveryCandidates.url,
  identifiers: discoveryCandidates.identifiers,
  provenance: discoveryCandidates.provenance,
  query: discoveryCandidates.query,
  retrievedAt: discoveryCandidates.retrievedAt,
  reviewStatus: discoveryCandidates.reviewStatus,
  reviewedBy: discoveryCandidates.reviewedBy,
  reviewedAt: discoveryCandidates.reviewedAt,
  reviewNotes: discoveryCandidates.reviewNotes,
  promotedSourceId: discoveryCandidates.promotedSourceId,
  revision: discoveryCandidates.revision,
  createdAt: discoveryCandidates.createdAt,
}

/** `excluded.<column>` references for the conflict update, built from fixed names. */
const excluded = (column: string) => sql.raw(`excluded."${column}"`)

/** Columns the audit surface reads from the event log, named once. */
const eventColumns = {
  id: discoveryCandidateEvents.id,
  candidateId: discoveryCandidateEvents.candidateId,
  action: discoveryCandidateEvents.action,
  decision: discoveryCandidateEvents.decision,
  actorId: discoveryCandidateEvents.actorId,
  notes: discoveryCandidateEvents.notes,
  sourceId: discoveryCandidateEvents.sourceId,
  createdAt: discoveryCandidateEvents.createdAt,
}

/**
 * Postgres foreign-key violation, raised when a promotion names a nonexistent source.
 *
 * Drizzle wraps driver errors (in this version the `pg` error is on `cause`), so the code is
 * looked for down the cause chain rather than only on the thrown value.
 */
function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error
  for (
    let depth = 0;
    depth < 5 && current !== null && current !== undefined;
    depth++
  ) {
    if (
      typeof current === 'object' &&
      (current as { code?: unknown }).code === '23503'
    ) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}

/** The transaction handle a store write runs on. */
type Transaction = Parameters<
  Parameters<ReturnType<typeof getDb>['transaction']>[0]
>[0]

/**
 * Explain why a conditional review/promotion update matched no row.
 *
 * Runs only after a zero-row update, so it cannot itself race a decision: it reads the row
 * that the failed `WHERE` was compared against and classifies the mismatch. A promoted
 * candidate is terminal (`already_promoted`); otherwise the revision moved, so the caller's
 * read is `stale`.
 */
async function classifyRefusal(
  tx: Transaction,
  id: string,
): Promise<ReviewOutcome> {
  const rows = await tx
    .select({ promotedSourceId: discoveryCandidates.promotedSourceId })
    .from(discoveryCandidates)
    .where(eq(discoveryCandidates.id, id))
    .limit(1)
  const existing = rows[0]
  if (existing === undefined) return { ok: false, reason: 'not_found' }
  if (existing.promotedSourceId !== null) {
    return { ok: false, reason: 'already_promoted' }
  }
  return { ok: false, reason: 'stale' }
}

/**
 * The Drizzle-backed discovery store.
 *
 * @param client Drizzle client, resolved from `db/client.ts` on first use so importing this
 * module never needs a connection string.
 */
export class DrizzleDiscoveryStore implements DiscoveryCandidateStore {
  constructor(private readonly client: ReturnType<typeof getDb> = getDb()) {}

  async upsertMany(
    records: readonly DiscoveredRecord[],
  ): Promise<{ created: number; updated: number }> {
    if (records.length === 0) return { created: 0, updated: 0 }

    // Collapse intra-batch duplicates on the uniqueness key; the last record wins.
    const byKey = new Map<string, DiscoveredRecord>()
    for (const record of records) {
      byKey.set(`${record.provider}\u0000${record.providerRecordId}`, record)
    }
    const unique = [...byKey.values()]

    const existingKeys = new Set<string>()
    const providers = new Set(unique.map((record) => record.provider))
    for (const provider of providers) {
      const ids = unique
        .filter((record) => record.provider === provider)
        .map((record) => record.providerRecordId)
      const rows = await this.client
        .select({
          provider: discoveryCandidates.provider,
          providerRecordId: discoveryCandidates.providerRecordId,
        })
        .from(discoveryCandidates)
        .where(
          and(
            eq(discoveryCandidates.provider, provider),
            inArray(discoveryCandidates.providerRecordId, ids),
          ),
        )
      for (const row of rows) {
        existingKeys.add(`${row.provider}\u0000${row.providerRecordId}`)
      }
    }

    const created = unique.filter(
      (record) =>
        !existingKeys.has(`${record.provider}\u0000${record.providerRecordId}`),
    ).length

    await this.client
      .insert(discoveryCandidates)
      .values(
        unique.map((record) => ({
          provider: record.provider,
          providerRecordId: record.providerRecordId,
          title: record.title,
          authors: record.authors,
          publicationDate: record.publicationDate,
          sourceTypeHint: record.sourceTypeHint,
          doi: record.doi,
          url: record.url,
          identifiers: record.identifiers,
          provenance: record.provenance,
          query: record.query,
        })),
      )
      .onConflictDoUpdate({
        target: [
          discoveryCandidates.provider,
          discoveryCandidates.providerRecordId,
        ],
        // Provider-owned fields only. Review columns are intentionally absent so
        // re-discovery never approves or un-reviews a candidate, and `revision` is absent so
        // a refresh cannot invalidate a reviewer's optimistic-concurrency token. `raw_payload`
        // is not written or refreshed: retention is unavailable until the §5 review resolves,
        // so the column stays reserved and unpopulated.
        set: {
          title: excluded('title'),
          authors: excluded('authors'),
          publicationDate: excluded('publication_date'),
          sourceTypeHint: excluded('source_type_hint'),
          doi: excluded('doi'),
          url: excluded('url'),
          identifiers: excluded('identifiers'),
          provenance: excluded('provenance'),
          query: excluded('query'),
          retrievedAt: excluded('retrieved_at'),
        },
      })

    return { created, updated: unique.length - created }
  }

  async list(
    filter: CandidateListFilter,
  ): Promise<{ items: CandidateRow[]; total: number }> {
    const conditions = []
    if (filter.status !== undefined) {
      conditions.push(eq(discoveryCandidates.reviewStatus, filter.status))
    }
    if (filter.provider !== undefined) {
      conditions.push(eq(discoveryCandidates.provider, filter.provider))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const items = await this.client
      .select(candidateColumns)
      .from(discoveryCandidates)
      .where(where)
      .orderBy(
        desc(discoveryCandidates.retrievedAt),
        desc(discoveryCandidates.createdAt),
      )
      .limit(filter.limit)
      .offset(filter.offset)

    const totals = await this.client
      .select({ value: count() })
      .from(discoveryCandidates)
      .where(where)

    return { items, total: Number(totals[0]?.value ?? 0) }
  }

  async getById(id: string): Promise<CandidateRow | null> {
    const rows = await this.client
      .select(candidateColumns)
      .from(discoveryCandidates)
      .where(eq(discoveryCandidates.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async listEvents(candidateId: string): Promise<ReviewEvent[]> {
    return this.client
      .select(eventColumns)
      .from(discoveryCandidateEvents)
      .where(eq(discoveryCandidateEvents.candidateId, candidateId))
      .orderBy(
        desc(discoveryCandidateEvents.createdAt),
        desc(discoveryCandidateEvents.id),
      )
  }

  /**
   * Record a review decision atomically and optimistically.
   *
   * The precondition — "exists, is not already promoted, and is still at the revision the
   * caller read" — is enforced by the `WHERE` on the update itself, not by a preceding read.
   * The revision check is what makes two concurrent reviews mutually exclusive: both read
   * revision N, only one `WHERE revision = N` can match, the winner advances the row to N+1,
   * and the loser matches nothing and is refused as `stale`. Checking only "not promoted"
   * would let both succeed and have the later one silently replace the earlier.
   *
   * The update and its audit event share one transaction: either both happen or neither does.
   * A refused review writes nothing.
   */
  async review(input: {
    id: string
    decision: ReviewDecision
    reviewedBy: string
    notes: string | null
    expectedRevision: number
  }): Promise<ReviewOutcome> {
    return this.client.transaction(async (tx): Promise<ReviewOutcome> => {
      const rows = await tx
        .update(discoveryCandidates)
        .set({
          reviewStatus: input.decision,
          reviewedBy: input.reviewedBy,
          reviewedAt: new Date(),
          reviewNotes: input.notes,
          revision: sql`${discoveryCandidates.revision} + 1`,
        })
        .where(
          and(
            eq(discoveryCandidates.id, input.id),
            eq(discoveryCandidates.revision, input.expectedRevision),
            isNull(discoveryCandidates.promotedSourceId),
          ),
        )
        .returning(candidateColumns)

      const row = rows[0]
      if (row === undefined) {
        return classifyRefusal(tx, input.id)
      }

      await tx.insert(discoveryCandidateEvents).values({
        candidateId: input.id,
        action: 'REVIEWED',
        decision: input.decision,
        actorId: input.reviewedBy,
        notes: input.notes,
      })
      return { ok: true, row }
    })
  }

  /**
   * Promote a candidate to a canonical source atomically and optimistically.
   *
   * Like {@link review}, the guard is part of the update's `WHERE`: the candidate must exist,
   * still be at the caller's revision, and not already be promoted. Competing promotions and a
   * review racing a promotion cannot both succeed; the loser is refused as `stale` (a
   * concurrent decision moved the revision) or `already_promoted`. The promotion and its audit
   * event are one transaction. A nonexistent `sourceId` aborts the transaction (the foreign
   * key fires); that rollback is translated to `source_not_found` and no event is written.
   */
  async promote(input: {
    id: string
    sourceId: string
    reviewedBy: string
    expectedRevision: number
  }): Promise<ReviewOutcome> {
    try {
      return await this.client.transaction(
        async (tx): Promise<ReviewOutcome> => {
          const rows = await tx
            .update(discoveryCandidates)
            .set({
              promotedSourceId: input.sourceId,
              reviewStatus: 'APPROVED',
              reviewedBy: input.reviewedBy,
              reviewedAt: new Date(),
              revision: sql`${discoveryCandidates.revision} + 1`,
            })
            .where(
              and(
                eq(discoveryCandidates.id, input.id),
                eq(discoveryCandidates.revision, input.expectedRevision),
                isNull(discoveryCandidates.promotedSourceId),
              ),
            )
            .returning(candidateColumns)

          const row = rows[0]
          if (row === undefined) {
            return classifyRefusal(tx, input.id)
          }

          await tx.insert(discoveryCandidateEvents).values({
            candidateId: input.id,
            action: 'PROMOTED',
            decision: null,
            actorId: input.reviewedBy,
            sourceId: input.sourceId,
            notes: null,
          })
          return { ok: true, row }
        },
      )
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return { ok: false, reason: 'source_not_found' }
      }
      throw error
    }
  }
}
