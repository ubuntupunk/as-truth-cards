import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { count, eq, sql } from 'drizzle-orm'

import { getDb } from '../src/db/client'
import { DrizzleDiscoveryStore } from '../src/discovery/store'
import type { DiscoveredRecord } from '../src/discovery/types'
import { evidenceSources } from '../src/db/schema/evidenceLayer'
import {
  discoveryCandidateEvents,
  discoveryCandidates,
} from '../src/db/schema/researchSources'
import { claimSources, sources } from '../src/db/schema/tropeGraph'

/**
 * The discovery store against real Postgres and the discovery tables (migrations 0012–0016).
 *
 * Everything runs inside one transaction that is rolled back, so the suite never leaves
 * rows behind and never depends on seed data. It proves the class of behaviour a fake
 * cannot: that the conflict update really preserves review columns, that promotion really
 * links a source and really writes nothing to the support chain, that every review decision
 * and promotion lands in the append-only event log in the same transaction, that the event
 * log is immutable under all DML (and its parents cannot be deleted as a side effect), and
 * that the migration really created the tables the Drizzle modules declare. The concurrency
 * and immutability tests against the pool are the exception: a savepoint cannot model two
 * racing connections, so they commit and clean up through the owner-only DDL path.
 *
 * Skipped unless `TROPE_GRAPH_DATABASE_URL` is set, so it runs in CI without a database.
 */

const hasDatabase = Boolean(process.env.TROPE_GRAPH_DATABASE_URL)

/** Thrown to roll the transaction back after the assertions pass. */
class Rollback extends Error {}

/** A discovered record, unique per call so a run never collides with leftover rows. */
function record(suffix: string, title = 'A Study of Things'): DiscoveredRecord {
  return {
    provider: 'crossref',
    providerRecordId: `10.9999/integration-${suffix}`,
    title,
    authors: 'Doe, Jane',
    publicationDate: '2018-05-24',
    sourceTypeHint: 'ACADEMIC',
    doi: `10.9999/integration-${suffix}`,
    url: `https://doi.org/10.9999/integration-${suffix}`,
    identifiers: [
      {
        scheme: 'DOI',
        value: `10.9999/integration-${suffix}`,
        normalizedValue: `10.9999/integration-${suffix}`,
      },
    ],
    provenance: {
      provider: 'crossref',
      endpoint: '/works',
      query: 'integration',
      mailto: null,
      requestedAt: new Date().toISOString(),
      rowsRequested: 1,
    },
    query: 'integration',
  }
}

/** Run `body` in a transaction that always rolls back, handing it the transaction handle. */
async function inRollback(
  body: (
    store: DrizzleDiscoveryStore,
    tx: ReturnType<typeof getDb>,
  ) => Promise<void>,
): Promise<void> {
  const db = getDb()
  await assert.rejects(
    db.transaction(async (tx) => {
      const store = new DrizzleDiscoveryStore(tx as unknown as ReturnType<typeof getDb>)
      await body(store, tx as unknown as ReturnType<typeof getDb>)
      throw new Rollback()
    }),
    (error: unknown) => error instanceof Rollback,
  )
}

/** Flatten an error and its `cause` chain into one searchable string. */
function messageChain(error: unknown): string {
  let text = ''
  let current: unknown = error
  while (current instanceof Error) {
    text += ` ${current.message}`
    current = (current as { cause?: unknown }).cause
  }
  return text
}

/**
 * Remove committed rows from the discovery tables.
 *
 * The pool-level concurrency tests commit, so a savepoint cannot undo them and they must clean
 * up explicitly. Migrations 0015–0017 make `discovery_candidate_events` append-only under all
 * DML and refuse to delete a candidate or source that has history, so cleanup must disable the
 * guard trigger for one transaction, delete the events, then the candidate and any sources.
 *
 * This helper also demonstrates the limit migration `0017` documents: it runs DDL through the
 * *same* connection the tests use, because the migration runner and runtime share one role. That
 * is why these tests prove the DML and FK protections but do **not** prove a runtime role cannot
 * bypass them — a table owner can always disable the trigger. Splitting out a non-owner runtime
 * role (and testing under it) is tracked as follow-up work.
 */
async function purge(
  db: ReturnType<typeof getDb>,
  candidateId: string,
  sourceIds: readonly string[] = [],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`alter table trope_graph.discovery_candidate_events disable trigger user`,
    )
    await tx
      .delete(discoveryCandidateEvents)
      .where(eq(discoveryCandidateEvents.candidateId, candidateId))
    await tx.execute(
      sql`alter table trope_graph.discovery_candidate_events enable trigger user`,
    )
    await tx
      .delete(discoveryCandidates)
      .where(eq(discoveryCandidates.id, candidateId))
    for (const id of sourceIds) {
      await tx.delete(sources).where(eq(sources.id, id))
    }
  })
}

