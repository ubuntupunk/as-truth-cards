import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import express from 'express'

import {
  createAccountRouter,
  type OnboardingState,
  type OnboardingStore,
} from './account.js'

/**
 * The onboarding-state API, over real HTTP.
 *
 * The contract that matters is the wire contract and the persistence semantics:
 * `401` when signed out, `{ onboardedAt }` as the envelope, and — the point of the
 * feature — completion that is set once and read back. The store and session
 * resolver are fakes, so a failure here is a route bug, never a flaky database.
 */

/** An in-memory {@link OnboardingStore} with set-once semantics, like Prisma's. */
class MemoryOnboardingStore implements OnboardingStore {
  private readonly rows = new Map<string, string>()

  async read(userId: string): Promise<OnboardingState> {
    return { onboardedAt: this.rows.get(userId) ?? null }
  }

  async markComplete(userId: string, at: Date): Promise<OnboardingState> {
    if (!this.rows.has(userId)) this.rows.set(userId, at.toISOString())
    return this.read(userId)
  }
}

interface Harness {
  base: string
  request(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<{ status: number; text: string; body: unknown }>
}

/**
 * Run `fn` against a throwaway Express server hosting the account router.
 *
 * @param options `userId: null` simulates signed out; `store`/`now` are injectable
 *   so tests can observe exactly what the route persisted.
 * @param fn Receives the listening harness.
 */
async function withServer(
  options: {
    userId?: string | null
    store?: OnboardingStore
    now?: () => Date
    trustedOrigins?: readonly string[]
  },
  fn: (harness: Harness) => Promise<void>,
): Promise<void> {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/account',
    createAccountRouter({
      store: options.store ?? new MemoryOnboardingStore(),
      now: options.now,
      trustedOrigins: options.trustedOrigins ?? ['https://app.example.com'],
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
      async request(method, path, body, headers) {
        const requestHeaders: Record<string, string> = { ...headers }
        if (body !== undefined) requestHeaders['content-type'] = 'application/json'
        const response = await fetch(`${base}${path}`, {
          method,
          headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
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

describe('GET /api/account/onboarding', () => {
  it('refuses to read state when signed out', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('GET', '/api/account/onboarding')
      assert.equal(response.status, 401)
    })
  })

  it('reports not-completed as null for a fresh account', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('GET', '/api/account/onboarding')
      assert.equal(response.status, 200)
      assert.deepEqual(response.body, { onboardedAt: null })
    })
  })
})

describe('POST /api/account/onboarding/complete', () => {
  it('refuses to complete when signed out', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('POST', '/api/account/onboarding/complete')
      assert.equal(response.status, 401)
    })
  })

  it('records the server clock and reads the value back', async () => {
    const at = new Date('2026-03-01T12:00:00.000Z')
    await withServer(
      { userId: 'user-1', now: () => at },
      async ({ request }) => {
        const completed = await request(
          'POST',
          '/api/account/onboarding/complete',
        )
        assert.equal(completed.status, 200)
        assert.deepEqual(completed.body, { onboardedAt: at.toISOString() })

        const read = await request('GET', '/api/account/onboarding')
        assert.deepEqual(read.body, { onboardedAt: at.toISOString() })
      },
    )
  })

  it('is set-once: a repeat call preserves the first timestamp', async () => {
    const store = new MemoryOnboardingStore()
    await withServer(
      { userId: 'user-1', store, now: () => new Date('2026-03-01T12:00:00Z') },
      async ({ request }) => {
        const first = await request('POST', '/api/account/onboarding/complete')
        assert.deepEqual(first.body, {
          onboardedAt: '2026-03-01T12:00:00.000Z',
        })
      },
    )
    await withServer(
      { userId: 'user-1', store, now: () => new Date('2026-04-01T00:00:00Z') },
      async ({ request }) => {
        const second = await request('POST', '/api/account/onboarding/complete')
        assert.deepEqual(second.body, {
          onboardedAt: '2026-03-01T12:00:00.000Z',
        })
      },
    )
  })

  it('returns 500 when the store fails', async () => {
    const failing: OnboardingStore = {
      async read() {
        throw new Error('boom')
      },
      async markComplete() {
        throw new Error('boom')
      },
    }
    await withServer(
      { userId: 'user-1', store: failing },
      async ({ request }) => {
        const response = await request('POST', '/api/account/onboarding/complete')
        assert.equal(response.status, 500)
      },
    )
  })
})

describe('CSRF origin guard', () => {
  it('rejects a state change from an untrusted Origin', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request(
        'POST',
        '/api/account/onboarding/complete',
        undefined,
        { origin: 'https://evil.example' },
      )
      assert.equal(response.status, 403)
      assert.deepEqual(response.body, { error: 'Cross-origin request rejected' })
    })
  })

  it('accepts a state change from a trusted Origin', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request(
        'POST',
        '/api/account/onboarding/complete',
        undefined,
        { origin: 'https://app.example.com' },
      )
      assert.equal(response.status, 200)
    })
  })

  it('accepts a state change with no Origin (non-browser client)', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('POST', '/api/account/onboarding/complete')
      assert.equal(response.status, 200)
    })
  })

  it('does not guard a safe method even from an untrusted Origin', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request(
        'GET',
        '/api/account/onboarding',
        undefined,
        { origin: 'https://evil.example' },
      )
      assert.equal(response.status, 200)
    })
  })

  it('rejects before session or store work runs', async () => {
    let storeTouched = false
    const store: OnboardingStore = {
      async read() {
        storeTouched = true
        return { onboardedAt: null }
      },
      async markComplete() {
        storeTouched = true
        return { onboardedAt: new Date().toISOString() }
      },
    }
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      const response = await request(
        'POST',
        '/api/account/onboarding/complete',
        undefined,
        { origin: 'https://evil.example' },
      )
      assert.equal(response.status, 403)
      assert.equal(storeTouched, false)
    })
  })
})
