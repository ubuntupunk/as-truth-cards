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
import { BUY_ME_A_COFFEE_URL, FOOTER_LINKS, REPO_URL } from './Footer'

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

  it('points the source link at the real GitHub repository', () => {
    assert.equal(REPO_URL, 'https://github.com/ubuntupunk/as-truth-cards')
    assert.ok(
      REPO_URL.startsWith('https://github.com/'),
      'the source link must be an https GitHub URL',
    )
  })

  it('points the coffee link at a Buy Me a Coffee page', () => {
    assert.equal(BUY_ME_A_COFFEE_URL, 'https://www.buymeacoffee.com/ubuntupunk')
    assert.ok(
      BUY_ME_A_COFFEE_URL.startsWith('https://www.buymeacoffee.com/'),
      'the coffee link must be an https Buy Me a Coffee URL',
    )
  })
})
