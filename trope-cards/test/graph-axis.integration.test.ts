import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { sql } from 'drizzle-orm'

import { cardAxis } from '../src/db/schema/tropeGraph'
import { cardCorpus } from '../src/db/seed/corpus'

/**
 * Database-level guarantees that authored Axis classification actually reaches storage.
 *
 * Read-only, and skipped unless `TROPE_GRAPH_DATABASE_URL` is set, so the suite runs in CI
 * and locally without a database. `pnpm run trope-graph:verify` remains the authoritative
 * write-path check; it seeds twice and compares counts. These tests are the read-side
 * counterpart, and they assert per-card content rather than totals.
 *
 * The gap they fill: a row count proves `card_axes` was written, not that each card kept the
 * classification it was authored with. Losing one axis from one card leaves the total short
 * by exactly one, which is indistinguishable from an unrelated row going missing.
 */

/** True when a database is configured, so these tests have something to read. */
const hasDatabase = Boolean(process.env.TROPE_GRAPH_DATABASE_URL)

/** One persisted axis row, joined to its card, in ordinal order. */
type PersistedAxis = { slug: string; axis: string; ordinal: number }

/** Axes grouped by card slug, each list in persisted ordinal order. */
function groupByCard(rows: readonly PersistedAxis[]): Map<string, string[]> {
  const byCard = new Map<string, string[]>()
  for (const row of rows) {
    const list = byCard.get(row.slug)
    if (list) list.push(row.axis)
    else byCard.set(row.slug, [row.axis])
  }
  return byCard
}

describe(
  'persisted axis classification',
  { skip: hasDatabase ? false : 'no TROPE_GRAPH_DATABASE_URL set' },
  () => {
    let pool: { end: () => Promise<void> } | undefined
    let persisted: PersistedAxis[] = []
    let byCard = new Map<string, string[]>()

    before(async () => {
      // Imported here rather than at module scope: `client.ts` resolves a connection string
      // and constructs a pool as an import side effect, which would throw before the skip
      // above could be evaluated.
      const { db, pool: graphPool } = await import('../src/db/client')
      const { assertLocalHostFromEnv } = await import('../src/db/url')
      assertLocalHostFromEnv()
      pool = graphPool

      const { rows } = await db.execute<PersistedAxis>(sql`
        SELECT c.slug, ca.axis::text AS axis, ca.ordinal
        FROM trope_graph.card_axes ca
        JOIN trope_graph.cards c ON c.id = ca.card_id
        ORDER BY c.slug, ca.ordinal
      `)
      persisted = rows
      byCard = groupByCard(rows)
    })

    after(async () => {
      await pool?.end()
    })

    it('persists exactly the axes each card was authored with, in authored order', () => {
      const mismatches: string[] = []
      for (const card of cardCorpus) {
        const actual = byCard.get(card.slug) ?? []
        if (actual.join(',') !== card.axis.join(',')) {
          mismatches.push(
            `${card.slug}: authored [${card.axis.join(', ')}] ` +
              `persisted [${actual.join(', ') || 'none'}]`,
          )
        }
      }
      assert.deepEqual(mismatches, [])
    })

    it('carries 56 axis rows across 47 cards', () => {
      assert.equal(persisted.length, 56)
      assert.equal(byCard.size, 47)
    })

    it('leaves no card without an axis', () => {
      const axisless = cardCorpus
        .map((card) => card.slug)
        .filter((slug) => (byCard.get(slug) ?? []).length === 0)
      assert.deepEqual(axisless, [])
    })

    it('gives every card exactly one axis at ordinal 0, so the primary axis is unambiguous', () => {
      const primaries = persisted.filter((row) => row.ordinal === 0)
      assert.equal(primaries.length, 47)
      assert.equal(new Set(primaries.map((row) => row.slug)).size, 47)
    })

    it('stores contiguous ordinals from 0, with no gaps or ties', () => {
      const ordinalsByCard = new Map<string, number[]>()
      for (const row of persisted) {
        const list = ordinalsByCard.get(row.slug)
        if (list) list.push(row.ordinal)
        else ordinalsByCard.set(row.slug, [row.ordinal])
      }
      for (const [slug, ordinals] of ordinalsByCard) {
        const sorted = ordinals.slice().sort((a, b) => a - b)
        assert.deepEqual(
          sorted,
          ordinals.map((_, index) => index),
          `card "${slug}" has non-contiguous ordinals: ${sorted.join(', ')}`,
        )
      }
    })

    it('never repeats an axis on one card', () => {
      for (const [slug, axes] of byCard) {
        assert.equal(
          new Set(axes).size,
          axes.length,
          `card "${slug}" repeats an axis: ${axes.join(', ')}`,
        )
      }
    })

    it('persists only values the database enum admits', async () => {
      const { db } = await import('../src/db/client')
      const { rows } = await db.execute<{ label: string }>(sql`
        SELECT enumlabel AS label
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        WHERE pg_type.typname = 'card_axis'
        ORDER BY enumsortorder
      `)
      // The stored values are already constrained to this list, so comparing proves the
      // column resolved to the card_axis enum rather than to a bare text column that a
      // future edit could quietly widen.
      assert.deepEqual(
        rows.map((row) => row.label),
        [...cardAxis.enumValues],
      )
      for (const row of persisted) {
        assert.ok(
          cardAxis.enumValues.includes(row.axis as (typeof cardAxis.enumValues)[number]),
          `persisted axis "${row.axis}" is not in the enum`,
        )
      }
    })
  },
)
