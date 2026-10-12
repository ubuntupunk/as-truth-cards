import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import express from 'express'

import {
  type CardPresence,
  createInteractionsRouter,
  type InteractionStore,
  type StoredInteraction,
} from './interactions.js'

/**
 * The interactions API, over real HTTP.
 *
 * The contract under test is issue #11's: participation is the card's activity log, and the
 * actor on a stored row is whatever the *validated session* said — never whatever the body
 * claimed. A client that names itself is rejected; a signed-in caller is attributed to their
 * own account; a signed-out caller on an anonymous-allowed type is recorded with no actor.
 * Persistence is a fake, so a failure is a route bug, never a flaky database.
 */

/** An in-memory {@link InteractionStore}, id-incrementing like the real sequence. */
class MemoryInteractionStore implements InteractionStore {
  private nextId = 1
  readonly rows: StoredInteraction[] = []

  async create(
    input: Parameters<InteractionStore['create']>[0],
  ): Promise<StoredInteraction> {
    const row: StoredInteraction = {
      id: this.nextId++,
      cardId: input.cardId,
      userId: input.userId,
      interactionType: input.interactionType,
      feedbackRating: input.feedbackRating,
      feedbackText: input.feedbackText,
      ipAddress: null,
      createdAt: new Date(),
    }
    this.rows.push(row)
    return row
  }

  async listByCard(cardId: number): Promise<StoredInteraction[]> {
    return this.rows.filter((row) => row.cardId === cardId)
  }
}

/** Card presence as a fixed set of ids. */
class FakeCardPresence implements CardPresence {
  constructor(private readonly ids: readonly number[]) {}

  async exists(cardId: number): Promise<boolean> {
    return this.ids.includes(cardId)
  }
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
 * Run `fn` against an interactions router mounted on an ephemeral server.
 *
 * @param options Session behaviour and fake collaborations.
 * @param fn Receives the base URL and a JSON request helper.
 */
async function withServer(
  options: {
    userId?: string | null
    store?: InteractionStore
    presence?: CardPresence
  },
  fn: (harness: Harness) => Promise<void>,
): Promise<void> {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/interactions',
    createInteractionsRouter({
      store: options.store ?? new MemoryInteractionStore(),
      presence: options.presence ?? new FakeCardPresence([1, 2]),
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

describe('POST /api/interactions', () => {
  it('records an anonymous view with no actor attached', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: null, store }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'VIEW',
      })
      assert.equal(response.status, 201)
      assert.equal((response.body as StoredInteraction).userId, null)
      assert.equal(store.rows.length, 1)
      assert.equal(store.rows[0].userId, null)
    })
  })

  it('records an anonymous share with no actor attached', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: null, store }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'SHARE',
      })
      assert.equal(response.status, 201)
      assert.equal(store.rows[0].userId, null)
    })
  })

  it('records an anonymous deck vote as anonymous participation', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: null, store }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'RATING_UP',
      })
      assert.equal(response.status, 201)
      assert.equal(store.rows[0].userId, null)
    })
  })

  it('attributes a signed-in interaction to the session user', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'RATING_UP',
      })
      assert.equal(response.status, 201)
      assert.equal((response.body as StoredInteraction).userId, 'user-1')
    })
  })

  it('rejects a body that tries to assert its own actor identity', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: null, store }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'RATING_UP',
        userId: 'victim-user',
      })
      assert.equal(response.status, 400)
      assert.equal(store.rows.length, 0)
    })
  })

  it('rejects an unknown interaction type before any policy is consulted', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: null, store }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'STRUCTURED_FEEDBACK',
      })
      assert.equal(response.status, 400)
      assert.equal(store.rows.length, 0)
    })
  })

  it('rejects a missing card id', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        interactionType: 'VIEW',
      })
      assert.equal(response.status, 400)
    })
  })

  it('404s a card that does not exist', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: null, store }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 999,
        interactionType: 'VIEW',
      })
      assert.equal(response.status, 404)
      assert.equal(store.rows.length, 0)
    })
  })

  it('rejects a feedback rating outside the 1–5 range', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'RATING_UP',
        feedbackRating: 9,
      })
      assert.equal(response.status, 400)
    })
  })

  it('rejects feedback text beyond the length cap', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'RATING_UP',
        feedbackText: 'x'.repeat(2001),
      })
      assert.equal(response.status, 400)
    })
  })
})

describe('GET /api/interactions/card/:cardId', () => {
  it('refuses to read card activity when signed out', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('GET', '/api/interactions/card/1')
      assert.equal(response.status, 401)
    })
  })

  it('returns the card activity when signed in', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: null, store }, async ({ request }) => {
      await request('POST', '/api/interactions', { cardId: 1, interactionType: 'VIEW' })
    })
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      await request('POST', '/api/interactions', {
        cardId: 1,
        interactionType: 'RATING_UP',
      })
    })
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      const response = await request('GET', '/api/interactions/card/1')
      assert.equal(response.status, 200)
      const rows = response.body as StoredInteraction[]
      assert.equal(rows.length, 2)
      assert.deepEqual(
        rows.map((row) => row.userId).sort(),
        [null, 'user-1'].sort(),
      )
    })
  })

  it('returns only the requested card and 400s a non-numeric id', async () => {
    const store = new MemoryInteractionStore()
    await withServer({ userId: null, store }, async ({ request }) => {
      await request('POST', '/api/interactions', { cardId: 1, interactionType: 'VIEW' })
      await request('POST', '/api/interactions', { cardId: 2, interactionType: 'VIEW' })
    })
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      const ok = await request('GET', '/api/interactions/card/1')
      assert.equal(ok.status, 200)
      assert.equal((ok.body as StoredInteraction[]).length, 1)
      assert.equal((ok.body as StoredInteraction[])[0].cardId, 1)

      const bad = await request('GET', '/api/interactions/card/not-a-number')
      assert.equal(bad.status, 400)
    })
  })
})