describe(
  'DrizzleDiscoveryStore (integration)',
  { skip: hasDatabase ? false : 'no TROPE_GRAPH_DATABASE_URL set' },
  () => {
    it('creates a candidate, then refreshes it without duplicating or re-reviewing', async () => {
      await inRollback(async (store) => {
        const suffix = `${process.pid}-${Date.now()}`

        const first = await store.upsertMany([record(suffix)])
        assert.deepEqual(first, { created: 1, updated: 0 })

        // Re-ingest with a corrected title: still one row, provider fields refreshed.
        const second = await store.upsertMany([record(suffix, 'Corrected Title')])
        assert.deepEqual(second, { created: 0, updated: 1 })

        const listed = await store.list({ provider: 'crossref', limit: 100, offset: 0 })
        const row = listed.items.find(
          (candidate) => candidate.providerRecordId === `10.9999/integration-${suffix}`,
        )
        assert.ok(row, 'candidate should exist exactly once')
        assert.equal(row.title, 'Corrected Title')

        // A review decision survives a later re-ingest.
        const reviewed = await store.review({
          id: row.id,
          decision: 'DEFERRED',
          reviewedBy: 'admin-1',
          notes: 'second look',
          expectedRevision: row.revision,
        })
        assert.equal(reviewed.ok, true)
        if (reviewed.ok) assert.equal(reviewed.row.revision, row.revision + 1)

        const events = await store.listEvents(row.id)
        assert.equal(events.length, 1)
        assert.equal(events[0]?.action, 'REVIEWED')
        assert.equal(events[0]?.decision, 'DEFERRED')
        assert.equal(events[0]?.actorId, 'admin-1')
        assert.equal(events[0]?.notes, 'second look')

        await store.upsertMany([record(suffix, 'Title Changed Again')])
        const after = await store.getById(row.id)
        assert.equal(after?.reviewStatus, 'DEFERRED')
        assert.equal(after?.reviewedBy, 'admin-1')
        assert.equal(after?.reviewNotes, 'second look')
        assert.equal(after?.title, 'Title Changed Again')
      })
    })

    it('promotes explicitly, writes no support-chain rows, and refuses re-review', async () => {
      await inRollback(async (store, tx) => {
        const suffix = `${process.pid}-${Date.now()}-promote`

        await store.upsertMany([record(suffix)])
        const listed = await store.list({ provider: 'crossref', limit: 100, offset: 0 })
        const candidate = listed.items.find(
          (c) => c.providerRecordId === `10.9999/integration-${suffix}`,
        )
        assert.ok(candidate)

        const [source] = await tx
          .insert(sources)
          .values({ title: 'Canonical source for integration', sourceType: 'OTHER' })
          .returning({ id: sources.id })
        assert.ok(source)

        const promoted = await store.promote({
          id: candidate.id,
          sourceId: source.id,
          reviewedBy: 'admin-1',
          expectedRevision: candidate.revision,
        })
        assert.equal(promoted.ok, true)
        if (promoted.ok) {
          assert.equal(promoted.row.promotedSourceId, source.id)
          assert.equal(promoted.row.reviewStatus, 'APPROVED')
        }

        // Promotion is a curation link only: no attribution, no evidence edge.
        const attributions = await tx
          .select({ value: count() })
          .from(claimSources)
          .where(eq(claimSources.sourceId, source.id))
        assert.equal(Number(attributions[0]?.value ?? 0), 0)

        const evidence = await tx
          .select({ value: count() })
          .from(evidenceSources)
          .where(eq(evidenceSources.sourceId, source.id))
        assert.equal(Number(evidence[0]?.value ?? 0), 0)

        // The promotion is recorded as an append-only event, alongside its source link.
        const events = await store.listEvents(candidate.id)
        assert.equal(events.length, 1)
        assert.equal(events[0]?.action, 'PROMOTED')
        assert.equal(events[0]?.actorId, 'admin-1')
        assert.equal(events[0]?.sourceId, source.id)
        assert.equal(events[0]?.decision, null)

        // A promoted candidate is terminal: a later review is refused and writes no event.
        const again = await store.review({
          id: candidate.id,
          decision: 'REJECTED',
          reviewedBy: 'admin-1',
          notes: null,
          expectedRevision: candidate.revision,
        })
        assert.deepEqual(again, { ok: false, reason: 'already_promoted' })
        assert.equal((await store.listEvents(candidate.id)).length, 1)
      })
    })

    it('refuses a promotion to a source that does not exist, writing no event', async () => {
      await inRollback(async (store) => {
        const suffix = `${process.pid}-${Date.now()}-missing-source`
        await store.upsertMany([record(suffix)])
        const listed = await store.list({ provider: 'crossref', limit: 100, offset: 0 })
        const candidate = listed.items.find(
          (c) => c.providerRecordId === `10.9999/integration-${suffix}`,
        )
        assert.ok(candidate)

        const outcome = await store.promote({
          id: candidate.id,
          sourceId: '00000000-0000-0000-0000-000000000000',
          reviewedBy: 'admin-1',
          expectedRevision: candidate.revision,
        })
        assert.deepEqual(outcome, { ok: false, reason: 'source_not_found' })
        assert.equal((await store.listEvents(candidate.id)).length, 0)
      })
    })

    it('promotes a candidate exactly once under concurrent attempts', async () => {
      const db = getDb()
      const suffix = `${process.pid}-${Date.now()}-race`
      const [source] = await db
        .insert(sources)
        .values({ title: 'Race source for integration', sourceType: 'OTHER' })
        .returning({ id: sources.id })
      assert.ok(source)

      const store = new DrizzleDiscoveryStore(db)
      let candidateId: string | undefined
      try {
        await store.upsertMany([record(suffix)])
        const listed = await store.list({ provider: 'crossref', limit: 100, offset: 0 })
        const candidate = listed.items.find(
          (c) => c.providerRecordId === `10.9999/integration-${suffix}`,
        )
        assert.ok(candidate)
        candidateId = candidate.id

        // Two independent pool connections attempt the same promotion at once. The
        // conditional UPDATE makes the winner exclusive; the loser must see already_promoted.
        const outcomes = await Promise.all([
          store.promote({
            id: candidate.id,
            sourceId: source.id,
            reviewedBy: 'admin-1',
            expectedRevision: candidate.revision,
          }),
          store.promote({
            id: candidate.id,
            sourceId: source.id,
            reviewedBy: 'admin-2',
            expectedRevision: candidate.revision,
          }),
        ])
        const wins = outcomes.filter((outcome) => outcome.ok)
        const losses = outcomes.filter((outcome) => !outcome.ok)
        assert.equal(wins.length, 1)
        assert.deepEqual(losses, [{ ok: false, reason: 'already_promoted' }])

        const events = await store.listEvents(candidate.id)
        assert.equal(events.filter((event) => event.action === 'PROMOTED').length, 1)
      } finally {
        if (candidateId !== undefined) {
          await purge(db, candidateId, [source.id])
        } else {
          await db.delete(sources).where(eq(sources.id, source.id))
        }
      }
    })

    it('applies exactly one of two reviews racing on the same read revision', async () => {
      const db = getDb()
      const store = new DrizzleDiscoveryStore(db)
      const suffix = `${process.pid}-${Date.now()}-review-race`
      await store.upsertMany([record(suffix)])
      const listed = await store.list({ provider: 'crossref', limit: 100, offset: 0 })
      const candidate = listed.items.find(
        (c) => c.providerRecordId === `10.9999/integration-${suffix}`,
      )
      assert.ok(candidate)

      try {
        // Both reviewers read revision R concurrently; whichever commits first advances to
        // R + 1, so the other's conditional UPDATE misses and must be refused as stale.
        const outcomes = await Promise.all([
          store.review({
            id: candidate.id,
            decision: 'APPROVED',
            reviewedBy: 'admin-1',
            notes: null,
            expectedRevision: candidate.revision,
          }),
          store.review({
            id: candidate.id,
            decision: 'REJECTED',
            reviewedBy: 'admin-2',
            notes: null,
            expectedRevision: candidate.revision,
          }),
        ])
        assert.equal(outcomes.filter((outcome) => outcome.ok).length, 1)
        assert.deepEqual(outcomes.filter((outcome) => !outcome.ok), [
          { ok: false, reason: 'stale' },
        ])

        // One event, and the stored candidate agrees with it — no half-applied decision.
        const events = await store.listEvents(candidate.id)
        assert.equal(events.length, 1)
        assert.equal(events[0]?.action, 'REVIEWED')
        const current = await store.getById(candidate.id)
        assert.equal(events[0]?.decision, current?.reviewStatus)
        assert.equal(current?.revision, candidate.revision + 1)
      } finally {
        await purge(db, candidate.id)
      }
    })

    it('decides exactly once when a promotion races a review', async () => {
      const db = getDb()
      const store = new DrizzleDiscoveryStore(db)
      const suffix = `${process.pid}-${Date.now()}-review-promote-race`
      const [source] = await db
        .insert(sources)
        .values({ title: 'Race source for integration', sourceType: 'OTHER' })
        .returning({ id: sources.id })
      assert.ok(source)

      await store.upsertMany([record(suffix)])
      const listed = await store.list({ provider: 'crossref', limit: 100, offset: 0 })
      const candidate = listed.items.find(
        (c) => c.providerRecordId === `10.9999/integration-${suffix}`,
      )
      assert.ok(candidate)

      try {
        // Both operations target the same read revision. If the review wins it advances the
        // revision, so the promotion is stale; if the promotion wins, the review then sees a
        // promoted candidate and is refused as already_promoted. Either way exactly one event.
        const [review, promote] = await Promise.all([
          store.review({
            id: candidate.id,
            decision: 'APPROVED',
            reviewedBy: 'admin-1',
            notes: null,
            expectedRevision: candidate.revision,
          }),
          store.promote({
            id: candidate.id,
            sourceId: source.id,
            reviewedBy: 'admin-2',
            expectedRevision: candidate.revision,
          }),
        ])
        assert.equal([review, promote].filter((outcome) => outcome.ok).length, 1)

        const events = await store.listEvents(candidate.id)
        assert.equal(events.length, 1)
        if (promote.ok) {
          assert.equal(events[0]?.action, 'PROMOTED')
          assert.deepEqual(review, { ok: false, reason: 'already_promoted' })
        } else {
          assert.equal(events[0]?.action, 'REVIEWED')
          assert.deepEqual(promote, { ok: false, reason: 'stale' })
        }
      } finally {
        await purge(db, candidate.id, [source.id])
      }
    })

    it('rejects every direct mutation of the review-event audit trail', async () => {
      const db = getDb()
      const store = new DrizzleDiscoveryStore(db)
      const suffix = `${process.pid}-${Date.now()}-append-only`
      const [source] = await db
        .insert(sources)
        .values({ title: 'Guard source for integration', sourceType: 'OTHER' })
        .returning({ id: sources.id })
      assert.ok(source)

      await store.upsertMany([record(suffix)])
      const listed = await store.list({ provider: 'crossref', limit: 100, offset: 0 })
      const candidate = listed.items.find(
        (c) => c.providerRecordId === `10.9999/integration-${suffix}`,
      )
      assert.ok(candidate)

      try {
        const reviewed = await store.review({
          id: candidate.id,
          decision: 'DEFERRED',
          reviewedBy: 'admin-1',
          notes: null,
          expectedRevision: candidate.revision,
        })
        assert.equal(reviewed.ok, true)
        const promoted = await store.promote({
          id: candidate.id,
          sourceId: source.id,
          reviewedBy: 'admin-1',
          expectedRevision: candidate.revision + 1,
        })
        assert.equal(promoted.ok, true)

        const [event] = await db
          .select({ id: discoveryCandidateEvents.id })
          .from(discoveryCandidateEvents)
          .where(eq(discoveryCandidateEvents.candidateId, candidate.id))
        assert.ok(event)

        // There is no settable bypass, so a stray UPDATE or DELETE is refused by the trigger.
        await assert.rejects(
          db
            .update(discoveryCandidateEvents)
            .set({ actorId: 'admin-2' })
            .where(eq(discoveryCandidateEvents.id, event.id)),
          (error) => /append-only/.test(messageChain(error)),
        )
        await assert.rejects(
          db
            .delete(discoveryCandidateEvents)
            .where(eq(discoveryCandidateEvents.id, event.id)),
          (error) => /append-only/.test(messageChain(error)),
        )

        // History cannot be removed as a side effect of deleting its parents either: the FKs
        // are RESTRICT, so a candidate or source with history is refused, not cascaded.
        await assert.rejects(
          db
            .delete(discoveryCandidates)
            .where(eq(discoveryCandidates.id, candidate.id)),
          (error) => /foreign key/i.test(messageChain(error)),
        )
        await assert.rejects(
          db.delete(sources).where(eq(sources.id, source.id)),
          (error) => /foreign key/i.test(messageChain(error)),
        )

        // The event survived every attempt intact.
        const [survivor] = await db
          .select({ actorId: discoveryCandidateEvents.actorId })
          .from(discoveryCandidateEvents)
          .where(eq(discoveryCandidateEvents.id, event.id))
        assert.equal(survivor?.actorId, 'admin-1')
      } finally {
        await purge(db, candidate.id, [source.id])
      }
    })
  },
)
