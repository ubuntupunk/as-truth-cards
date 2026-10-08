import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import express from 'express'

import type { CardRow, ClaimRow, TropeGraphReader } from '../../trope-cards/src/graph/reader.js'
import type { DraftPayload } from '../composition/draft-contract.js'
import type { DraftStore, StoredDraft } from '../composition/draft-store.js'
import { createDraftsRouter } from './drafts.js'

/**
 * The draft API, over real HTTP.
 *
 * These tests drive the router through an ephemeral `express` server rather than through
 * service internals, because the contract that matters is the wire contract: status codes
 * (`401` signed out, `404` unknown card, `400` malformed), the `{ draft }` envelope, and the
 * referential rule that a draft may only reason over claims on its own card. Persistence is
 * a fake and the graph is a fake, so a failure here is a route bug, never a flaky database.
 */

const CARD_ID = '99999999-9999-4999-8999-999999999999'
const SLUG = 'anc-hamas-equivalence'
const CLAIM_A = '11111111-1111-4111-8111-111111111111'
const CLAIM_B = '22222222-2222-4222-8222-222222222222'
const CLAIM_C = '33333333-3333-4333-8333-333333333333'
const CLAIM_D = '44444444-4444-4444-8444-444444444444'
const FOREIGN_CLAIM = '55555555-5555-4555-8555-555555555555'

/** A card row good enough for the route, which reads only `id`/`slug`. */
function cardRow(): CardRow {
  return {
    id: CARD_ID,
    slug: SLUG,
    title: 'Hamas covenant equivalence',
    summary: null,
    coreQuestion: null,
    primaryType: 'FACT',
    epistemicStatus: 'CONTESTED',
  }
}

/** A claim row on {@link CARD_ID}. */
function claimRow(id: string, cardId = CARD_ID): ClaimRow {
  return {
    id,
    cardId,
    statement: `claim ${id}`,
    claimType: 'INTERPRETIVE',
    description: null,
    epistemicStatus: 'CONTESTED',
  }
}

/** An in-memory {@link DraftStore}. */
class MemoryDraftStore implements DraftStore {
  private readonly rows = new Map<string, StoredDraft>()

  private key(userId: string, cardSlug: string): string {
    return `${userId}::${cardSlug}`
  }

  async find(userId: string, cardSlug: string): Promise<StoredDraft | null> {
    return this.rows.get(this.key(userId, cardSlug)) ?? null
  }

  async upsert(
    userId: string,
    cardSlug: string,
    payload: DraftPayload,
  ): Promise<StoredDraft> {
    const now = new Date().toISOString()
    const previous = this.rows.get(this.key(userId, cardSlug))
    const row: StoredDraft = {
      cardSlug,
      payload,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }
    this.rows.set(this.key(userId, cardSlug), row)
    return row
  }

  async remove(userId: string, cardSlug: string): Promise<void> {
    this.rows.delete(this.key(userId, cardSlug))
  }
}

/** Only the two lookups the route calls. Cast to the full port at the boundary. */
class FakeGraph {
  constructor(
    private readonly cards: readonly CardRow[],
    private readonly claims: readonly ClaimRow[],
  ) {}

  async findCardByRef(ref: string): Promise<CardRow | undefined> {
    return this.cards.find((card) => card.id === ref || card.slug === ref)
  }

  async findClaimByRef(ref: string): Promise<ClaimRow | undefined> {
    return this.claims.find((claim) => claim.id === ref)
  }
}

/** A structurally valid payload referencing this card's claims. */
function validPayload(): DraftPayload {
  return {
    steps: [
      {
        key: 'step-1',
        label: 'Equivalence asserted',
        description: 'The card reading under test.',
        inferenceType: 'INDUCTIVE',
        epistemicStatus: 'CONTESTED',
        notes: null,
        premises: [{ claimId: CLAIM_A, role: 'PRIMARY', ordinal: 0 }],
        conclusions: [{ claimId: CLAIM_B, ordinal: 0 }],
      },
      {
        key: 'step-2',
        label: 'Equivalence rebutted',
        description: 'The argument against the reading.',
        inferenceType: 'DEDUCTIVE',
        epistemicStatus: 'CONTESTED',
        premises: [
          { claimId: CLAIM_C, role: 'PRIMARY', ordinal: 0 },
          { claimId: CLAIM_D, role: 'COUNTERPREMISE', ordinal: 1 },
        ],
        conclusions: [{ claimId: CLAIM_B, ordinal: 0 }],
      },
    ],
    chains: [
      {
        key: 'chain-1',
        label: 'Reading versus rebuttal',
        description: 'The two steps as an argument.',
        kind: 'EDITORIAL_RECONSTRUCTION',
        epistemicStatus: 'CONTESTED',
        steps: [
          { stepKey: 'step-1', role: 'MAIN', ordinal: 0 },
          { stepKey: 'step-2', role: 'COUNTER', ordinal: 1 },
        ],
      },
    ],
  }
}

/** Everything the fake graph knows by default: four on-card claims and one foreign. */
function defaultGraph(): TropeGraphReader {
  return new FakeGraph(
    [cardRow()],
    [
      claimRow(CLAIM_A),
      claimRow(CLAIM_B),
      claimRow(CLAIM_C),
      claimRow(CLAIM_D),
      claimRow(FOREIGN_CLAIM, '88888888-8888-4888-8888-888888888888'),
    ],
  ) as unknown as TropeGraphReader
}

