import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  type FetchLike,
  type FetchResponseLike,
} from '../src/discovery/providers/http'
import {
  DATACITE_PROVIDER,
  createDataciteProvider,
  dataciteSourceTypeHint,
  mapDataciteItem,
} from '../src/discovery/providers/datacite'
import {
  DiscoveryProviderError,
  type CandidateProvenance,
} from '../src/discovery/types'

/**
 * The DataCite adapter, driven entirely by a mocked `fetch`.
 *
 * No test here touches the network: provider availability must never make the suite flaky. The
 * fixtures below are trimmed real DataCite payloads — the field names and nesting match
 * `data[].attributes`, so a mapping regression a live call would have hidden is caught.
 */

/** A single `data[]` element with sensible defaults, overridable per attribute. */
function item(
  attributeOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: '10.5281/zenodo.14548164',
    type: 'dois',
    attributes: {
      doi: '10.5281/zenodo.14548164',
      titles: [{ title: 'A Dataset of Things' }],
      creators: [
        { name: 'Marchesani, Graziano Enzo' },
        { givenName: 'Jane', familyName: 'Doe' },
      ],
      publisher: 'Zenodo',
      publicationYear: 2018,
      types: { resourceTypeGeneral: 'JournalArticle' },
      url: 'https://zenodo.org/records/14548164',
      dates: [{ date: '2018-05-24', dateType: 'Issued' }],
      identifiers: [{ identifier: 'oai:zenodo.org:14548164', identifierType: 'oai' }],
      container: {
        title: 'Journal of Things',
        identifier: '0378-5955',
        identifierType: 'ISSN',
      },
      ...attributeOverrides,
    },
  }
}

/** A DataCite `/dois` body. */
function page(items: Record<string, unknown>[], total = items.length): unknown {
  return { data: items, meta: { total, totalPages: 1, page: 1 }, links: {} }
}

