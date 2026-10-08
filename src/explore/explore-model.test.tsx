/**
 * Tests for `explore-model.ts` — the Explore page's pure browse core.
 *
 * The contract under test is the three invariants the module documents:
 * facets select among loaded rows and never invent classification (a Suit
 * filter must not match a card that merely carries the same-named Locale);
 * search keeps the server's rank order and never re-sorts it, while hits
 * outside the loaded page are shown unclassified only when no facet is active
 * and are withheld — with a count — when one is; and count lines say what
 * they counted, including the loaded prefix of a paged listing.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ALL_CARDS,
  CONTESTED_CARD,
  ESTABLISHED_CARD,
  OPEN_CARD,
} from '../deck/test-fixtures'
import type { CardSearchResult } from '../graph/projection-guards'
import {
  availableSuits,
  type ExploreQuery,
  type ExploreResults,
  exploreCountLabel,
  exploreResults,
  hasActiveFilters,
  matchesQuery,
  NO_EXPLORE_QUERY,
} from './explore-model'

/** A server-shaped search hit for a slug. */
function hit(slug: string, rank: number): CardSearchResult {
  return {
    id: `id-${slug}`,
    slug,
    title: slug,
    summary: null,
    type: 'card',
    rank,
  }
}

/** Slugs of the rendered results, in order. */
function slugs(results: ExploreResults['results']): string[] {
  return results.map((result) =>
    result.kind === 'row' ? result.card.slug : result.hit.slug,
  )
}

describe('hasActiveFilters', () => {
  it('treats sort alone as ordering, not filtering', () => {
    assert.equal(
      hasActiveFilters({ ...NO_EXPLORE_QUERY, sort: 'status' }),
      false,
    )
  })

  it('is active as soon as any facet is set', () => {
    assert.equal(
      hasActiveFilters({ ...NO_EXPLORE_QUERY, axis: 'TACTIC' }),
      true,
    )
    assert.equal(
      hasActiveFilters({ ...NO_EXPLORE_QUERY, status: 'OPEN' }),
      true,
    )
    assert.equal(
      hasActiveFilters({ ...NO_EXPLORE_QUERY, suit: 'classic' }),
      true,
    )
  })
})

describe('availableSuits', () => {
  it('lists present suits in vocabulary order', () => {
    assert.deepEqual(availableSuits(ALL_CARDS), [
      'classic',
      'south-africa',
      'foundational',
    ])
  })

  it('places slugs outside the vocabulary alphabetically after the known five', () => {
    const odd: typeof ALL_CARDS = [
      {
        ...CONTESTED_CARD,
        classification: {
          ...CONTESTED_CARD.classification,
          suits: ['mystery-suit', 'classic', 'another-odd'],
        },
      },
    ]
    assert.deepEqual(availableSuits(odd), [
      'classic',
      'another-odd',
      'mystery-suit',
    ])
  })

  it('offers no suit for a card list that carries none', () => {
    assert.deepEqual(availableSuits([CONTESTED_CARD]), [])
  })
})

describe('matchesQuery', () => {
  it('passes everything when no facet is set', () => {
    for (const card of ALL_CARDS) {
      assert.equal(matchesQuery(card, NO_EXPLORE_QUERY), true)
    }
  })

  it('keeps a card whose classification carries the axis in any ordinal', () => {
    const query: ExploreQuery = { ...NO_EXPLORE_QUERY, axis: 'HISTORICAL' }
    assert.equal(matchesQuery(OPEN_CARD, query), true)
    assert.equal(matchesQuery(CONTESTED_CARD, query), true)
    assert.equal(matchesQuery(ESTABLISHED_CARD, query), false)
  })

  it('distinguishes a Suit from a same-named Locale', () => {
    const query: ExploreQuery = { ...NO_EXPLORE_QUERY, suit: 'south-africa' }
    assert.equal(matchesQuery(OPEN_CARD, query), true)
    assert.equal(matchesQuery(CONTESTED_CARD, query), false)
  })
})

