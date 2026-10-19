/**
 * Tests for `not-found-panel.tsx` — the body of the 404 surface.
 *
 * The panel is pure (props → string), so `preact-render-to-string` covers the
 * markup under Node. The routed page itself calls `useLocation` and is only
 * reachable with a router, so the route table's matcher tests (which pin `*` to
 * `NotFound`) remain the coverage for the wiring.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { NotFoundPanel } from './not-found-panel'

describe('NotFoundPanel', () => {
  it('carries the requested copy verbatim', () => {
    const html = render(<NotFoundPanel />)
    assert.ok(html.includes('Oy vey, Oh dear'))
    assert.ok(html.includes("The page you're looking for can't be found."))
  })

  it('shows the deck logo', () => {
    const html = render(<NotFoundPanel />)
    assert.ok(html.includes('src="/fig-2-1.jpg"'))
  })

  it('keeps the status findable next to the copy', () => {
    const html = render(<NotFoundPanel />)
    assert.ok(html.includes('404'))
  })

  it('offers a way back to the deck and on to the explorer', () => {
    const html = render(<NotFoundPanel />)
    assert.ok(html.includes('href="/"'))
    assert.ok(html.includes('Back to the deck'))
    assert.ok(html.includes('href="/explore"'))
  })
})
