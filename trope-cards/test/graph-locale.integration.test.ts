import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { sql } from 'drizzle-orm'

import { cardCorpus } from '../src/db/seed/corpus'
import { localesSeed } from '../src/db/seed/taxonomy'

/**
 * Database-level guarantees that authored Locale classification actually reaches storage.
 *
 * Read-only, and skipped unless `TROPE_GRAPH_DATABASE_URL` is set, so the suite runs in CI
 * and locally without a database. `pnpm run trope-graph:verify` remains the authoritative
 * write-path check. These are the read-side counterpart, and they assert per-card content
 * rather than totals.
 *
 * The gap they fill, the same one `graph-axis.integration.test.ts` exists for: a row count
 * proves `card_locales` was written, not that each card kept the locale it was authored with.
 * Losing one link leaves the total short by one, which is indistinguishable from an
 * unrelated row going missing. The last suite additionally projects a card through the real
 * Drizzle reader, because the reader's locale query is where a wrong column list or a missed
 * join would hide — the fake reader hands back exactly the shape the port declares.
 */

/** True when a database is configured, so these tests have something to read. */
const hasDatabase = Boolean(process.env.TROPE_GRAPH_DATABASE_URL)

/** One persisted locale link, joined to its card and its locale. */
type PersistedLocale = {
  slug: string
  locale_slug: string
  locale_id: string
  locale_name: string
}

/** One persisted suite membership, joined to its card. */
type PersistedSuit = { slug: string; collection_slug: string; collection_id: string }

/** Locales grouped by card slug. */
function groupByCard(rows: readonly PersistedLocale[]): Map<string, string[]> {
  const byCard = new Map<string, string[]>()
  for (const row of rows) {
    const list = byCard.get(row.slug)
    if (list) list.push(row.locale_slug)
    else byCard.set(row.slug, [row.locale_slug])
  }
  return byCard
}