describe('exploreResults (browse)', () => {
  it('renders every card in listing order with no facets', () => {
    const out = exploreResults(ALL_CARDS, NO_EXPLORE_QUERY, null)
    assert.deepEqual(slugs(out.results), [
      'an-open-question',
      'an-established-fact',
      'a-contested-reading',
    ])
    assert.equal(out.withheldHits, 0)
    assert.equal(out.byRelevance, false)
  })

  it('applies every active facet with AND semantics', () => {
    const out = exploreResults(
      ALL_CARDS,
      { ...NO_EXPLORE_QUERY, axis: 'HISTORICAL', status: 'CONTESTED' },
      null,
    )
    assert.deepEqual(slugs(out.results), ['a-contested-reading'])
  })

  it('leaves title order untouched', () => {
    const out = exploreResults(
      ALL_CARDS,
      { ...NO_EXPLORE_QUERY, sort: 'title' },
      null,
    )
    assert.deepEqual(
      slugs(out.results),
      slugs(exploreResults(ALL_CARDS, NO_EXPLORE_QUERY, null).results),
    )
  })

  it('orders by research status in vocabulary order, keeping title order within', () => {
    const out = exploreResults(
      ALL_CARDS,
      { ...NO_EXPLORE_QUERY, sort: 'status' },
      null,
    )
    assert.deepEqual(slugs(out.results), [
      'an-established-fact',
      'a-contested-reading',
      'an-open-question',
    ])

    const second: typeof ALL_CARDS = [
      { ...OPEN_CARD, slug: 'another-open', title: 'Another open' },
      OPEN_CARD,
    ]
    const tied = exploreResults(
      second,
      { ...NO_EXPLORE_QUERY, sort: 'status' },
      null,
    )
    assert.deepEqual(slugs(tied.results), ['another-open', 'an-open-question'])
  })
})

describe('exploreResults (search)', () => {
  it('walks the server rank order and joins rows by slug', () => {
    const out = exploreResults(
      ALL_CARDS,
      { ...NO_EXPLORE_QUERY, sort: 'status' },
      [hit('a-contested-reading', 2), hit('an-open-question', 1)],
    )
    assert.deepEqual(slugs(out.results), [
      'a-contested-reading',
      'an-open-question',
    ])
    assert.equal(out.byRelevance, true)
    assert.equal(out.withheldHits, 0)
  })

  it('renders a hit without a loaded row as unclassified when no facet is active', () => {
    const out = exploreResults(ALL_CARDS, NO_EXPLORE_QUERY, [
      hit('never-loaded', 1),
    ])
    assert.equal(out.results.length, 1)
    assert.equal(out.results[0].kind, 'hit')
    assert.equal(out.withheldHits, 0)
  })

  it('withholds a rowless hit when a facet is active, counting it', () => {
    const out = exploreResults(
      ALL_CARDS,
      { ...NO_EXPLORE_QUERY, status: 'OPEN' },
      [hit('never-loaded', 2), hit('an-open-question', 1)],
    )
    assert.deepEqual(slugs(out.results), ['an-open-question'])
    assert.equal(out.withheldHits, 1)
  })

  it('drops a loaded row that fails the facet, without counting it as withheld', () => {
    const out = exploreResults(
      ALL_CARDS,
      { ...NO_EXPLORE_QUERY, axis: 'THEOLOGICAL' },
      [hit('an-open-question', 1), hit('an-established-fact', 2)],
    )
    assert.deepEqual(slugs(out.results), ['an-established-fact'])
    assert.equal(out.withheldHits, 0)
  })
})

describe('exploreCountLabel', () => {
  it('says the plain total when nothing narrows it', () => {
    assert.equal(
      exploreCountLabel({ shown: 3, total: 3, served: 3, searching: false }),
      '3 cards',
    )
  })

  it('says what is shown of what exists, singular when one', () => {
    assert.equal(
      exploreCountLabel({ shown: 1, total: 3, served: 3, searching: false }),
      '1 of 3 cards',
    )
    assert.equal(
      exploreCountLabel({ shown: 1, total: 1, served: 1, searching: false }),
      '1 card',
    )
  })

  it('admits the listing is only partially loaded', () => {
    assert.equal(
      exploreCountLabel({ shown: 2, total: 3, served: 2, searching: false }),
      '2 of 3 cards (first 2 loaded)',
    )
  })

  it('counts search matches instead of cards', () => {
    assert.equal(
      exploreCountLabel({ shown: 2, total: 3, served: 3, searching: true }),
      '2 matches',
    )
    assert.equal(
      exploreCountLabel({ shown: 1, total: 3, served: 3, searching: true }),
      '1 match',
    )
  })
})
