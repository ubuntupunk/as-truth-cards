import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DISCOVERY_LIMIT_MAX,
  DiscoveryQueryError,
  createDiscoveryService,
} from '../src/discovery/service'
import {
  type CandidateListFilter,
  type CandidateRow,
  type DiscoveryCandidateStore,
  type ReviewDecision,
  type ReviewEvent,
  type ReviewOutcome,
} from '../src/discovery/store'
import type { DiscoveredRecord, DiscoveryProvider } from '../src/discovery/types'

/**
 * The service, over an in-memory store and a scripted provider.
 *
 * The service is where "discovery records candidates" is enforced: `discover` may call only
 * `upsertMany`, never `review` or `promote`. These tests spy on the store to prove that,
 * independently of any route or schema.
 */

/** An in-memory candidate store that preserves review state across upserts. */
class MemoryStore implements DiscoveryCandidateStore {
  readonly rows = new Map<string, CandidateRow>()
  reviewCalls = 0
  promoteCalls = 0
  private seq = 0

  async upsertMany(records: readonly DiscoveredRecord[]) {
    let created = 0
    let updated = 0
    for (const record of records) {
      const key = `${record.provider}\u0000${record.providerRecordId}`
      const existing = this.rows.get(key)
      if (existing) {
        updated++
        this.rows.set(key, {
          ...existing,
          title: record.title,
          authors: record.authors,
          doi: record.doi,
          retrievedAt: new Date(),
        })
      } else {
        created++
        this.seq++
        this.rows.set(key, {
          id: `cand-${this.seq}`,
          provider: record.provider,
          providerRecordId: record.providerRecordId,
          title: record.title,
          authors: record.authors,
          publicationDate: record.publicationDate,
          sourceTypeHint: record.sourceTypeHint,
          doi: record.doi,
          url: record.url,
          identifiers: record.identifiers,
          provenance: record.provenance,
          query: record.query,
          retrievedAt: new Date(),
          reviewStatus: 'CANDIDATE',
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          promotedSourceId: null,
          revision: 0,
          createdAt: new Date(),
        })
      }
    }
    return { created, updated }
  }

  async list(filter: CandidateListFilter) {
    const items = [...this.rows.values()]
      .filter((row) => filter.status === undefined || row.reviewStatus === filter.status)
      .filter((row) => filter.provider === undefined || row.provider === filter.provider)
      .slice(filter.offset, filter.offset + filter.limit)
    return { items, total: this.rows.size }
  }

  async getById(id: string): Promise<CandidateRow | null> {
    return [...this.rows.values()].find((row) => row.id === id) ?? null
  }

  eventCalls: string[] = []

  async listEvents(candidateId: string): Promise<ReviewEvent[]> {
    this.eventCalls.push(candidateId)
    return []
  }

  private ok(row: CandidateRow): ReviewOutcome {
    return { ok: true, row }
  }

  async review(input: {
    id: string
    decision: ReviewDecision
    reviewedBy: string
    notes: string | null
    expectedRevision: number
  }): Promise<ReviewOutcome> {
    this.reviewCalls++
    const entry = [...this.rows.entries()].find(([, row]) => row.id === input.id)
    if (entry === undefined) return { ok: false, reason: 'not_found' }
    if (entry[1].promotedSourceId !== null) {
      return { ok: false, reason: 'already_promoted' }
    }
    if (entry[1].revision !== input.expectedRevision) {
      return { ok: false, reason: 'stale' }
    }
    const next: CandidateRow = {
      ...entry[1],
      reviewStatus: input.decision,
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: input.notes,
      revision: entry[1].revision + 1,
    }
    this.rows.set(entry[0], next)
    return this.ok(next)
  }

  async promote(input: {
    id: string
    sourceId: string
    reviewedBy: string
    expectedRevision: number
  }): Promise<ReviewOutcome> {
    this.promoteCalls++
    const entry = [...this.rows.entries()].find(([, row]) => row.id === input.id)
    if (entry === undefined) return { ok: false, reason: 'not_found' }
    if (entry[1].promotedSourceId !== null) {
      return { ok: false, reason: 'already_promoted' }
    }
    if (entry[1].revision !== input.expectedRevision) {
      return { ok: false, reason: 'stale' }
    }
    const next: CandidateRow = {
      ...entry[1],
      promotedSourceId: input.sourceId,
      reviewStatus: 'APPROVED',
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      revision: entry[1].revision + 1,
    }
    this.rows.set(entry[0], next)
    return this.ok(next)
  }
}

/** A provider that returns a fixed list and records the limits it received. */
class FakeProvider implements DiscoveryProvider {
  readonly name: string
  readonly limits: number[] = []
  readonly queries: string[] = []
  constructor(
    private readonly records: DiscoveredRecord[],
    name = 'crossref',
  ) {
    this.name = name
  }

  async search({ query, limit }: { query: string; limit: number }): Promise<DiscoveredRecord[]> {
    this.limits.push(limit)
    this.queries.push(query)
    return this.records.slice(0, limit)
  }
}

