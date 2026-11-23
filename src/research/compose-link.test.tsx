/**
 * Tests for the research-session → Compose deep link.
 *
 * Only a card entry with a real corpus slug can be composed. Every other focus must
 * produce no link at all, and the return context must be safe and encoded.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { composeHrefForEntry } from './compose-link'
import type { ResearchEntry } from './research-session'

/** A focused card with a slug. */
const CARD: ResearchEntry = {
  id: 'uuid-1',
  type: 'card',
  label: 'A card',
  view: null,
  depth: null,
  slug: 'id-01',
  addedAt: 0,
}

describe('composeHrefForEntry', () => {
  it('links a card to Compose with its slug and encoded return context', () => {
    const href = composeHrefForEntry(CARD, '/research?focus=uuid-1')
    assert.equal(
      href,
      '/research/compose?card=id-01&returnTo=%2Fresearch%3Ffocus%3Duuid-1',
    )
  })

  it('does not link a non-card focus', () => {
    assert.equal(
      composeHrefForEntry({ ...CARD, type: 'source' }, '/research'),
      null,
    )
  })

  it('does not link a card whose slug is unknown', () => {
    assert.equal(
      composeHrefForEntry({ ...CARD, slug: undefined }, '/research'),
      null,
    )
    assert.equal(composeHrefForEntry({ ...CARD, slug: '' }, '/research'), null)
  })

  it('falls back to the research index when the return value is unsafe', () => {
    assert.equal(
      composeHrefForEntry(CARD, 'https://evil.example/'),
      '/research/compose?card=id-01&returnTo=%2Fresearch',
    )
  })
})
