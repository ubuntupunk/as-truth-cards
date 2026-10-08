/**
 * Tests for `result-card.tsx` — one Explore result tile.
 *
 * Two shapes, two honesty rules. A loaded row must carry the research-status
 * badge (text, never colour alone) and the graph's own dimension-prefixed
 * classification chips; a search hit must say out loud that status and
 * classification are not in the payload rather than rendering an empty badge
 * or an invented `unknown`. Both must offer exactly the handoffs that exist
 * today: card detail on the deck and expansion in the graph — no research
 * control before Phase D gives it a boundary.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { CONTESTED_CARD, OPEN_CARD } from '../deck/test-fixtures'
import type { CardSearchResult } from '../graph/projection-guards'
import { ResultCard } from './result-card'

const HIT: CardSearchResult = {
  id: 'hit-1',
  slug: 'never-loaded',
  title: 'A title the index knows',
  summary: 'A summary the index knows.',
  type: 'card',
  rank: 1,
}

describe('ResultCard (loaded row)', () => {
  const html = render(ResultCard({ result: { kind: 'row', card: OPEN_CARD } }))

  it('shows title, summary and the research-status badge as text', () => {
    assert.ok(html.includes('data-testid="explore-result-title"'))
    assert.ok(html.includes('An open question about troop levels'))
    assert.ok(html.includes('data-testid="explore-result-summary"'))
    assert.ok(html.includes('data-testid="card-status-badge"'))
    assert.ok(html.includes('data-status="OPEN"'))
    assert.ok(html.includes('OPEN · UNVERIFIED'))
  })

  it('shows the graph classification chips with their dimensions', () => {
    assert.ok(html.includes('data-dimension="Axis"'))
    assert.ok(html.includes('data-dimension="Suit"'))
    assert.ok(html.includes('Axis'))
    assert.ok(html.includes('Suit'))
  })

  it('links into card detail and into the graph, by slug', () => {
    assert.ok(html.includes('href="/?focus=an-open-question"'))
    assert.ok(html.includes('href="/graph?focus=an-open-question"'))
    assert.ok(html.includes('Read card'))
    assert.ok(html.includes('Explore in graph'))
    assert.ok(html.includes('data-kind="row"'))
  })
})

describe('ResultCard (search hit without a row)', () => {
  const html = render(ResultCard({ result: { kind: 'hit', hit: HIT } }))

  it('renders the indexed fields and marks the shape', () => {
    assert.ok(html.includes('A title the index knows'))
    assert.ok(html.includes('A summary the index knows.'))
    assert.ok(html.includes('data-kind="hit"'))
  })

  it('says status and classification are not in the payload', () => {
    assert.ok(!html.includes('data-testid="card-status-badge"'))
    assert.ok(!html.includes('data-dimension='))
    assert.ok(html.includes('data-testid="explore-result-hit-note"'))
    assert.ok(html.includes('load with the card'))
  })

  it('offers the same handoffs, by slug', () => {
    assert.ok(html.includes('href="/?focus=never-loaded"'))
    assert.ok(html.includes('href="/graph?focus=never-loaded"'))
  })
})

describe('ResultCard (absent summary)', () => {
  it('renders no summary paragraph rather than a placeholder', () => {
    const html = render(
      ResultCard({
        result: { kind: 'row', card: { ...CONTESTED_CARD, summary: null } },
      }),
    )
    assert.ok(!html.includes('data-testid="explore-result-summary"'))
  })
})