/** A JSON response. */
function json(
  payload: unknown,
  init: { ok?: boolean; status?: number } = {},
): FetchResponseLike {
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

describe('createDataciteProvider mapping', () => {
  it('maps a page of DOIs into provider-neutral records', async () => {
    const { fetch } = mockFetch([
      json(
        page([
          item(),
          item({
            doi: '10.1000/ABC',
            titles: [{ title: 'Other Work' }],
            dates: [{ date: '2020', dateType: 'Issued' }],
            types: { resourceTypeGeneral: 'Dataset' },
          }),
        ]),
      ),
    ])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })

    const records = await provider.search({ query: 'dataset', limit: 10 })

    assert.equal(provider.name, DATACITE_PROVIDER)
    assert.equal(records.length, 2)

    const first = records[0]!
    assert.equal(first.provider, 'datacite')
    assert.equal(first.providerRecordId, '10.5281/zenodo.14548164')
    assert.equal(first.title, 'A Dataset of Things')
    // The first creator uses DataCite's printed `name`; the second has none, so it is composed.
    assert.equal(first.authors, 'Marchesani, Graziano Enzo; Doe, Jane')
    assert.equal(first.publicationDate, '2018-05-24')
    assert.equal(first.sourceTypeHint, 'ACADEMIC')
    assert.equal(first.doi, '10.5281/zenodo.14548164')
    assert.equal(first.url, 'https://zenodo.org/records/14548164')
    // `oai` is not a scheme this layer normalizes, so it is skipped; the container ISSN is kept.
    assert.deepEqual(
      first.identifiers.map((i) => [i.scheme, i.normalizedValue]),
      [
        ['DOI', '10.5281/zenodo.14548164'],
        ['URL', 'https://zenodo.org/records/14548164'],
        ['ISSN', '03785955'],
      ],
    )
    assert.equal(first.provenance.provider, 'datacite')
    assert.equal(first.provenance.endpoint, '/dois')
    assert.equal(first.provenance.query, 'dataset')
    assert.equal(first.provenance.rowsRequested, 10)
    assert.equal(first.provenance.totalResults, 2)
    assert.equal(first.query, 'dataset')

    // A year-only issued date is left null rather than inventing a month and day.
    assert.equal(records[1]!.publicationDate, null)
    assert.equal(records[1]!.sourceTypeHint, null)
  })

  it('normalizes a DOI that DataCite prints with whitespace or a resolver', () => {
    const provenance: CandidateProvenance = {
      provider: 'datacite',
      endpoint: '/dois',
      query: 'x',
      mailto: null,
      requestedAt: new Date(0).toISOString(),
      rowsRequested: 1,
    }
    const record = mapDataciteItem(
      item({
        doi: '  https://doi.org/10.1000/ABC  ',
        url: null,
        identifiers: [{ identifier: '10.1000/ABC', identifierType: 'DOI' }],
        container: {},
      }),
      { query: 'x', provenance },
    )
    // The DOI and its duplicate in `identifiers[]` collapse to one entry, and `value` keeps the
    // provider's printed form while `normalizedValue` is canonical.
    assert.equal(record?.doi, '10.1000/abc')
    assert.deepEqual(
      record?.identifiers.map((i) => [i.scheme, i.normalizedValue]),
      [['DOI', '10.1000/abc']],
    )
  })

  it('keeps a recognized identifier from the open identifiers[] list', () => {
    const provenance: CandidateProvenance = {
      provider: 'datacite',
      endpoint: '/dois',
      query: 'x',
      mailto: null,
      requestedAt: new Date(0).toISOString(),
      rowsRequested: 1,
    }
    const record = mapDataciteItem(
      item({
        identifiers: [
          { identifier: '12345678', identifierType: 'PMID' },
          { identifier: 'some:opaque', identifierType: 'Handle' },
          { identifier: '9999-9999', identifierType: 'ISSN' },
        ],
        container: {},
      }),
      { query: 'x', provenance },
    )
    assert.deepEqual(
      record?.identifiers.map((i) => [i.scheme, i.normalizedValue]),
      [
        ['DOI', '10.5281/zenodo.14548164'],
        ['URL', 'https://zenodo.org/records/14548164'],
        ['PMID', '12345678'],
        ['ISSN', '99999999'],
      ],
    )
  })

  it('sends the query, bounded page[size], and polite contact in the User-Agent', async () => {
    const { fetch, calls } = mockFetch([json(page([item()]))])
    const provider = createDataciteProvider({
      fetch,
      mailto: 'research@example.org',
      minIntervalMs: 0,
    })

    await provider.search({ query: 'a dataset of things', limit: 5 })

    assert.equal(calls.length, 1)
    const url = new URL(calls[0]!.url)
    assert.equal(url.origin + url.pathname, 'https://api.datacite.org/dois')
    assert.equal(url.searchParams.get('query'), 'a dataset of things')
    assert.equal(url.searchParams.get('page[size]'), '5')
    // DataCite asks for identification via the User-Agent, not a query parameter.
    assert.equal(url.searchParams.get('mailto'), null)
    assert.match(calls[0]!.headers['User-Agent']!, /research@example\.org/)
  })

  it('omits the contact from the User-Agent when none is configured', async () => {
    const { fetch, calls } = mockFetch([json(page([]))])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })
    await provider.search({ query: 'x', limit: 1 })
    assert.doesNotMatch(calls[0]!.headers['User-Agent']!, /mailto:/)
  })
})

describe('createDataciteProvider failure handling', () => {
  it('raises an http error with the status on a non-2xx response', async () => {
    const { fetch } = mockFetch([json({}, { ok: false, status: 503 })])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })

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
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })

    await assert.rejects(
      provider.search({ query: 'x', limit: 1 }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'malformed',
    )
  })

  it('raises a malformed error when data[] is absent', async () => {
    const { fetch } = mockFetch([json({ meta: { total: 0 } })])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })

    await assert.rejects(
      provider.search({ query: 'x', limit: 1 }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'malformed',
    )
  })

  it('returns an empty array for a valid empty page', async () => {
    const { fetch } = mockFetch([json(page([]))])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })
    assert.deepEqual(await provider.search({ query: 'x', limit: 1 }), [])
  })

  it('skips an item with no DOI but keeps the valid ones', async () => {
    const { fetch } = mockFetch([
      json(
        page([
          item(),
          { type: 'dois', attributes: { titles: [{ title: 'No DOI here' }] } },
          item({ doi: '10.1000/OK' }),
        ]),
      ),
    ])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })

    const records = await provider.search({ query: 'x', limit: 3 })
    assert.deepEqual(
      records.map((r) => r.providerRecordId),
      ['10.5281/zenodo.14548164', '10.1000/OK'],
    )
  })

  it('raises a timeout error when the request outlives the timeout', async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')))
      })
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0, timeoutMs: 10 })

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
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })

    await assert.rejects(
      provider.search({ query: 'x', limit: 1, signal: controller.signal }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'aborted',
    )
  })

  it('rejects an empty query without calling the network', async () => {
    const { fetch, calls } = mockFetch([])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })
    await assert.rejects(
      provider.search({ query: '   ', limit: 1 }),
      (error: unknown) =>
        error instanceof DiscoveryProviderError && error.kind === 'malformed',
    )
    assert.equal(calls.length, 0)
  })
})