describe(
  'persisted locale classification',
  { skip: hasDatabase ? false : 'no TROPE_GRAPH_DATABASE_URL set' },
  () => {
    let pool: { end: () => Promise<void> } | undefined
    let persisted: PersistedLocale[] = []
    let suits: PersistedSuit[] = []
    let byCard = new Map<string, string[]>()

    before(async () => {
      // Imported here rather than at module scope: `client.ts` resolves a connection string
      // and constructs a pool as an import side effect, which would throw before the skip
      // above could be evaluated.
      const { getDb, getPool } = await import('../src/db/client')
      const db = getDb()
      const { assertLocalHostFromEnv } = await import('../src/db/url')
      assertLocalHostFromEnv()
      pool = getPool()

      const localeRows = await db.execute<PersistedLocale>(sql`
        SELECT c.slug, l.slug AS locale_slug, l.id AS locale_id, l.name AS locale_name
        FROM trope_graph.card_locales cl
        JOIN trope_graph.cards c ON c.id = cl.card_id
        JOIN trope_graph.locales l ON l.id = cl.locale_id
        ORDER BY c.slug, l.slug
      `)
      persisted = localeRows.rows
      byCard = groupByCard(persisted)

      const suitRows = await db.execute<PersistedSuit>(sql`
        SELECT c.slug, col.slug AS collection_slug, col.id AS collection_id
        FROM trope_graph.card_collections cc
        JOIN trope_graph.cards c ON c.id = cc.card_id
        JOIN trope_graph.collections col ON col.id = cc.collection_id
        ORDER BY c.slug, col.slug
      `)
      suits = suitRows.rows
    })

    after(async () => {
      await pool?.end()
    })

    it('persists exactly the locales each card was authored with', () => {
      const mismatches: string[] = []
      for (const card of cardCorpus) {
        const authored = [...(card.locales ?? [])].sort()
        const actual = (byCard.get(card.slug) ?? []).slice().sort()
        if (authored.join(',') !== actual.join(',')) {
          mismatches.push(
            `${card.slug}: authored [${authored.join(', ') || 'none'}] ` +
              `persisted [${actual.join(', ') || 'none'}]`,
          )
        }
      }
      assert.deepEqual(mismatches, [])
    })

    it('leaves every card without an authored locale unlinked', () => {
      // The converse of the test above, and the one that catches a seeder that defaults an
      // untagged card to a locale. Locale is authored, so an absent list must stay absent.
      const untagged = cardCorpus.filter((card) => (card.locales ?? []).length === 0)
      assert.ok(untagged.length > 0, 'the corpus has untagged cards to check')
      const wronglyTagged = untagged
        .map((card) => card.slug)
        .filter((slug) => (byCard.get(slug) ?? []).length > 0)
      assert.deepEqual(wronglyTagged, [])
    })

    it('persists the locale taxonomy with no dead slugs', () => {
      const used = new Set(persisted.map((row) => row.locale_slug))
      for (const locale of localesSeed) {
        assert.ok(used.has(locale.slug), `locale "${locale.slug}" has no cards`)
      }
      assert.equal(used.size, localesSeed.length)
    })

    it('stores a display name for every locale, so a regional deck can be labelled', () => {
      for (const row of persisted) {
        assert.ok(
          row.locale_name.trim().length > 0,
          `locale "${row.locale_slug}" has a blank name`,
        )
      }
    })

    it('resolves every locale link to a real card and a real locale', () => {
      // Inner joins already dropped orphans, so a non-empty result with no dangling ids is
      // the assertion. This would catch a link written against the wrong parent table.
      assert.equal(persisted.length, 7)
      assert.equal(new Set(persisted.map((r) => r.locale_id)).size, 1)
    })

    it('keeps the shared south-africa slug resolving to two different rows', async () => {
      const { getDb } = await import('../src/db/client')
      const db = getDb()
      const { rows } = await db.execute<{
        collection_id: string
        locale_id: string
      }>(sql`
        SELECT
          (SELECT id FROM trope_graph.collections WHERE slug = 'south-africa')
            AS collection_id,
          (SELECT id FROM trope_graph.locales WHERE slug = 'south-africa')
            AS locale_id
      `)
      const row = rows[0]
      assert.ok(row, 'the south-africa collection and locale both exist')
      assert.notEqual(
        row.collection_id,
        row.locale_id,
        'the shared slug must resolve to two distinct rows; if these were equal, a Suit and ' +
          'a Locale would be the same record',
      )
    })

    it('does not lose the four cards that are in both taxonomies', () => {
      const suitByCard = new Map<string, string[]>()
      for (const row of suits) {
        const list = suitByCard.get(row.slug)
        if (list) list.push(row.collection_slug)
        else suitByCard.set(row.slug, [row.collection_slug])
      }
      const inBoth = persisted
        .filter((row) => (suitByCard.get(row.slug) ?? []).includes('south-africa'))
        .map((row) => row.slug)
        .sort()
      assert.deepEqual(inBoth, [
        'cape-union-mart',
        'mendelsohn',
        'sa-jews-for-a-free-palestine',
        'uct-resolutions',
      ])
    })

    it('projects persisted locales through the real reader, not just the tables', async () => {
      const { DrizzleGraphReader } = await import('../src/graph/drizzle-reader')
      const { projectGraph } = await import('../src/graph/projection')
      const { DEFAULT_MAX_NODES, getGraphView } = await import('../src/graph/views')
      const { getDb } = await import('../src/db/client')

      // Asserted non-null rather than thrown, so the type narrows for the use below.
      const graphView = getGraphView('card-argument-taxonomy')
      assert.ok(graphView, 'the default view is registered')

      const reader = new DrizzleGraphReader(getDb())
      const result = await projectGraph(reader, {
        focus: 'apartheid-collaborators',
        view: graphView,
        depth: 1,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const card = result.nodes.find(
        (node) => node.type === 'card' && node.metadata.slug === 'apartheid-collaborators',
      )
      assert.ok(card && card.type === 'card')
      assert.deepEqual([...card.classification.localeSlugs], ['south-africa'])
      assert.equal(card.classification.localeIds.length, 1)
      assert.ok(
        !card.classification.suits.includes('south-africa'),
        'this card is a South Africa card curated under zionism-coded, so a projection that ' +
          'inferred the suit from the locale would invent a membership the seed does not claim',
      )
      assert.deepEqual([...card.classification.suits], ['zionism-coded'])
      assert.equal(
        card.classification.suitIds.length,
        card.classification.suits.length,
        'suit ids must stay parallel to suit slugs, since a client resolves a suit by id',
      )
    })
  },
)