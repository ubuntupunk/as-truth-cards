import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CROSSREF_PROVIDER,
  type FetchLike,
  type FetchResponseLike,
  createCrossrefProvider,
  crossrefSourceTypeHint,
  mapCrossrefItem,
} from '../src/discovery/providers/crossref'
import {
  DiscoveryProviderError,
  type CandidateProvenance,
} from '../src/discovery/types'

/**
 * The Crossref adapter, driven entirely by a mocked `fetch`.
 *
 * No test here touches the network: provider availability must never make the suite flaky.
 * The fixtures below are trimmed real Crossref payloads — the field names and shapes match
 * `message.items[]`, so a mapping regression that a live call would have hidden is caught.
 */

/** A single `message.items[]` element with sensible defaults. */
function work(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DOI: '10.1371/journal.pone.0197326',
    title: ['A Study of Things'],
    author: [
      { given: 'Jane', family: 'Doe' },
      { given: 'John', family: 'Roe' },
    ],
    issued: { 'date-parts': [[2018, 5, 24]] },
    type: 'journal-article',
    URL: 'https://doi.org/10.1371/journal.pone.0197326',
    ISSN: ['0378-5955'],
    ...overrides,
  }
}

/** A Crossref work-list body. */
function page(items: Record<string, unknown>[], totalResults = items.length): unknown {
  return {
    status: 'ok',
    'message-type': 'work-list',
    message: { 'total-results': totalResults, items },
  }
}

/** A JSON response. */
function json(payload: unknown, init: { ok?: boolean; status?: number } = {}): FetchResponseLike {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => payload,
  }
}

/** A captured request. */
type Call = { url: string; headers: Record<string, string> }

/** Build a fetch that returns each queued response in order and records the requests. */
function mockFetch(
  responses: (FetchResponseLike | ((url: string) => Promise<FetchResponseLike>))[],
): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = []
  let index = 0
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers })
    const next = responses[index++]
    if (next === undefined) throw new Error('mock fetch: no queued response')
    return typeof next === 'function' ? next(url) : next
  }
  return { fetch, calls }
}

describe('createCrossrefProvider mapping', () => {
  it('maps a page of works into provider-neutral records', async () => {
    const { fetch } = mockFetch([
      json(
        page([
          work(),
          work({
            DOI: '10.1000/XYZ',
            title: ['Other Work'],
            issued: { 'date-parts': [[2020]] },
          }),
        ]),
      ),
    ])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })

    const records = await provider.search({ query: 'study', limit: 10 })

    assert.equal(provider.name, CROSSREF_PROVIDER)
    assert.equal(records.length, 2)

    const first = records[0]!
    assert.equal(first.provider, 'crossref')
    assert.equal(first.providerRecordId, '10.1371/journal.pone.0197326')
    assert.equal(first.title, 'A Study of Things')
    assert.equal(first.authors, 'Doe, Jane; Roe, John')
    assert.equal(first.publicationDate, '2018-05-24')
    assert.equal(first.sourceTypeHint, 'ACADEMIC')
    assert.equal(first.doi, '10.1371/journal.pone.0197326')
    assert.deepEqual(
      first.identifiers.map((i) => [i.scheme, i.normalizedValue]),
      [
        ['DOI', '10.1371/journal.pone.0197326'],
        ['URL', 'https://doi.org/10.1371/journal.pone.0197326'],
        ['ISSN', '03785955'],
      ],
    )
    assert.equal(first.provenance.provider, 'crossref')
    assert.equal(first.provenance.endpoint, '/works')
    assert.equal(first.provenance.query, 'study')
    assert.equal(first.provenance.rowsRequested, 10)
    assert.equal(first.provenance.totalResults, 2)
    assert.equal(first.query, 'study')

    // A year-only issued date is left null rather than inventing a month and day.
    assert.equal(records[1]!.publicationDate, null)
  })

  it('sends the query, bounded rows, and polite-pool contact', async () => {
    const { fetch, calls } = mockFetch([json(page([work()]))])
    const provider = createCrossrefProvider({
      fetch,
      mailto: 'research@example.org',
      minIntervalMs: 0,
    })

    await provider.search({ query: 'a study of things', limit: 5 })

    assert.equal(calls.length, 1)
    const url = new URL(calls[0]!.url)
    assert.equal(url.origin + url.pathname, 'https://api.crossref.org/works')
    assert.equal(url.searchParams.get('query'), 'a study of things')
    assert.equal(url.searchParams.get('rows'), '5')
    assert.equal(url.searchParams.get('mailto'), 'research@example.org')
    assert.match(calls[0]!.headers['User-Agent']!, /research@example\.org/)
  })

  it('omits the mailto parameter when no contact is configured', async () => {
    const { fetch, calls } = mockFetch([json(page([]))])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })
    await provider.search({ query: 'x', limit: 1 })
    const url = new URL(calls[0]!.url)
    assert.equal(url.searchParams.get('mailto'), null)
  })
})

