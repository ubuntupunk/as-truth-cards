import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import express from 'express'

import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  createAvatarsRouter,
  publicAvatarUrl,
  sniffImageType,
  type AvatarMimeType,
  type AvatarStore,
  type StoredAvatar,
} from './avatars.js'

/**
 * The profile-photo API, over real HTTP with the same composition `app.ts`
 * uses (`express.json()` in front, the router mounted at `/api/me` and
 * `/api/users`). The store and session resolver are fakes, so a failure here
 * is a route bug, never a flaky database.
 *
 * The wire contract under test is the one the client seam relies on: raw
 * image bytes in, a versioned URL out, ETag-cached public reads back, and a
 * refusal that never sanitizes a file whose magic bytes disagree with its
 * claimed type.
 */

/** Minimal bytes whose magic numbers identify each accepted type. */
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const WEBP_BYTES = Buffer.concat([
  Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x57, 0x45, 0x42, 0x50, 0x00, 0x00]),
])
const NOT_AN_IMAGE = Buffer.from('certainly not an image', 'utf8')

/** The etag the route derives from the stored bytes. */
function etagOf(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/** An in-memory {@link AvatarStore} that also records the user-image writes. */
class MemoryAvatarStore implements AvatarStore {
  private readonly rows = new Map<string, StoredAvatar>()
  /** The `user.image` writes the route made, in order, for assertions. */
  readonly userImages: { userId: string; image: string | null }[] = []

  async save(userId: string, mimeType: AvatarMimeType, data: Uint8Array) {
    const stored: StoredAvatar = { mimeType, data, etag: etagOf(data) }
    this.rows.set(userId, stored)
    return stored
  }

  async read(userId: string): Promise<StoredAvatar | null> {
    return this.rows.get(userId) ?? null
  }

  async remove(userId: string): Promise<void> {
    this.rows.delete(userId)
  }

  async setUserImage(userId: string, image: string | null): Promise<void> {
    this.userImages.push({ userId, image })
  }
}

interface Harness {
  base: string
  request(
    method: string,
    path: string,
    options?: {
      body?: Buffer
      contentType?: string
      headers?: Record<string, string>
    },
  ): Promise<{
    status: number
    text: string
    body: unknown
    headers: Record<string, string | string[] | undefined>
    bytes: Buffer
  }>
}

/**
 * Run `fn` against a throwaway Express server hosting the avatars router with
 * the same mounts production uses.
 *
 * @param options `userId: null` simulates signed out; `store` is injectable so
 *   tests observe exactly what the route persisted and wrote to `user.image`.
 * @param fn Receives the listening harness.
 */
async function withServer(
  options: {
    userId?: string | null
    store?: MemoryAvatarStore
    trustedOrigins?: readonly string[]
  },
  fn: (harness: Harness) => Promise<void>,
): Promise<void> {
  const store = options.store ?? new MemoryAvatarStore()
  const app = express()
  app.use(express.json())
  const router = createAvatarsRouter({
    store,
    trustedOrigins: options.trustedOrigins ?? ['https://app.example.com'],
    getSession: async () =>
      options.userId == null ? null : { userId: options.userId },
  })
  app.use('/api/me', router)
  app.use('/api/users', router)

  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    await fn({
      base,
      async request(method, path, reqOptions = {}) {
        const headers: Record<string, string> = { ...reqOptions.headers }
        if (reqOptions.contentType !== undefined) {
          headers['content-type'] = reqOptions.contentType
        }
        const response = await fetch(`${base}${path}`, {
          method,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          body: reqOptions.body,
        })
        const bytes = Buffer.from(await response.arrayBuffer())
        const text = bytes.toString('utf8')
        const collected: Record<string, string | string[] | undefined> = {}
        response.headers.forEach((value, key) => {
          collected[key] = value
        })
        let body: unknown = null
        if (response.headers.get('content-type')?.includes('json')) {
          try {
            body = text.length > 0 ? JSON.parse(text) : null
          } catch {
            body = null
          }
        }
        return { status: response.status, text, body, headers: collected, bytes }
      },
    })
  } finally {
    server.close()
  }
}