type Harness = {
  base: string
  request: (
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<{ status: number; body: unknown; text: string }>
}

/**
 * Run `fn` against a drafts router mounted on an ephemeral server.
 *
 * @param options Session behaviour and fake collaborations.
 * @param fn Receives the base URL and a JSON request helper.
 */
async function withServer(
  options: {
    userId?: string | null
    store?: DraftStore
    graph?: TropeGraphReader
  },
  fn: (harness: Harness) => Promise<void>,
): Promise<void> {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/drafts',
    createDraftsRouter({
      store: options.store ?? new MemoryDraftStore(),
      graph: options.graph ?? defaultGraph(),
      getSession: async () =>
        options.userId == null ? null : { userId: options.userId },
    }),
  )

  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    await fn({
      base,
      async request(method, path, body) {
        const response = await fetch(`${base}${path}`, {
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

describe('GET /api/drafts/vocabularies', () => {
  it('serves the ontology vocabulary to anyone, signed in or not', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('GET', '/api/drafts/vocabularies')
      assert.equal(response.status, 200)
      const body = response.body as { vocabularies: Record<string, string[]> }
      assert.ok(body.vocabularies.inferenceTypes.includes('INDUCTIVE'))
      assert.ok(body.vocabularies.premiseRoles.includes('COUNTERPREMISE'))
      assert.ok(body.vocabularies.chainKinds.includes('EDITORIAL_RECONSTRUCTION'))
      assert.ok(body.vocabularies.stepRoles.includes('COUNTER'))
    })
  })
})

describe('GET /api/drafts/:cardSlug', () => {
  it('refuses to read a draft when signed out', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('GET', `/api/drafts/${SLUG}`)
      assert.equal(response.status, 401)
    })
  })

  it('returns null when the user has not authored a draft yet', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('GET', `/api/drafts/${SLUG}`)
      assert.equal(response.status, 200)
      assert.deepEqual(response.body, { draft: null })
    })
  })

  it('404s an unknown card', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('GET', '/api/drafts/not-a-card')
      assert.equal(response.status, 404)
    })
  })
})

describe('PUT /api/drafts/:cardSlug', () => {
  it('refuses to save when signed out', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('PUT', `/api/drafts/${SLUG}`, {
        payload: validPayload(),
      })
      assert.equal(response.status, 401)
    })
  })

  it('404s an unknown card', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('PUT', '/api/drafts/not-a-card', {
        payload: validPayload(),
      })
      assert.equal(response.status, 404)
    })
  })

  it('saves a valid draft and reads it back', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const saved = await request('PUT', `/api/drafts/${SLUG}`, {
        payload: validPayload(),
      })
      assert.equal(saved.status, 200)
      const body = saved.body as { draft: StoredDraft }
      assert.equal(body.draft.cardSlug, SLUG)
      assert.equal(body.draft.payload.steps.length, 2)

      const read = await request('GET', `/api/drafts/${SLUG}`)
      assert.equal(read.status, 200)
      assert.deepEqual(read.body, { draft: body.draft })
    })
  })

  it('rejects a structurally invalid payload with issues', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const payload = validPayload()
      payload.steps[0].premises = []
      const response = await request('PUT', `/api/drafts/${SLUG}`, { payload })
      assert.equal(response.status, 400)
      const body = response.body as { issues: { path: string }[] }
      assert.ok(Array.isArray(body.issues) && body.issues.length > 0)
    })
  })

  it('rejects a draft that references a claim on another card', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const payload = validPayload()
      payload.steps[0].premises = [
        { claimId: FOREIGN_CLAIM, role: 'PRIMARY', ordinal: 0 },
      ]
      const response = await request('PUT', `/api/drafts/${SLUG}`, { payload })
      assert.equal(response.status, 400)
      const body = response.body as { detail: { claims: string[] } }
      assert.deepEqual(body.detail.claims, [FOREIGN_CLAIM])
    })
  })

  it('rejects a draft that references a claim that does not exist', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const payload = validPayload()
      payload.steps[0].conclusions = [
        { claimId: '00000000-0000-4000-8000-000000000000', ordinal: 0 },
      ]
      const response = await request('PUT', `/api/drafts/${SLUG}`, { payload })
      assert.equal(response.status, 400)
    })
  })

  it('overwrites the same user-and-card draft rather than stacking rows', async () => {
    const store = new MemoryDraftStore()
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      await request('PUT', `/api/drafts/${SLUG}`, { payload: validPayload() })
      const second = validPayload()
      second.steps[1].label = 'Edited rebuttal'
      const response = await request('PUT', `/api/drafts/${SLUG}`, {
        payload: second,
      })
      assert.equal(response.status, 200)
      const body = response.body as { draft: StoredDraft }
      assert.equal(body.draft.payload.steps[1].label, 'Edited rebuttal')
    })
  })

  it('keeps one user\u2019s draft invisible to another', async () => {
    const store = new MemoryDraftStore()
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      await request('PUT', `/api/drafts/${SLUG}`, { payload: validPayload() })
    })
    await withServer({ userId: 'user-2', store }, async ({ request }) => {
      const response = await request('GET', `/api/drafts/${SLUG}`)
      assert.deepEqual(response.body, { draft: null })
    })
  })
})

describe('DELETE /api/drafts/:cardSlug', () => {
  it('refuses to delete when signed out', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('DELETE', `/api/drafts/${SLUG}`)
      assert.equal(response.status, 401)
    })
  })

  it('removes a saved draft and is idempotent', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      await request('PUT', `/api/drafts/${SLUG}`, { payload: validPayload() })

      const first = await request('DELETE', `/api/drafts/${SLUG}`)
      assert.equal(first.status, 204)
      assert.equal(first.text, '')

      const second = await request('DELETE', `/api/drafts/${SLUG}`)
      assert.equal(second.status, 204)

      const read = await request('GET', `/api/drafts/${SLUG}`)
      assert.deepEqual(read.body, { draft: null })
    })
  })
})
