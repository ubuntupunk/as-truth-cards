/**
 * Tests for `card-front.tsx` — the focus card's detail panel.
 *
 * The panel is a pure projection of the focus card's own record, so these tests
 * assert the mockup surface with `preact-render-to-string`: the tinted icon
 * block and title, suit badges coloured from the navigator's dot palette, axis
 * pills in canonical order (outline-encoded, never confused with the filled
 * mechanism/concept pills), the description, and the separately-sourced
 * "Mechanisms &amp; concepts" pills resolved through the card's classification
 * edges. A non-card focus renders nothing.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { CardFront } from './card-front'
import {
  CARD_PROJECTION,
  CARD_TWO_NODE,
  FOCUS_CARD_NODE,
} from './test-fixtures'

function renderFront() {
  return render(
    <CardFront projection={CARD_PROJECTION} focusCard={FOCUS_CARD_NODE} />,
  )
}

describe('card-front header', () => {
  const html = renderFront()

  it('renders the tinted icon block and the card title', () => {
    assert.ok(html.includes('data-testid="card-front"'))
    assert.ok(html.includes('data-testid="card-front-icon"'))
    assert.ok(html.includes('Jesus was a Zionist'))
  })

  it('renders a suit badge per suit, tinted with the dot palette', () => {
    assert.ok(html.includes('data-suit="classic"'))
    assert.ok(html.includes('data-suit="south-africa"'))
    assert.ok(html.includes('>Classic<'))
    assert.ok(html.includes('>Regional<'))
    assert.ok(html.includes('#ef44441f'))
    assert.ok(html.includes('#22d3ee1f'))
  })

  it('renders axis pills in canonical order, outline-encoded', () => {
    assert.ok(
      html.indexOf('data-axis="TACTIC"') <
        html.indexOf('data-axis="HISTORICAL"'),
    )
    assert.ok(html.includes('>Tactic<'))
    assert.ok(html.includes('>Historical<'))
    // Outline (border) encoding, distinct from the filled mechanism pills.
    assert.ok(html.includes('rounded-md border border-border'))
  })

  it('shows the summary as the description', () => {
    assert.ok(html.includes('A card about a contested historical claim.'))
  })

  it('resolves mechanism and concept pills through the classification edges', () => {
    assert.ok(html.includes('Mechanisms &amp; concepts'))
    assert.ok(html.includes('data-pill="mechanism"'))
    assert.ok(html.includes('>Recontextualization<'))
    assert.ok(html.includes('data-pill="concept"'))
    assert.ok(html.includes('>Modern recontextualization<'))
  })

  it('keeps mechanism pills sorted before concept pills', () => {
    const section = html.slice(html.indexOf('data-testid="mechanism-concepts"'))
    assert.ok(
      section.indexOf('data-pill="mechanism"') <
        section.indexOf('data-pill="concept"'),
    )
  })
})

describe('card-front minimal card', () => {
  const html = render(
    <CardFront projection={CARD_PROJECTION} focusCard={CARD_TWO_NODE} />,
  )

  it('renders a card with no suits, no description, and no pills section', () => {
    assert.ok(html.includes('The Judean People’s Front'))
    assert.ok(html.includes('data-axis="TACTIC"'))
    assert.ok(!html.includes('data-suit='))
    assert.ok(!html.includes('data-testid="mechanism-concepts"'))
    assert.ok(!html.includes('A card about a contested historical claim.'))
  })
})

describe('card-front focus gating', () => {
  it('renders nothing when the focus is not a card', () => {
    const html = render(
      <CardFront projection={CARD_PROJECTION} focusCard={null} />,
    )
    assert.equal(html, '')
  })

  it('derives pills only from the focus card, never a selection (id-scoped)', () => {
    const html = renderFront()
    // The focus card's named pills, but the panel must not pick up claimOne.
    assert.ok(!html.includes('born in Bethlehem'))
  })

  it('refuses to invent pills when the focus card has no classification edges', () => {
    const html = render(
      <CardFront
        projection={{
          ...CARD_PROJECTION,
          edges: CARD_PROJECTION.edges.filter(
            (edge) => edge.family !== 'classification',
          ),
        }}
        focusCard={FOCUS_CARD_NODE}
      />,
    )
    assert.ok(html.includes('Jesus was a Zionist'))
    assert.ok(!html.includes('Recontextualization'))
    assert.ok(!html.includes('data-testid="mechanism-concepts"'))
  })
})
