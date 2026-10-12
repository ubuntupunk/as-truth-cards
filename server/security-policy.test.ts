import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import express from 'express'

import { createApp, DEFAULT_CORS_ORIGINS, resolveCorsOrigins } from './app.js'
import type { AppEnv } from './app.js'

/**
 * The server security policy, over real HTTP.
 *
 * `createApp` is driven through an ephemeral server rather than through the middleware in
 * isolation, because the contract that matters is the wire contract: which browser origins
 * get CORS headers, which are refused, how preflight behaves, and what `req.ip`/`req.secure`
 * resolve to behind a single trusted proxy hop. The environment is injected so these tests
 * do not depend on the host's `.env`.
 *
 * `NODE_ENV: 'test'` keeps the production static-bundle/catch-all branch off the app, so the
 * `/_probe` route added here stays routable.
 */

/** A request helper returning the wire-level status, text, and headers. */
type WireResponse = {
  status: number
  text: string
  headers: Record<string, string>
}

/**
 * Run `fn` against a `createApp()`-built server on an ephemeral port.
 *
 * @param env Environment overrides applied on top of `NODE_ENV: 'test'`.
 * @param fn Receives the base URL and the app instance.
 */
async function withServer(
  env: AppEnv,
  fn: (base: string, app: express.Express) => Promise<void>,
): Promise<void> {
  const app = createApp({ NODE_ENV: 'test', ...env })

  // Probe that exposes the resolved request identity so the trust-proxy behaviour is
  // observable without a database or an authenticated route.
  app.get('/_probe', (req, res) => {
    res.json({ ip: req.ip, secure: req.secure, protocol: req.protocol })
  })

  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  try {
    await fn(base, app)
  } finally {
    server.close()
  }
}

/** Perform a request and normalise the response for assertions. */
async function request(
  base: string,
  method: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<WireResponse> {
  const response = await fetch(`${base}${path}`, { method, headers })
  const text = await response.text()
  const flat: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    flat[key.toLowerCase()] = value
  })
  return { status: response.status, text, headers: flat }
}

describe('resolveCorsOrigins', () => {
  it('defaults to the known development origins', () => {
    assert.deepEqual(resolveCorsOrigins({ NODE_ENV: 'test' }), [...DEFAULT_CORS_ORIGINS])
  })

  it('adds BETTER_AUTH_URL as an allowed origin in production', () => {
    const origins = resolveCorsOrigins({
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://as-truth-cards.onrender.com',
    })
    assert.ok(origins.includes('https://as-truth-cards.onrender.com'))
    assert.ok(origins.includes('http://localhost:8080'))
  })

  it('strips a trailing slash from the production origin', () => {
    const origins = resolveCorsOrigins({
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://as-truth-cards.onrender.com/',
    })
    assert.ok(origins.includes('https://as-truth-cards.onrender.com'))
  })

  it('lets CORS_ORIGINS fully override the default list', () => {
    assert.deepEqual(
      resolveCorsOrigins({
        CORS_ORIGINS: ' https://app.example.com, , https://app.example.com ',
      }),
      ['https://app.example.com'],
    )
  })

  it('ignores a wildcard-minded blank CORS_ORIGINS', () => {
    assert.deepEqual(resolveCorsOrigins({ CORS_ORIGINS: '   ' }), [...DEFAULT_CORS_ORIGINS])
  })
})

describe('CORS policy', () => {
  it('serves a non-browser request (no Origin) without CORS headers', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'GET', '/health')
      assert.equal(response.status, 200)
      assert.equal(response.headers['access-control-allow-origin'], undefined)
      assert.equal(response.headers['access-control-allow-credentials'], undefined)
    })
  })

  it('echoes a known development origin with credentials', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'GET', '/health', {
        origin: 'http://localhost:8080',
      })
      assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:8080')
      assert.equal(response.headers['access-control-allow-credentials'], 'true')
    })
  })

  it('answers a disallowed origin without any CORS header', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'GET', '/health', {
        origin: 'https://evil.example',
      })
      assert.equal(response.status, 200)
      assert.equal(response.headers['access-control-allow-origin'], undefined)
      assert.equal(response.headers['access-control-allow-credentials'], undefined)
    })
  })

  it('accepts preflight from an allowed origin', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'OPTIONS', '/api/graph', {
        origin: 'http://localhost:8080',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      })
      assert.equal(response.status, 204)
      assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:8080')
      assert.ok(response.headers['access-control-allow-methods']?.includes('GET'))
      assert.ok(response.headers['access-control-allow-headers']?.includes('content-type'))
    })
  })

  it('refuses preflight from a disallowed origin', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'OPTIONS', '/api/graph', {
        origin: 'https://evil.example',
        'access-control-request-method': 'GET',
      })
      assert.equal(response.headers['access-control-allow-origin'], undefined)
    })
  })

  it('honours a CORS_ORIGINS override in both directions', async () => {
    await withServer({ CORS_ORIGINS: 'https://app.example.com' }, async (base) => {
      const allowed = await request(base, 'GET', '/health', {
        origin: 'https://app.example.com',
      })
      assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.example.com')

      const denied = await request(base, 'GET', '/health', {
        origin: 'http://localhost:8080',
      })
      assert.equal(denied.headers['access-control-allow-origin'], undefined)
    })
  })
})

describe('trust proxy', () => {
  it('resolves req.ip from X-Forwarded-For across one trusted hop', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'GET', '/_probe', {
        'x-forwarded-for': '203.0.113.7',
      })
      const body = JSON.parse(response.text) as { ip: string }
      assert.equal(body.ip, '203.0.113.7')
    })
  })

  it('resolves req.secure from X-Forwarded-Proto', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'GET', '/_probe', {
        'x-forwarded-proto': 'https',
      })
      const body = JSON.parse(response.text) as {
        secure: boolean
        protocol: string
      }
      assert.equal(body.secure, true)
      assert.equal(body.protocol, 'https')
    })
  })

  it('falls back to the socket address with no proxy headers', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'GET', '/_probe')
      const body = JSON.parse(response.text) as { ip: string; secure: boolean }
      assert.equal(body.secure, false)
      assert.notEqual(body.ip, '203.0.113.7')
      assert.ok(
        body.ip === '::1' ||
          body.ip.includes('127.0.0.1') ||
          body.ip.includes('::ffff:127'),
        `expected a loopback address, got ${body.ip}`,
      )
    })
  })
})

describe('GET /health', () => {
  it('returns the liveness payload for any caller', async () => {
    await withServer({}, async (base) => {
      const response = await request(base, 'GET', '/health')
      assert.equal(response.status, 200)
      assert.equal(response.text, '{"status":"ok"}')
    })
  })
})