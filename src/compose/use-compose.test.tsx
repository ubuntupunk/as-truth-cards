/**
 * Tests for `use-compose.ts` — the query-key and option contract.
 *
 * Following the graph suite’s convention, the Query hooks themselves are not spun up here:
 * their guarantee is key determinism and the request they will issue. `canonical
 * ProjectionQueryOptions` is a plain object builder, so its `queryFn` can be driven against
 * a stubbed `fetch` to prove the projection is requested from the graph API at depth 3 under
 * the `argument` view — the exact read the canonical panel renders.
 */

import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { GraphApiError } from '../graph/use-graph'
import {
  canonicalProjectionQueryOptions,
  composeDraftQueryKey,
  DRAFT_VOCABULARIES_QUERY_KEY,
  decodeDraftResponse,
} from './use-compose'

/** Stand-in response shape; `fetchValidated` only reads ok/status/json(). */
type StubResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

/** Request URL captured by the stub, for asserting the query string. */
let lastUrl = ''

function stubFetch(handler: (url: string) => StubResponse) {
  const original = globalThis.fetch
  lastUrl = ''
  ;(globalThis as { fetch?: unknown }).fetch = (input: RequestInfo | URL) => {
    lastUrl = String(input)
    return Promise.resolve().then(() => handler(lastUrl))
  }
  return () => {
    ;(globalThis as { fetch?: unknown }).fetch = original
  }
}

describe('composeDraftQueryKey', () => {
  it('is the stable per-card tuple the mutations invalidate', () => {
    assert.deepEqual(composeDraftQueryKey('jesus-was-a-zionist'), [
      'composition',
      'draft',
      'jesus-was-a-zionist',
    ])
  })

  it('separates two cards', () => {
    assert.notDeepEqual(composeDraftQueryKey('a'), composeDraftQueryKey('b'))
  })
})

describe('DRAFT_VOCABULARIES_QUERY_KEY', () => {
  it('is a single shared key for the catalogue', () => {
    assert.deepEqual(
      [...DRAFT_VOCABULARIES_QUERY_KEY],
      ['composition', 'vocabularies'],
    )
  })
})

describe('decodeDraftResponse', () => {
  it('preserves the exact server message on a failed save', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'Some claims are not on this card.',
        detail: { claims: ['unknown-claim'] },
      }),
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
      },
    )

    await assert.rejects(
      decodeDraftResponse(response),
      (error: unknown) =>
        error instanceof GraphApiError &&
        error.message === 'Some claims are not on this card.',
    )
  })

  it('falls back to an HTTP message when the server sends no error text', async () => {
    const response = new Response('', { status: 500 })

    await assert.rejects(
      decodeDraftResponse(response),
      (error: unknown) =>
        error instanceof GraphApiError &&
        error.message ===
          'Request failed with HTTP 500 while trying to save the decomposition draft',
    )
  })
})

describe('canonicalProjectionQueryOptions', () => {
  afterEach(() => {
    ;(globalThis as { fetch?: unknown }).fetch = undefined
  })

  it('is disabled until a card is chosen', () => {
    assert.equal(canonicalProjectionQueryOptions(null).enabled, false)
    assert.equal(canonicalProjectionQueryOptions('a-card').enabled, true)
  })

  it('names the projection by focus, view and depth in its key', () => {
    assert.deepEqual(canonicalProjectionQueryOptions('a-card').queryKey, [
      'graph',
      'projection',
      'a-card',
      'argument',
      3,
    ])
  })

  it('requests the card-focused argument projection from the graph API', async () => {
    const restore = stubFetch(() => ({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    }))
    try {
      const options = canonicalProjectionQueryOptions('a-card')
      await assert.rejects(options.queryFn())
      const url = new URL(lastUrl, 'http://local')
      assert.equal(url.pathname, '/api/graph')
      assert.equal(url.searchParams.get('focus'), 'a-card')
      assert.equal(url.searchParams.get('view'), 'argument')
      assert.equal(url.searchParams.get('depth'), '3')
    } finally {
      restore()
    }
  })
})
