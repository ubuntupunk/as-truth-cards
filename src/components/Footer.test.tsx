/**
 * Tests for the site `Footer`'s link contract.
 *
 * The gap this fixes: the footer previously rendered three inert `href="#"`
 * anchors ("Privacy", "Terms", "Resources"), which read as working links while
 * going nowhere. The contract now is that every footer entry names a real route.
 *
 * The footer renders `<Link>`s, which require a router context that this SSR
 * harness does not provide, so the link table itself is the unit under test —
 * it is what `Footer` maps directly to anchors.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FOOTER_LINKS } from './Footer'

describe('Footer links', () => {
  it('points every entry at a real route, never a placeholder', () => {
    for (const link of FOOTER_LINKS) {
      assert.notEqual(link.path, '#', `${link.label} must not be a dead anchor`)
      assert.ok(
        link.path.startsWith('/'),
        `${link.label} must be an in-app route`,
      )
    }
  })

  it('covers the about, policy, and resource destinations', () => {
    const paths = FOOTER_LINKS.map((link) => link.path)
    assert.deepEqual(paths, ['/about', '/privacy', '/terms', '/resources'])
  })
})
