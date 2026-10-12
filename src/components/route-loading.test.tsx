/**
 * Tests for `route-loading.tsx` — the router's `Suspense` fallback.
 *
 * Pure (props → string), so `preact-render-to-string` covers it under Node.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { RouteLoading } from './route-loading'

describe('RouteLoading', () => {
  it('announces itself as a polite live status region', () => {
    const html = render(<RouteLoading />)
    assert.ok(html.includes('role="status"'))
    assert.ok(html.includes('aria-live="polite"'))
    assert.ok(html.includes('data-testid="route-loading"'))
  })

  it('shows a spinner and the default label', () => {
    const html = render(<RouteLoading />)
    assert.ok(html.includes('animate-spin'))
    assert.ok(html.includes('Loading…'))
  })

  it('accepts a route-specific label', () => {
    const html = render(<RouteLoading labelled="Loading the deck…" />)
    assert.ok(html.includes('Loading the deck…'))
  })
})