describe('dataciteSourceTypeHint', () => {
  it('maps known types case-insensitively and leaves unknown ones null', () => {
    assert.equal(dataciteSourceTypeHint('JournalArticle'), 'ACADEMIC')
    assert.equal(dataciteSourceTypeHint('book'), 'BOOK')
    assert.equal(dataciteSourceTypeHint('Report'), 'INSTITUTIONAL')
    assert.equal(dataciteSourceTypeHint('Dataset'), null)
    assert.equal(dataciteSourceTypeHint(undefined), null)
  })
})

describe('createDataciteProvider retention and pagination scope', () => {
  it('never carries the raw provider record (retention unavailable)', async () => {
    const { fetch } = mockFetch([json(page([item()]))])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })

    const records = await provider.search({ query: 'x', limit: 1 })

    assert.equal(records.length, 1)
    assert.ok(
      !('rawPayload' in records[0]!),
      'the port must not be able to express verbatim retention while report §5 is unresolved',
    )
  })

  it('issues exactly one unpaginated request per search', async () => {
    const { fetch, calls } = mockFetch([json(page([item()]))])
    const provider = createDataciteProvider({ fetch, minIntervalMs: 0 })

    await provider.search({ query: 'x', limit: 20 })

    assert.equal(calls.length, 1)
    const url = new URL(calls[0]!.url)
    assert.equal(url.searchParams.get('page[number]'), null)
  })
})

describe('mapDataciteItem', () => {
  const provenance: CandidateProvenance = {
    provider: 'datacite',
    endpoint: '/dois',
    query: 'x',
    mailto: null,
    requestedAt: new Date(0).toISOString(),
    rowsRequested: 1,
  }

  it('returns null when the item has neither attributes.doi nor id', () => {
    assert.equal(
      mapDataciteItem(
        { type: 'dois', attributes: { titles: [{ title: 'No DOI' }] } },
        { query: 'x', provenance },
      ),
      null,
    )
  })

  it('falls back to the item id when attributes.doi is absent', () => {
    const record = mapDataciteItem(
      { id: '10.1000/xyz', attributes: { titles: [{ title: 'A Work' }] } },
      { query: 'x', provenance },
    )
    assert.equal(record?.providerRecordId, '10.1000/xyz')
    assert.equal(record?.doi, '10.1000/xyz')
  })

  it('falls back to the DOI as the title when the item is untitled', () => {
    const record = mapDataciteItem(
      {
        id: '10.1000/xyz',
        attributes: { doi: '10.1000/xyz', titles: [], container: {} },
      },
      { query: 'x', provenance },
    )
    assert.equal(record?.title, '10.1000/xyz')
  })

  it('falls back to the container title when there is no titles[]', () => {
    const record = mapDataciteItem(
      {
        id: '10.1000/xyz',
        attributes: {
          doi: '10.1000/xyz',
          container: { title: 'Journal of Things' },
        },
      },
      { query: 'x', provenance },
    )
    assert.equal(record?.title, 'Journal of Things')
  })

  it('rejects a date outside the calendar rather than failing the ingest batch', () => {
    const record = mapDataciteItem(
      item({
        dates: [{ date: '2018-02-31', dateType: 'Issued' }],
      }),
      { query: 'x', provenance },
    )
    assert.equal(record?.publicationDate, null)
  })

  it('uses only the Issued date type', () => {
    const record = mapDataciteItem(
      item({
        dates: [
          { date: '2019-01-01', dateType: 'Updated' },
          { date: '2018-05-24', dateType: 'Issued' },
        ],
      }),
      { query: 'x', provenance },
    )
    assert.equal(record?.publicationDate, '2018-05-24')
  })
})