describe('createCrossrefProvider failure handling', () => {
  it('raises an http error with the status on a non-2xx response', async () => {
    const { fetch } = mockFetch([json({}, { ok: false, status: 503 })])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })

    await assert.rejects(
      provider.search({ query: 'x', limit: 1 }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError &&
        error.kind === 'http' &&
        error.status === 503,
    )
  })

  it('raises a malformed error when the body is not JSON', async () => {
    const broken: FetchResponseLike = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    }
    const { fetch } = mockFetch([broken])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })

    await assert.rejects(
      provider.search({ query: 'x', limit: 1 }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'malformed',
    )
  })

  it('raises a malformed error when message.items[] is absent', async () => {
    const { fetch } = mockFetch([json({ status: 'ok', message: {} })])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })

    await assert.rejects(
      provider.search({ query: 'x', limit: 1 }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'malformed',
    )
  })

  it('returns an empty array for a valid empty page', async () => {
    const { fetch } = mockFetch([json(page([]))])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })
    assert.deepEqual(await provider.search({ query: 'x', limit: 1 }), [])
  })

  it('skips a malformed item but keeps the valid ones', async () => {
    const { fetch } = mockFetch([
      json(page([work(), { title: ['No DOI here'] }, work({ DOI: '10.1000/OK' })])),
    ])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })

    const records = await provider.search({ query: 'x', limit: 3 })
    assert.deepEqual(
      records.map((r) => r.providerRecordId),
      ['10.1371/journal.pone.0197326', '10.1000/OK'],
    )
  })

  it('raises a timeout error when the request outlives the timeout', async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')))
      })
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0, timeoutMs: 10 })

    await assert.rejects(
      provider.search({ query: 'x', limit: 1 }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'timeout',
    )
  })

  it('raises an aborted error when the caller signal fires', async () => {
    const controller = new AbortController()
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')))
        controller.abort()
      })
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })

    await assert.rejects(
      provider.search({ query: 'x', limit: 1, signal: controller.signal }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'aborted',
    )
  })

  it('rejects an empty query without calling the network', async () => {
    const { fetch, calls } = mockFetch([])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })
    await assert.rejects(
      provider.search({ query: '   ', limit: 1 }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'malformed',
    )
    assert.equal(calls.length, 0)
  })
})

describe('crossrefSourceTypeHint', () => {
  it('maps known types and leaves unknown ones null', () => {
    assert.equal(crossrefSourceTypeHint('journal-article'), 'ACADEMIC')
    assert.equal(crossrefSourceTypeHint('book'), 'BOOK')
    assert.equal(crossrefSourceTypeHint('report'), 'INSTITUTIONAL')
    assert.equal(crossrefSourceTypeHint('dataset'), null)
    assert.equal(crossrefSourceTypeHint(undefined), null)
  })
})

describe('createCrossrefProvider retention and pagination scope', () => {
  it('never carries the raw provider record (retention unavailable)', async () => {
    const { fetch } = mockFetch([json(page([work()]))])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })

    const records = await provider.search({ query: 'x', limit: 1 })

    assert.equal(records.length, 1)
    assert.ok(
      !('rawPayload' in records[0]!),
      'the port must not be able to express verbatim retention while report §5 is unresolved',
    )
  })

  it('issues exactly one unpaginated request per search', async () => {
    const { fetch, calls } = mockFetch([json(page([work()]))])
    const provider = createCrossrefProvider({ fetch, minIntervalMs: 0 })

    await provider.search({ query: 'x', limit: 20 })

    assert.equal(calls.length, 1)
    const url = new URL(calls[0]!.url)
    assert.equal(url.searchParams.get('offset'), null)
  })
})

describe('mapCrossrefItem', () => {
  it('returns null when the item has no DOI', () => {
    const provenance: CandidateProvenance = {
      provider: 'crossref',
      endpoint: '/works',
      query: 'x',
      mailto: null,
      requestedAt: new Date(0).toISOString(),
      rowsRequested: 1,
    }
    assert.equal(mapCrossrefItem({ title: ['No DOI'] }, { query: 'x', provenance }), null)
  })

  it('falls back to the DOI as the title when the item is untitled', () => {
    const provenance: CandidateProvenance = {
      provider: 'crossref',
      endpoint: '/works',
      query: 'x',
      mailto: null,
      requestedAt: new Date(0).toISOString(),
      rowsRequested: 1,
    }
    const record = mapCrossrefItem(
      { DOI: '10.1000/xyz' },
      { query: 'x', provenance },
    )
    assert.equal(record?.title, '10.1000/xyz')
  })
})
