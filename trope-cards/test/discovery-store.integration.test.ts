import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { count, eq } from 'drizzle-orm'

import { getDb } from '../src/db/client'
import { DrizzleDiscoveryStore } from '../src/discovery/store'
import type { DiscoveredRecord } from '../src/discovery/types'
import { evidenceSources } from '../src/db/schema/evidenceLayer'
import { claimSources, sources } from '../src/db/schema/tropeGraph'

/**
 * The discovery store against real Postgres and the migration-0012 tables.
 *
 * Everything runs inside one transaction that is rolled back, so the suite never leaves
 * rows behind and never depends on seed data. It proves the class of behaviour a fake
 * cannot: that the conflict update really preserves review columns, that promotion really
 * links a source and really writes nothing to the support chain, and that migration `0012`
 * really created the tables the Drizzle modules declare.
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
    rawPayload: { DOI: `10.9999/integration-${suffix}` },
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
        })
        assert.equal(reviewed.ok, true)

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

        // The audit trail of a promotion cannot be rewritten.
        const again = await store.review({
          id: candidate.id,
          decision: 'REJECTED',
          reviewedBy: 'admin-1',
          notes: null,
        })
        assert.deepEqual(again, { ok: false, reason: 'already_promoted' })
      })
    })

    it('refuses a promotion to a source that does not exist', async () => {
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
        })
        assert.deepEqual(outcome, { ok: false, reason: 'source_not_found' })
      })
    })
  },
)
