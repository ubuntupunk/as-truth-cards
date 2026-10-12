import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import express from 'express'

import {
  type CardInput,
  createCardsRouter,
  type HostCardStore,
  type StoredCard,
} from './cards.js'

/**
 * The cards API, over real HTTP.
 *
 * Two contracts matter here and they pull in opposite directions. Reads are public — the
 * deck and graph browse cards signed-out — so `GET` must stay open. Writes mutate the
 * canonical table the whole deck is built from, so `POST`/`PUT`/`DELETE` must be admin-only:
 * signed-out gets 401, a signed-in non-admin gets 403. Persistence is a fake, so a failure
 * is a route bug, never a flaky database.
 */

/** An in-memory {@link HostCardStore}, id-incrementing like the real sequence. */
class MemoryCardStore implements HostCardStore {
  private nextId = 1
  readonly rows = new Map<number, StoredCard>()

  /** Seed one card so the read routes have something to return. */
  seed(partial: Partial<StoredCard> = {}): StoredCard {
    const id = partial.id ?? this.nextId++
    const row: StoredCard = {
      id,
      createdAt: partial.createdAt ?? new Date(),
      title: partial.title ?? 'Seeded card',
      frontDescription: partial.frontDescription ?? 'front',
      backDescription: partial.backDescription ?? 'back',
      symbol: partial.symbol ?? '🔄',
      imageUrl: partial.imageUrl ?? null,
      tags: partial.tags ?? [],
      includedInPalestineStack: partial.includedInPalestineStack ?? false,
      isFeatured: partial.isFeatured ?? false,
      sources: partial.sources ?? null,
    }
    this.rows.set(id, row)
    return row
  }

  async listAll(): Promise<StoredCard[]> {
    return [...this.rows.values()]
  }

  async getById(id: number): Promise<StoredCard | null> {
    return this.rows.get(id) ?? null
  }

  async create(input: CardInput): Promise<StoredCard> {
    return this.seed({
      title: input.title,
      frontDescription: input.frontDescription,
      backDescription: input.backDescription,
      symbol: input.symbol,
      imageUrl: input.imageUrl ?? null,
      tags: input.tags ?? [],
      includedInPalestineStack: input.includedInPalestineStack ?? false,
      isFeatured: input.isFeatured ?? false,
      sources: input.sources ?? null,
    })
  }

