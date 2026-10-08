/**
 * Tests for `use-deck.ts` — the deck's one data access path.
 *
 * The hook itself needs a mounted tree, but the part worth pinning is
 * extracted as `deckCardsQueryOptions`: the query key must not collide with
 * the admin CRUD `['cards']` key, the URL must ask the server for exactly one
 * page, and the response must go through `assertCardListResponse` — so a body
 * that is not a `CardListResponse` rejects instead of reaching a card panel
 * that would render its absence as `0`.
 */

import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { DEFAULT_VIEW_NAME } from '../../trope-cards/src/graph/views.ts'
import { ProjectionShapeError } from '../graph/projection-guards'
import { CARD_PROJECTION } from '../graph/test-fixtures'
import { GraphApiError, graphProjectionQueryOptions } from '../graph/use-graph'
import { CARD_VIEW, OPEN_CARD } from './test-fixtures'
import {
  DECK_CARDS_LIMIT,
  DECK_CARDS_QUERY_KEY,
  deckCardsQueryOptions,
  deckProjectionParams,
} from './use-deck'

const originalFetch = globalThis.fetch

after(() => {
  globalThis.fetch = originalFetch
})

/** The valid listing body the server would return for one card. */
const VALID_BODY = {
  items: [OPEN_CARD],
  total: 47,
  limit: DECK_CARDS_LIMIT,
  offset: 0,
}

/** Answer every fetch with `body`, returning the URLs that were requested. */
function stubFetch(body: unknown, status = 200): string[] {
  const urls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input))
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return urls
}

describe('deck listing query', () => {
  it('namespaces the key so it cannot collide with admin card CRUD', () => {
    assert.deepEqual(DECK_CARDS_QUERY_KEY, ['graph', 'cards', 200])
    assert.notDeepEqual(DECK_CARDS_QUERY_KEY, ['cards'])
    assert.deepEqual(deckCardsQueryOptions().queryKey, DECK_CARDS_QUERY_KEY)
  })

  it('asks the server for one bounded page', async () => {
    const urls = stubFetch(VALID_BODY)
    const body = await deckCardsQueryOptions().queryFn()
    assert.equal(urls[0], '/api/graph/cards?limit=200')
    assert.equal(body.total, 47)
    assert.equal(body.items[0].slug, 'an-open-question')
    assert.equal(body.items[0].classification.localeSlugs[0], 'south-africa')
  })

  it('rejects a body that is not a CardListResponse', async () => {
    stubFetch({ items: [{ id: 1 }], total: 'many', limit: 200, offset: 0 })
    await assert.rejects(
      deckCardsQueryOptions().queryFn(),
      ProjectionShapeError,
    )
  })

  it('rejects a card whose classification lists are missing', async () => {
    stubFetch({
      items: [{ ...OPEN_CARD, classification: { axes: [] } }],
      total: 1,
      limit: 200,
      offset: 0,
    })
    await assert.rejects(
      deckCardsQueryOptions().queryFn(),
      ProjectionShapeError,
    )
  })

  it('surfaces a failed response as a GraphApiError, not a shape error', async () => {
    stubFetch({ error: 'the deck listing is unavailable' }, 503)
    await assert.rejects(
      deckCardsQueryOptions().queryFn(),
      (error: unknown) =>
        error instanceof GraphApiError &&
        error.status === 503 &&
        error.message === 'the deck listing is unavailable',
    )
  })

  it('does not retry a rejected listing', () => {
    const options = deckCardsQueryOptions()
    assert.equal(options.retry, false)
    assert.equal(options.staleTime, 60_000)
    assert.equal(DECK_CARDS_LIMIT, 200)
  })
})

describe('deck projection params', () => {
  it('pins the canonical view at a depth that carries provenance', () => {
    assert.deepEqual(deckProjectionParams('some-slug', CARD_VIEW), {
      focus: 'some-slug',
      view: DEFAULT_VIEW_NAME,
      depth: 2,
    })
  })

  it('clamps to the view’s own ceiling rather than asking for more', () => {
    assert.equal(
      deckProjectionParams('some-slug', { ...CARD_VIEW, maxDepth: 1 }).depth,
      1,
    )
  })

  it('keeps depth=2 in the request URL while the catalogue is still loading', async () => {
    const urls = stubFetch(CARD_PROJECTION)
    const options = graphProjectionQueryOptions(
      deckProjectionParams('some-slug', null),
    )
    await options.queryFn()
    assert.equal(
      urls[0],
      `/api/graph?focus=some-slug&view=${DEFAULT_VIEW_NAME}&depth=2`,
    )
  })

  it('asks for nothing at all until a card is featured', () => {
    const options = graphProjectionQueryOptions(
      deckProjectionParams(null, CARD_VIEW),
    )
    assert.equal(options.enabled, false)
  })
})
