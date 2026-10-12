import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import express from 'express'

import {
  DiscoveryQueryError,
  type DiscoverInput,
  type DiscoveryServicePort,
} from '../../trope-cards/src/discovery/service.js'
import {
  type CandidateListFilter,
  type CandidateRow,
  type ReviewDecision,
  type ReviewEvent,
  type ReviewOutcome,
} from '../../trope-cards/src/discovery/store.js'
import { DiscoveryProviderError } from '../../trope-cards/src/discovery/types.js'
import { createDiscoveryRouter } from './discovery.js'

/**
 * The discovery router, over real HTTP, with the service faked.
 *
 * These tests prove the router's contract, not the discovery logic: every route is
 * admin-gated, a caller error is a 400, a provider failure is a 502, and a review/promotion
 * refusal maps to the right status. Persistence and provider behaviour are covered by the
 * subsystem's own suites.
 */

/** One candidate row, enough to serialise. */
function candidateRow(id = '11111111-1111-1111-1111-111111111111'): CandidateRow {
  return {
    id,
    provider: 'crossref',
    providerRecordId: '10.1371/journal.pone.0197326',
    title: 'A Study of Things',
    authors: 'Doe, Jane',
    publicationDate: '2018-05-24',
    sourceTypeHint: 'ACADEMIC',
    doi: '10.1371/journal.pone.0197326',
    url: 'https://doi.org/10.1371/journal.pone.0197326',
    identifiers: [],
    provenance: { provider: 'crossref' },
    query: 'study',
    retrievedAt: new Date('2026-10-12T00:00:00.000Z'),
    reviewStatus: 'CANDIDATE',
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    promotedSourceId: null,
    createdAt: new Date('2026-10-12T00:00:00.000Z'),
  }
}

/** A scripted {@link DiscoveryServicePort} that records what it was asked. */
class FakeService implements DiscoveryServicePort {
  discoverCalls: DiscoverInput[] = []
  listCalls: CandidateListFilter[] = []
  reviewCalls: unknown[] = []
  promoteCalls: unknown[] = []
  listEventsCalls: string[] = []
  discoverError: unknown
  reviewOutcome: ReviewOutcome = { ok: true, row: candidateRow() }
  promoteOutcome: ReviewOutcome = { ok: true, row: candidateRow() }
  listResult = { items: [candidateRow()], total: 1 }
  eventsResult: ReviewEvent[] = []

  async discover(input: DiscoverInput) {
    this.discoverCalls.push(input)
    if (this.discoverError) throw this.discoverError
    return { provider: 'crossref', query: input.query, retrieved: 1, created: 1, updated: 0 }
  }

  async listCandidates(filter: CandidateListFilter) {
    this.listCalls.push(filter)
    return this.listResult
  }

  async listEvents(candidateId: string) {
    this.listEventsCalls.push(candidateId)
    return this.eventsResult
  }

  async review(input: {
    id: string
    decision: ReviewDecision
    reviewedBy: string
    notes: string | null
  }) {
    this.reviewCalls.push(input)
    return this.reviewOutcome
  }

  async promote(input: { id: string; sourceId: string; reviewedBy: string }) {
    this.promoteCalls.push(input)
    return this.promoteOutcome
  }
}

type Harness = {
  request: (
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<{ status: number; body: unknown; text: string }>
}

async function withServer(
  options: { role?: string | null; service?: DiscoveryServicePort },
  fn: (harness: Harness) => Promise<void>,
): Promise<void> {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/discovery',
    createDiscoveryRouter({
      service: options.service ?? new FakeService(),
      getSession: async () =>
        options.role == null ? null : { userId: 'user-1', role: options.role },
    }),
  )

  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo

  try {
    await fn({
      async request(method, path, body) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: body === undefined ? undefined : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await response.text()
        return {
          status: response.status,
          text,
          body: text.length > 0 ? (JSON.parse(text) as unknown) : null,
        }
      },
    })
  } finally {
    server.close()
  }
}

describe('discovery router admin gate', () => {
  it('401s a signed-out caller on every route', async () => {
    const service = new FakeService()
    await withServer({ role: null, service }, async ({ request }) => {
      assert.equal((await request('GET', '/api/discovery/candidates')).status, 401)
      assert.equal(
        (await request('GET', '/api/discovery/candidates/11111111-1111-1111-1111-111111111111/events'))
          .status,
        401,
      )
      assert.equal(
        (await request('POST', '/api/discovery/search', { provider: 'crossref', query: 'q' }))
          .status,
        401,
      )
      assert.equal(service.discoverCalls.length, 0)
    })
  })

  it('403s a signed-in non-admin', async () => {
    const service = new FakeService()
    await withServer({ role: 'VERIFIED', service }, async ({ request }) => {
      assert.equal((await request('GET', '/api/discovery/candidates')).status, 403)
      assert.equal(service.listCalls.length, 0)
    })
  })
})

describe('GET /api/discovery/candidates', () => {
  it('lists candidates and forwards the parsed filter', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('GET', '/api/discovery/candidates?status=DEFERRED&provider=crossref&limit=5&offset=10')
      assert.equal(response.status, 200)
      assert.deepEqual(service.listCalls[0], {
        status: 'DEFERRED',
        provider: 'crossref',
        limit: 5,
        offset: 10,
      })
    })
  })

  it('400s an unknown status without calling the service', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('GET', '/api/discovery/candidates?status=BOGUS')
      assert.equal(response.status, 400)
      assert.equal(service.listCalls.length, 0)
    })
  })

  it('400s a non-numeric limit', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      assert.equal((await request('GET', '/api/discovery/candidates?limit=abc')).status, 400)
    })
  })
})

