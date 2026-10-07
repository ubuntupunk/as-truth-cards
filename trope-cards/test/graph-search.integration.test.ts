import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { DrizzleGraphReader } from '../src/graph/drizzle-reader'

/**
 * The real SQL behind `GET /api/graph/search`, against the live corpus.
 *
 * The unit/API suites drive the fake reader, so they prove the route contract and
 * validation; this suite proves the Drizzle query actually returns the rows the fake only
 * pretends to — and, most importantly, that the *tiered* rank (exact/prefix > full-text >
 * word_similarity) survives real stemming and the real trigram thresholds. The prefix-vs-
 * full-text ordering is the case that fails under the old `GREATEST(ts_rank_cd, similarity)`
 * ranking and passes under the tiered one.
 *
 * Read-only, and skipped unless `TROPE_GRAPH_DATABASE_URL` is set, so it runs in CI without
 * a database.
 */

const hasDatabase = Boolean(process.env.TROPE_GRAPH_DATABASE_URL)

describe(
  'searchCards (integration)',
  { skip: hasDatabase ? false : 'no TROPE_GRAPH_DATABASE_URL set' },
  () => {
    let reader: DrizzleGraphReader

    before(() => {
      reader = new DrizzleGraphReader()
    })

    it('finds a card by a full phrase', async () => {
      const results = await reader.searchCards('blood libel', 10)
      assert.ok(
        results.some((result) => result.slug === 'blood-libel'),
        `expected blood-libel, got ${JSON.stringify(results.map((r) => r.slug))}`,
      )
    })

    it('finds a card by a partial word inside a multi-word title', async () => {
      // "Zionism" is neither a prefix nor a substring of "Zionist-as-Slur"; word_similarity
      // matches the word "Zionist" inside it, where whole-string similarity scores low.
      const results = await reader.searchCards('Zionism', 10)
      assert.ok(
        results.some((result) => result.slug === 'zionist-as-slur'),
        `expected zionist-as-slur, got ${JSON.stringify(results.map((r) => r.slug))}`,
      )
    })

    it('returns nothing for a term no card matches', async () => {
      assert.deepEqual(await reader.searchCards('zzzzzz', 10), [])
    })

    it('degrades to an empty list, not an error, for a punctuation-only term', async () => {
      // websearch_to_tsquery ignores punctuation; the reader must not throw on it.
      assert.deepEqual(await reader.searchCards('!!!', 10), [])
    })

    it('ranks a prefix match above a full-text-only match', async () => {
      const results = await reader.searchCards('zion', 10)
      const slugs = results.map((result) => result.slug)
      const prefix = slugs.indexOf('zionist-as-slur')
      const fullText = slugs.indexOf('elders-of-zion')
      assert.ok(
        prefix >= 0,
        `expected a prefix match, got ${JSON.stringify(slugs)}`,
      )
      assert.ok(
        fullText >= 0,
        `expected a full-text match, got ${JSON.stringify(slugs)}`,
      )
      assert.ok(
        prefix < fullText,
        `prefix must outrank full-text, got ${JSON.stringify(slugs)}`,
      )
    })
  },
)