/** A minimal discovered record. */
function record(id: string, provider = 'crossref'): DiscoveredRecord {
  return {
    provider,
    providerRecordId: id,
    title: `Title ${id}`,
    authors: null,
    publicationDate: null,
    sourceTypeHint: null,
    doi: null,
    url: null,
    identifiers: [],
    provenance: {
      provider,
      endpoint: '/works',
      query: 'q',
      mailto: null,
      requestedAt: new Date(0).toISOString(),
      rowsRequested: 1,
    },
    query: 'q',
  }
}

function build(records: DiscoveredRecord[]): {
  service: ReturnType<typeof createDiscoveryService>
  store: MemoryStore
  provider: FakeProvider
} {
  const store = new MemoryStore()
  const provider = new FakeProvider(records)
  const service = createDiscoveryService({ providers: [provider], store })
  return { service, store, provider }
}

describe('DiscoveryService.discover', () => {
  it('ingests records and reports created vs updated', async () => {
    const { service, store } = build([record('a'), record('b')])

    const first = await service.discover({ provider: 'crossref', query: 'q' })
    assert.deepEqual(first, {
      provider: 'crossref',
      query: 'q',
      retrieved: 2,
      created: 2,
      updated: 0,
    })
    assert.equal(store.rows.size, 2)

    const second = await service.discover({ provider: 'crossref', query: 'q' })
    assert.equal(second.created, 0)
    assert.equal(second.updated, 2)
    assert.equal(store.rows.size, 2)
  })

  it('never reviews or promotes while ingesting', async () => {
    const { service, store } = build([record('a')])
    await service.discover({ provider: 'crossref', query: 'q' })
    assert.equal(store.reviewCalls, 0)
    assert.equal(store.promoteCalls, 0)
  })

  it('clamps the limit into [1, DISCOVERY_LIMIT_MAX]', async () => {
    const { service, provider } = build([record('a')])
    await service.discover({ provider: 'crossref', query: 'q', limit: 10_000 })
    assert.equal(provider.limits[0], DISCOVERY_LIMIT_MAX)

    await service.discover({ provider: 'crossref', query: 'q', limit: 0 })
    assert.equal(provider.limits[1], 1)
  })

  it('rejects an unknown provider', async () => {
    const { service } = build([record('a')])
    await assert.rejects(
      service.discover({ provider: 'nope', query: 'q' }),
      (error: unknown) => error instanceof DiscoveryQueryError && error.status === 400,
    )
  })

  it('routes to the named provider when more than one is registered', async () => {
    const store = new MemoryStore()
    const crossref = new FakeProvider([record('a')], 'crossref')
    const datacite = new FakeProvider([record('b', 'datacite')], 'datacite')
    const service = createDiscoveryService({
      providers: [crossref, datacite],
      store,
    })

    const result = await service.discover({ provider: 'datacite', query: 'q' })

    assert.equal(result.provider, 'datacite')
    assert.equal(crossref.queries.length, 0, 'the unaddressed provider must not be called')
    assert.equal(datacite.queries.length, 1)
  })

  it('rejects an empty query before contacting a provider', async () => {
    const { service, provider } = build([record('a')])
    await assert.rejects(
      service.discover({ provider: 'crossref', query: '   ' }),
      (error: unknown) => error instanceof DiscoveryQueryError,
    )
    assert.equal(provider.limits.length, 0)
  })
})

describe('DiscoveryService review workflow', () => {
  it('delegates list, review, and promote to the store', async () => {
    const { service, store } = build([record('a')])
    await service.discover({ provider: 'crossref', query: 'q' })

    const listed = await service.listCandidates({ limit: 10, offset: 0 })
    assert.equal(listed.items.length, 1)

    const id = listed.items[0]!.id
    const reviewed = await service.review({
      id,
      decision: 'DEFERRED',
      reviewedBy: 'admin-1',
      notes: 'need a second look',
      expectedRevision: listed.items[0]!.revision,
    })
    assert.equal(reviewed.ok, true)
    assert.equal(store.rows.get('crossref\u0000a')!.reviewStatus, 'DEFERRED')

    const promoted = await service.promote({
      id,
      sourceId: '00000000-0000-0000-0000-000000000000',
      reviewedBy: 'admin-1',
      expectedRevision: store.rows.get('crossref\u0000a')!.revision,
    })
    assert.equal(promoted.ok, true)
    assert.equal(
      store.rows.get('crossref\u0000a')!.promotedSourceId,
      '00000000-0000-0000-0000-000000000000',
    )

    const again = await service.review({
      id,
      decision: 'REJECTED',
      reviewedBy: 'admin-1',
      notes: null,
      expectedRevision: store.rows.get('crossref\u0000a')!.revision,
    })
    assert.deepEqual(again, { ok: false, reason: 'already_promoted' })
  })

  it('delegates event history reads to the store', async () => {
    const { service, store } = build([record('a')])
    await service.discover({ provider: 'crossref', query: 'q' })
    const listed = await service.listCandidates({ limit: 10, offset: 0 })
    const id = listed.items[0]!.id

    await service.listEvents(id)
    assert.deepEqual(store.eventCalls, [id])
  })
})