describe('GET /api/discovery/candidates/:id/events', () => {
  const id = '11111111-1111-1111-1111-111111111111'

  it('400s a non-uuid id without calling the service', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      assert.equal((await request('GET', '/api/discovery/candidates/nope/events')).status, 400)
      assert.equal(service.listEventsCalls.length, 0)
    })
  })

  it('returns the append-only history for a candidate', async () => {
    const service = new FakeService()
    service.eventsResult = [
      {
        id: '33333333-3333-3333-3333-333333333333',
        candidateId: id,
        action: 'REVIEWED',
        decision: 'DEFERRED',
        actorId: 'user-1',
        sourceId: null,
        notes: 'second look',
        createdAt: new Date('2026-10-12T00:00:00.000Z'),
      },
    ]
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('GET', `/api/discovery/candidates/${id}/events`)
      assert.equal(response.status, 200)
      assert.deepEqual(service.listEventsCalls, [id])
      assert.deepEqual(response.body, {
        events: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            candidateId: id,
            action: 'REVIEWED',
            decision: 'DEFERRED',
            actorId: 'user-1',
            sourceId: null,
            notes: 'second look',
            createdAt: '2026-10-12T00:00:00.000Z',
          },
        ],
      })
    })
  })
})

describe('POST /api/discovery/search', () => {
  it('ingests and returns counts', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('POST', '/api/discovery/search', {
        provider: 'crossref',
        query: 'study',
        limit: 3,
      })
      assert.equal(response.status, 201)
      assert.deepEqual(service.discoverCalls[0], {
        provider: 'crossref',
        query: 'study',
        limit: 3,
      })
    })
  })

  it('400s a body that is not exactly the accepted shape', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('POST', '/api/discovery/search', {
        provider: 'crossref',
        query: 'study',
        unexpected: true,
      })
      assert.equal(response.status, 400)
      assert.equal(service.discoverCalls.length, 0)
    })
  })

  it('maps a provider failure to 502', async () => {
    const service = new FakeService()
    service.discoverError = new DiscoveryProviderError('crossref', 'timeout', 'timed out')
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('POST', '/api/discovery/search', {
        provider: 'crossref',
        query: 'study',
      })
      assert.equal(response.status, 502)
    })
  })

  it('maps a caller error to 400', async () => {
    const service = new FakeService()
    service.discoverError = new DiscoveryQueryError(400, 'unknown provider')
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('POST', '/api/discovery/search', {
        provider: 'nope',
        query: 'study',
      })
      assert.equal(response.status, 400)
    })
  })
})

describe('POST /api/discovery/candidates/:id/review', () => {
  const id = '11111111-1111-1111-1111-111111111111'

  it('400s a non-uuid id', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      assert.equal(
        (await request('POST', '/api/discovery/candidates/nope/review', { decision: 'APPROVED' }))
          .status,
        400,
      )
    })
  })

  it('400s an invalid decision', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('POST', `/api/discovery/candidates/${id}/review`, {
        decision: 'MAYBE',
      })
      assert.equal(response.status, 400)
    })
  })

  it('404s an unknown candidate', async () => {
    const service = new FakeService()
    service.reviewOutcome = { ok: false, reason: 'not_found' }
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      assert.equal(
        (await request('POST', `/api/discovery/candidates/${id}/review`, { decision: 'DEFERRED' }))
          .status,
        404,
      )
    })
  })

  it('409s a candidate that was already promoted', async () => {
    const service = new FakeService()
    service.reviewOutcome = { ok: false, reason: 'already_promoted' }
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      assert.equal(
        (await request('POST', `/api/discovery/candidates/${id}/review`, { decision: 'REJECTED' }))
          .status,
        409,
      )
    })
  })

  it('200s a recorded decision', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('POST', `/api/discovery/candidates/${id}/review`, {
        decision: 'DEFERRED',
        notes: 'second look',
      })
      assert.equal(response.status, 200)
      assert.deepEqual(service.reviewCalls[0], {
        id,
        decision: 'DEFERRED',
        reviewedBy: 'user-1',
        notes: 'second look',
      })
    })
  })
})

describe('POST /api/discovery/candidates/:id/promote', () => {
  const id = '11111111-1111-1111-1111-111111111111'
  const sourceId = '22222222-2222-2222-2222-222222222222'

  it('400s a non-uuid source id', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      assert.equal(
        (await request('POST', `/api/discovery/candidates/${id}/promote`, { sourceId: 'nope' }))
          .status,
        400,
      )
    })
  })

  it('400s a source that does not exist', async () => {
    const service = new FakeService()
    service.promoteOutcome = { ok: false, reason: 'source_not_found' }
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      assert.equal(
        (await request('POST', `/api/discovery/candidates/${id}/promote`, { sourceId })).status,
        400,
      )
    })
  })

  it('200s an explicit promotion', async () => {
    const service = new FakeService()
    await withServer({ role: 'ADMIN', service }, async ({ request }) => {
      const response = await request('POST', `/api/discovery/candidates/${id}/promote`, {
        sourceId,
      })
      assert.equal(response.status, 200)
      assert.deepEqual(service.promoteCalls[0], { id, sourceId, reviewedBy: 'user-1' })
    })
  })
})