  async update(id: number, input: Partial<CardInput>): Promise<StoredCard> {
    const current = this.rows.get(id)
    if (!current) throw new Error('not found')
    const next: StoredCard = {
      ...current,
      ...(input.title !== undefined && { title: input.title }),
      ...(input.frontDescription !== undefined && {
        frontDescription: input.frontDescription,
      }),
      ...(input.backDescription !== undefined && {
        backDescription: input.backDescription,
      }),
      ...(input.symbol !== undefined && { symbol: input.symbol }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.includedInPalestineStack !== undefined && {
        includedInPalestineStack: input.includedInPalestineStack,
      }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
      ...(input.sources !== undefined && { sources: input.sources }),
    }
    this.rows.set(id, next)
    return next
  }

  async remove(id: number): Promise<void> {
    this.rows.delete(id)
  }
}

function validCard(): CardInput {
  return {
    title: 'New trope card',
    frontDescription: 'front',
    backDescription: 'back',
    symbol: '🔄',
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
 * Run `fn` against a cards router mounted on an ephemeral server.
 *
 * @param options Session role (or none) and a fake store.
 * @param fn Receives the base URL and a JSON request helper.
 */
async function withServer(
  options: { role?: string | null; store?: HostCardStore },
  fn: (harness: Harness) => Promise<void>,
): Promise<void> {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/cards',
    createCardsRouter({
      store: options.store ?? new MemoryCardStore(),
      getSession: async () =>
        options.role == null ? null : { userId: 'user-1', role: options.role },
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

describe('GET /api/cards', () => {
  it('lists cards to anyone, signed in or not', async () => {
    const store = new MemoryCardStore()
    store.seed({ title: 'A' })
    store.seed({ title: 'B' })
    await withServer({ role: null, store }, async ({ request }) => {
      const response = await request('GET', '/api/cards')
      assert.equal(response.status, 200)
      assert.equal((response.body as StoredCard[]).length, 2)
    })
  })

  it('reads one card by id, and 404s an unknown one', async () => {
    const store = new MemoryCardStore()
    const seeded = store.seed({ title: 'A' })
    await withServer({ role: null, store }, async ({ request }) => {
      const ok = await request('GET', `/api/cards/${seeded.id}`)
      assert.equal(ok.status, 200)
      assert.equal((ok.body as StoredCard).title, 'A')

      const missing = await request('GET', '/api/cards/424242')
      assert.equal(missing.status, 404)
    })
  })

  it('400s a non-numeric id', async () => {
    const store = new MemoryCardStore()
    await withServer({ role: null, store }, async ({ request }) => {
      const response = await request('GET', '/api/cards/not-a-number')
      assert.equal(response.status, 400)
    })
  })
})

describe('POST /api/cards', () => {
  it('refuses to create when signed out', async () => {
    const store = new MemoryCardStore()
    await withServer({ role: null, store }, async ({ request }) => {
      const response = await request('POST', '/api/cards', validCard())
      assert.equal(response.status, 401)
      assert.equal(store.rows.size, 0)
    })
  })

  it('refuses a signed-in non-admin', async () => {
    const store = new MemoryCardStore()
    await withServer({ role: 'VERIFIED', store }, async ({ request }) => {
      const response = await request('POST', '/api/cards', validCard())
      assert.equal(response.status, 403)
      assert.equal(store.rows.size, 0)
    })
  })

  it('creates for an admin', async () => {
    const store = new MemoryCardStore()
    await withServer({ role: 'ADMIN', store }, async ({ request }) => {
      const response = await request('POST', '/api/cards', validCard())
      assert.equal(response.status, 201)
      assert.equal((response.body as StoredCard).title, 'New trope card')
      assert.equal(store.rows.size, 1)
    })
  })
})

describe('PUT /api/cards/:id', () => {
  it('refuses to update when signed out', async () => {
    const store = new MemoryCardStore()
    const seeded = store.seed({ title: 'Original' })
    await withServer({ role: null, store }, async ({ request }) => {
      const response = await request('PUT', `/api/cards/${seeded.id}`, {
        title: 'Changed',
      })
      assert.equal(response.status, 401)
      assert.equal(store.rows.get(seeded.id)?.title, 'Original')
    })
  })

  it('refuses a signed-in non-admin but allows an admin', async () => {
    const store = new MemoryCardStore()
    const seeded = store.seed({ title: 'Original' })

    await withServer({ role: 'RESEARCHER', store }, async ({ request }) => {
      const denied = await request('PUT', `/api/cards/${seeded.id}`, {
        title: 'Changed',
      })
      assert.equal(denied.status, 403)
    })

    await withServer({ role: 'ADMIN', store }, async ({ request }) => {
      const allowed = await request('PUT', `/api/cards/${seeded.id}`, {
        title: 'Changed',
      })
      assert.equal(allowed.status, 200)
      assert.equal((allowed.body as StoredCard).title, 'Changed')
    })
  })
})

describe('DELETE /api/cards/:id', () => {
  it('refuses to delete when signed out', async () => {
    const store = new MemoryCardStore()
    const seeded = store.seed()
    await withServer({ role: null, store }, async ({ request }) => {
      const response = await request('DELETE', `/api/cards/${seeded.id}`)
      assert.equal(response.status, 401)
      assert.equal(store.rows.has(seeded.id), true)
    })
  })

  it('refuses a signed-in non-admin', async () => {
    const store = new MemoryCardStore()
    const seeded = store.seed()
    await withServer({ role: 'MODERATOR', store }, async ({ request }) => {
      const response = await request('DELETE', `/api/cards/${seeded.id}`)
      assert.equal(response.status, 403)
      assert.equal(store.rows.has(seeded.id), true)
    })
  })

  it('deletes for an admin', async () => {
    const store = new MemoryCardStore()
    const seeded = store.seed()
    await withServer({ role: 'ADMIN', store }, async ({ request }) => {
      const response = await request('DELETE', `/api/cards/${seeded.id}`)
      assert.equal(response.status, 204)
      assert.equal(store.rows.has(seeded.id), false)
    })
  })
})