describe('sniffImageType', () => {
  it('recognizes the three accepted types and nothing else', () => {
    assert.equal(sniffImageType(PNG_BYTES), 'image/png')
    assert.equal(sniffImageType(JPEG_BYTES), 'image/jpeg')
    assert.equal(sniffImageType(WEBP_BYTES), 'image/webp')
    assert.equal(sniffImageType(NOT_AN_IMAGE), null)
    assert.equal(sniffImageType(new Uint8Array(0)), null)
    // A truncated header must never pass as a type it cannot prove.
    assert.equal(sniffImageType(PNG_BYTES.subarray(0, 7)), null)
  })

  it('mirrors the MIME allowlist the route accepts', () => {
    for (const type of AVATAR_MIME_TYPES) {
      assert.ok(
        type === 'image/png' ||
          type === 'image/jpeg' ||
          type === 'image/webp',
      )
    }
  })
})

describe('publicAvatarUrl', () => {
  it('is the versioned public URL stored in user.image', () => {
    assert.equal(
      publicAvatarUrl('user-1', 'abc123'),
      '/api/users/user-1/avatar?v=abc123',
    )
  })

  it('encodes the user id so an id cannot shape the path', () => {
    assert.ok(publicAvatarUrl('a/b', 'x').startsWith('/api/users/a%2Fb/avatar'))
  })
})

describe('POST /api/me/avatar', () => {
  it('refuses to upload when signed out', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('POST', '/api/me/avatar', {
        body: PNG_BYTES,
        contentType: 'image/png',
      })
      assert.equal(response.status, 401)
    })
  })

  it('rejects a cross-origin upload before any store work', async () => {
    const store = new MemoryAvatarStore()
    await withServer(
      { userId: 'user-1', store },
      async ({ request }) => {
        const response = await request('POST', '/api/me/avatar', {
          body: PNG_BYTES,
          contentType: 'image/png',
          headers: { origin: 'https://evil.example.com' },
        })
        assert.equal(response.status, 403)
        assert.equal(store.userImages.length, 0)
      },
    )
  })

  it('accepts a PNG, stores the sniffed type, and writes the versioned URL', async () => {
    const store = new MemoryAvatarStore()
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      const response = await request('POST', '/api/me/avatar', {
        body: PNG_BYTES,
        contentType: 'image/png',
      })
      assert.equal(response.status, 200)
      const image = (response.body as { image: string }).image
      assert.equal(image, publicAvatarUrl('user-1', etagOf(PNG_BYTES)))
      // The route wrote exactly one user.image, pointing at the avatar route.
      assert.deepEqual(store.userImages, [{ userId: 'user-1', image }])
    })
  })

  it('decides the type from the magic bytes, not the declared header', async () => {
    const store = new MemoryAvatarStore()
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      // PNG bytes declaring themselves as JPEG: the sniff wins, and the store
      // records what the bytes are.
      const response = await request('POST', '/api/me/avatar', {
        body: PNG_BYTES,
        contentType: 'image/jpeg',
      })
      assert.equal(response.status, 200)
      const stored = await store.read('user-1')
      assert.equal(stored?.mimeType, 'image/png')
    })
  })

  it('refuses bytes whose magic numbers are not an accepted image', async () => {
    const store = new MemoryAvatarStore()
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      const response = await request('POST', '/api/me/avatar', {
        body: NOT_AN_IMAGE,
        contentType: 'image/png',
      })
      assert.equal(response.status, 415)
      assert.equal(await store.read('user-1'), null)
      assert.equal(store.userImages.length, 0)
    })
  })

  it('refuses a non-image content type without buffering it', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('POST', '/api/me/avatar', {
        body: Buffer.from('hello'),
        contentType: 'text/plain',
      })
      assert.equal(response.status, 415)
      // A JSON-typed body is consumed by `express.json` before the route (the
      // production composition), so the route sees a parsed object where it
      // requires image bytes and refuses it the same way.
      const jsonTyped = await request('POST', '/api/me/avatar', {
        body: Buffer.from('{}'),
        contentType: 'application/json',
      })
      assert.equal(jsonTyped.status, 415)
    })
  })

  it('refuses an empty image body', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('POST', '/api/me/avatar', {
        body: Buffer.alloc(0),
        contentType: 'image/png',
      })
      assert.equal(response.status, 400)
    })
  })

  it('refuses a body over the size ceiling with the JSON envelope', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const oversized = Buffer.concat([
        PNG_BYTES,
        Buffer.alloc(AVATAR_MAX_BYTES + 1),
      ])
      const response = await request('POST', '/api/me/avatar', {
        body: oversized,
        contentType: 'image/png',
      })
      assert.equal(response.status, 413)
      assert.deepEqual(response.body, {
        error: 'The image must be 512 KB or smaller',
      })
    })
  })
})

