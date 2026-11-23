/**
 * Tests for the Compose sign-in handoff.
 *
 * The handoff is the bridge between the 401-derived signed-out state and the sign-in
 * page. It must carry the exact card selection back, and it must never turn a query
 * string into an off-origin redirect.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { composeSignInHref } from './sign-in-return'

describe('composeSignInHref', () => {
  it('preserves the current Compose route and card selection', () => {
    const href = composeSignInHref('/research/compose?card=id-01')
    assert.equal(href, '/sign-in?returnTo=%2Fresearch%2Fcompose%3Fcard%3Did-01')
  })

  it('encodes a research return context nested in the query string', () => {
    const href = composeSignInHref(
      '/research/compose?card=id-01&returnTo=%2Fresearch%3Ffocus%3Duuid-1',
    )
    assert.equal(
      new URL(href, 'https://example.test').searchParams.get('returnTo'),
      '/research/compose?card=id-01&returnTo=%2Fresearch%3Ffocus%3Duuid-1',
    )
  })

  it('falls back to Compose when the current location is unusable', () => {
    assert.equal(
      composeSignInHref('//evil.example/steal'),
      '/sign-in?returnTo=%2Fresearch%2Fcompose',
    )
  })
})
