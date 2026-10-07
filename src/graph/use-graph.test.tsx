/**
 * Tests for `use-graph.ts` — the fetch/validation/error path.
 *
 * `fetchValidated` is pure enough to test under Node with a stubbed global
 * `fetch`: the entire contract (2xx → validate, non-2xx → GraphApiError,
 * bad body → ProjectionShapeError, network → status 0) is observable through
 * the function alone. The two Query hooks themselves are thin callers of
 * `fetchValidated`, so the key-determinism guarantee is what gets pinned here
 * instead of spinning up a QueryClient.
 */

import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  assertGraphProjection,
  ProjectionShapeError,
} from './projection-guards'
import type { GraphParams } from './query-params'
import { CARD_PROJECTION } from './test-fixtures'
import {
  fetchValidated,
  GraphApiError,
  graphProjectionQueryKey,
  graphProjectionQueryOptions,
  graphSearchQueryKey,
} from './use-graph'

/** Stand-in response shape; `fetchValidated` only reads ok/status/json(). */
type StubResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

function stubFetch(handler: (url: string) => StubResponse | Promise<never>) {
  const original = globalThis.fetch
  ;(globalThis as { fetch?: unknown }).fetch = (input: RequestInfo | URL) =>
    Promise.resolve().then(() => handler(String(input)))
  return () => {
    ;(globalThis as { fetch?: unknown }).fetch = original
  }
}

describe('fetchValidated', () => {
  afterEach(() => {
    // The suite stubs global fetch; any leaked stub must not outlive a test.
    ;(globalThis as { fetch?: unknown }).fetch = undefined
  })

  it('resolves and validates a 200 projection body', async () => {
    const restore = stubFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(JSON.stringify(CARD_PROJECTION))),
    }))
    try {
      const projection = await fetchValidated(
        '/api/graph?focus=x',
        assertGraphProjection,
      )
      assert.equal(projection.focus.type, 'card')
    } finally {
      restore()
    }
  })

  it('decodes a 400 body into GraphApiError with status and detail', async () => {
    const restore = stubFetch(() => ({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'focus must be a card uuid or slug',
          detail: 'parseGraphQuery failed',
        }),
    }))
    try {
      await assert.rejects(
        fetchValidated('/api/graph?focus=%20%20', assertGraphProjection),
        (error: unknown) =>
          error instanceof GraphApiError &&
          error.status === 400 &&
          error.message.includes('uuid or slug') &&
          error.detail === 'parseGraphQuery failed',
      )
    } finally {
      restore()
    }
  })

  it('falls back to a friendly message when a 404 body is not JSON', async () => {
    const restore = stubFetch(() => ({
      ok: false,
      status: 404,
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    }))
    try {
      await assert.rejects(
        fetchValidated('/api/graph?focus=missing', assertGraphProjection),
        (error: unknown) =>
          error instanceof GraphApiError &&
          error.status === 404 &&
          error.detail === null &&
          error.message === 'Request failed with HTTP 404',
      )
    } finally {
      restore()
    }
  })

  it('treats a 200 with a non-JSON body as malformed', async () => {
    const restore = stubFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    }))
    try {
      await assert.rejects(
        fetchValidated('/api/graph?focus=x', assertGraphProjection),
        (error: unknown) =>
          error instanceof ProjectionShapeError &&
          error.path === 'response' &&
          error.message.includes('not valid JSON'),
      )
    } finally {
      restore()
    }
  })

  it('propagates shape errors from a 200 with a wrong body', async () => {
    const restore = stubFetch(() => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ hello: 'edge case' }),
    }))
    try {
      await assert.rejects(
        fetchValidated('/api/graph?focus=x', assertGraphProjection),
        (error: unknown) => error instanceof ProjectionShapeError,
      )
    } finally {
      restore()
    }
  })

  it('maps a network failure to GraphApiError status 0', async () => {
    const restore = stubFetch(() =>
      Promise.reject(new TypeError('fetch failed')),
    )
    try {
      await assert.rejects(
        fetchValidated('/api/graph?focus=x', assertGraphProjection),
        (error: unknown) =>
          error instanceof GraphApiError &&
          error.status === 0 &&
          error.message.includes('Network error'),
      )
    } finally {
      restore()
    }
  })
})

describe('graphProjectionQueryKey', () => {
  it('is deterministic for identical params', () => {
    const params: GraphParams = {
      focus: 'x',
      view: 'taxonomy',
      depth: 2,
    }
    assert.deepEqual(
      graphProjectionQueryKey(params),
      graphProjectionQueryKey(params),
    )
  })

  it('differs when any parameter differs', () => {
    const base: GraphParams = { focus: 'x', view: null, depth: null }
    assert.notDeepEqual(
      graphProjectionQueryKey(base),
      graphProjectionQueryKey({ ...base, depth: 1 }),
    )
    assert.notDeepEqual(
      graphProjectionQueryKey(base),
      graphProjectionQueryKey({ ...base, focus: 'y' }),
    )
  })

  it('stays deterministic for a disabled (no-focus) query', () => {
    const noFocus: GraphParams = { focus: null, view: 'taxonomy', depth: null }
    assert.deepEqual(
      graphProjectionQueryKey(noFocus),
      graphProjectionQueryKey(noFocus),
    )
  })
})

describe('graphSearchQueryKey', () => {
  it('is namespaced under graph/search and keyed by the trimmed term', () => {
    assert.deepEqual(graphSearchQueryKey('blood'), ['graph', 'search', 'blood'])
  })
})

describe('graphProjectionQueryOptions', () => {
  it('enables the query only once a focus is set', () => {
    const enabled = graphProjectionQueryOptions({
      focus: 'x',
      view: null,
      depth: null,
    })
    assert.equal(enabled.enabled, true)
    const disabled = graphProjectionQueryOptions({
      focus: null,
      view: null,
      depth: null,
    })
    assert.equal(disabled.enabled, false)
  })

  it('refuses to retry, so 400/404/413 render instead of spinning', () => {
    const options = graphProjectionQueryOptions({
      focus: 'x',
      view: null,
      depth: null,
    })
    assert.equal(options.retry, false)
  })
})