describe('GET /api/users/:id/avatar', () => {
  it('answers 404 as JSON for an account with no avatar', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const response = await request('GET', '/api/users/user-2/avatar')
      assert.equal(response.status, 404)
      assert.deepEqual(response.body, { error: 'No avatar for this account' })
    })
  })

  it('serves the stored bytes with their sniffed type and ETag', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      await request('POST', '/api/me/avatar', {
        body: JPEG_BYTES,
        contentType: 'image/jpeg',
      })
      const response = await request('GET', '/api/users/user-1/avatar')
      assert.equal(response.status, 200)
      assert.equal(response.headers['content-type'], 'image/jpeg')
      assert.equal(response.headers.etag, `"${etagOf(JPEG_BYTES)}"`)
      assert.ok(response.bytes.equals(JPEG_BYTES))
    })
  })

  it('revalidates through the ETag with a 304, re-shipping nothing', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      await request('POST', '/api/me/avatar', {
        body: PNG_BYTES,
        contentType: 'image/png',
      })
      const etag = `"${etagOf(PNG_BYTES)}"`
      const response = await request('GET', '/api/users/user-1/avatar', {
        headers: { 'if-none-match': etag },
      })
      assert.equal(response.status, 304)
      assert.equal(response.bytes.length, 0)
      assert.equal(response.headers.etag, etag)
    })
  })

  it('treats the versioned URL as immutable and the bare URL as revalidate', async () => {
    await withServer({ userId: 'user-1' }, async ({ request }) => {
      const upload = await request('POST', '/api/me/avatar', {
        body: PNG_BYTES,
        contentType: 'image/png',
      })
      const versioned = await request(
        'GET',
        (upload.body as { image: string }).image,
      )
      assert.equal(
        versioned.headers['cache-control'],
        'public, max-age=31536000, immutable',
      )
      const bare = await request('GET', '/api/users/user-1/avatar')
      assert.equal(bare.headers['cache-control'], 'no-cache')
    })
  })
})

describe('DELETE /api/me/avatar', () => {
  it('refuses to remove when signed out', async () => {
    await withServer({ userId: null }, async ({ request }) => {
      const response = await request('DELETE', '/api/me/avatar')
      assert.equal(response.status, 401)
    })
  })

  it('removes the bytes, clears user.image, and the read then 404s', async () => {
    const store = new MemoryAvatarStore()
    await withServer({ userId: 'user-1', store }, async ({ request }) => {
      await request('POST', '/api/me/avatar', {
        body: PNG_BYTES,
        contentType: 'image/png',
      })
      const response = await request('DELETE', '/api/me/avatar')
      assert.equal(response.status, 200)
      assert.deepEqual(response.body, { image: null })
      assert.deepEqual(store.userImages.at(-1), {
        userId: 'user-1',
        image: null,
      })
      const read = await request('GET', '/api/users/user-1/avatar')
      assert.equal(read.status, 404)
    })
  })
})
