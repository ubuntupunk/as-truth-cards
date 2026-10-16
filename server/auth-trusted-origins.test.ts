import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * Better Auth must consume the *same* origin policy as CORS and the account
 * guard, otherwise the configuration contract is ambiguous: an origin allowed
 * through `CORS_ORIGINS` would be accepted by CORS and the account-router guard
 * yet silently rejected by Better Auth on `/api/auth/*` state-changing requests.
 *
 * `betterAuth()` reads `trustedOrigins` once at construction, so the environment
 * is configured *before* the module is imported. `node --test` runs each file in
 * its own process, giving this file a clean module registry.
 */
process.env.CORS_ORIGINS = 'https://partner.example.com'
delete process.env.NODE_ENV
delete process.env.BETTER_AUTH_URL

const { auth } = await import('./auth.js')
const { resolveTrustedOrigins } = await import('./lib/origin.js')

/** The narrowed view of the Better Auth instance this test needs. */
const configured = auth as unknown as {
  options?: { trustedOrigins?: string[] }
}

describe('Better Auth trusted origins share the CORS/guard resolver', () => {
  it('is exactly what resolveTrustedOrigins() returns', () => {
    assert.deepEqual(configured.options?.trustedOrigins, resolveTrustedOrigins())
  })

  it('trusts an origin supplied only through CORS_ORIGINS', () => {
    // This is the case the old hard-coded list missed: /api/auth/* now honours
    // the same explicit configuration as the rest of the API.
    assert.ok(
      configured.options?.trustedOrigins?.includes('https://partner.example.com'),
    )
  })

  it('no longer carries a hard-coded development list of its own', () => {
    // With CORS_ORIGINS set, the development defaults must not leak through: the
    // explicit list replaces them (only the production origin is always kept).
    assert.ok(
      !configured.options?.trustedOrigins?.includes('http://localhost:8080'),
    )
  })
})
