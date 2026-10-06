/**
 * Tests for `deck-facets.ts` — the navigator's pure facet model.
 *
 * The facet derivation and the presentation filter are pure data functions, so
 * these tests need no DOM: they build from the real `CARD_PROJECTION` fixture
 * and assert counts, presence flags and the filtered projections directly. The
 * two honesty rules pinned here mirror the mockup's "new" groups:
 *
 * - a Suit/Axis is a *card-level* classification, so filtering by one keeps
 *   only matching cards — it never leaks the facet onto a claim or a step;
 * - a schema-only ontology type (no nodes in the projection) renders as a
 *   disabled facet with count 0, never as a silently no-op filter.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyFacetFilter,
  deriveFacets,
  hasActiveFacets,
  NO_FACET_FILTER,
  nodeMatchesFacets,
} from './deck-facets'
import {
  CARD_PROJECTION,
  EMPTY_PROJECTION,
  ID,
  SPARSE_PROJECTION,
} from './test-fixtures'

describe('deriveFacets ontology-type facets', () => {
  const facets = deriveFacets(CARD_PROJECTION)

  it('lists the fixture ontology types in mockup order with counts', () => {
    const names = facets.types.map((entry) => entry.label)
    assert.deepEqual(names, [
      'Claims',
      'Evidence',
      'Sources',
      'Cases',
      'Concepts',
      'Interpretations',
      'Inferences',
    ])
    const claims = facets.types.find((entry) => entry.type === 'claim')
    const inferences = facets.types.find(
      (entry) => entry.type === 'inference_step',
    )
    assert.equal(claims?.count, 2)
    assert.equal(claims?.present, true)
    assert.equal(inferences?.count, 2)
  })

  it('marks a type with zero nodes as not present, not as a live filter', () => {
    const types = deriveFacets(SPARSE_PROJECTION).types
    const claims = types.find((entry) => entry.type === 'claim')
    assert.equal(claims?.count, 0)
    assert.equal(claims?.present, false)
  })

  it('reports an empty view as all facets absent', () => {
    const facetsOfEmpty = deriveFacets(EMPTY_PROJECTION)
    assert.ok(
      facetsOfEmpty.types.every((entry) => entry.count === 0 && !entry.present),
    )
    assert.deepEqual(facetsOfEmpty.suits, [])
    assert.deepEqual(facetsOfEmpty.axes, [])
  })
})

describe('deriveFacets suit and axis groups', () => {
  const facets = deriveFacets(CARD_PROJECTION)

  it('derives suits from the union of card classifications, with mockup labels', () => {
    assert.deepEqual(facets.suits, [
      { slug: 'classic', label: 'Classic', count: 1 },
      { slug: 'south-africa', label: 'Regional', count: 1 },
    ])
  })

  it('derives axes in canonical card_axis order with human labels', () => {
    // Focus card: TACTIC(0), HISTORICAL(1). Card two: TACTIC(0).
    assert.deepEqual(facets.axes, [
      { axis: 'TACTIC', label: 'Tactic', count: 2 },
      { axis: 'HISTORICAL', label: 'Historical', count: 1 },
    ])
  })

  it('does not derive suits or axes from non-card nodes', () => {
    const sparse = deriveFacets(SPARSE_PROJECTION)
    // The focus card has suits/axes, so absence of others never inflates counts.
    assert.deepEqual(
      sparse.suits.map((entry) => entry.slug),
      ['classic', 'south-africa'],
    )
    assert.deepEqual(
      sparse.axes.map((entry) => entry.axis),
      ['TACTIC', 'HISTORICAL'],
    )
  })
})

describe('applyFacetFilter', () => {
  it('returns the same projection reference when nothing is active', () => {
    assert.strictEqual(
      applyFacetFilter(CARD_PROJECTION, NO_FACET_FILTER),
      CARD_PROJECTION,
    )
  })

  it('filters nodes to one ontology type and prunes dangling edges', () => {
    const filtered = applyFacetFilter(CARD_PROJECTION, {
      type: 'claim',
      suit: null,
      axis: null,
    })
    assert.ok(filtered.nodes.every((node) => node.type === 'claim'))
    assert.equal(filtered.meta.nodeCount, 2)
    // claimOne -> claimTwo survives; the premise/conclusion inference edges
    // touch a step node and are pruned with it.
    assert.equal(filtered.meta.edgeCount, 1)
    assert.equal(filtered.edges[0]?.family, 'claim_relation')
  })

  it('keeps only matching cards under a suit filter (card-level facet)', () => {
    const filtered = applyFacetFilter(CARD_PROJECTION, {
      type: null,
      suit: 'south-africa',
      axis: null,
    })
    assert.deepEqual(
      filtered.nodes.map((node) => node.id),
      [ID.focusCard],
    )
    assert.equal(filtered.meta.edgeCount, 0)
  })

  it('keeps the card_relationship between cards that share an axis', () => {
    const filtered = applyFacetFilter(CARD_PROJECTION, {
      type: null,
      suit: null,
      axis: 'TACTIC',
    })
    assert.deepEqual(
      new Set(filtered.nodes.map((node) => node.id)),
      new Set([ID.focusCard, ID.cardTwo]),
    )
    assert.equal(filtered.meta.edgeCount, 1)
    assert.equal(filtered.edges[0]?.family, 'card_relationship')
  })

  it('combines dimensions with AND — a suit does not leak onto claims', () => {
    const filtered = applyFacetFilter(CARD_PROJECTION, {
      type: 'claim',
      suit: 'south-africa',
      axis: null,
    })
    assert.equal(filtered.meta.nodeCount, 0)
    assert.equal(filtered.meta.edgeCount, 0)
  })

  it('preserves corpus meta (warnings, truncation) on the filtered projection', () => {
    const filtered = applyFacetFilter(CARD_PROJECTION, {
      type: 'claim',
      suit: null,
      axis: null,
    })
    assert.equal(filtered.meta.truncated, CARD_PROJECTION.meta.truncated)
    assert.equal(filtered.meta.maxNodes, CARD_PROJECTION.meta.maxNodes)
    assert.deepEqual(filtered.meta.warnings, CARD_PROJECTION.meta.warnings)
    assert.equal(filtered.view, CARD_PROJECTION.view)
    assert.deepEqual(filtered.focus, CARD_PROJECTION.focus)
  })
})

describe('nodeMatchesFacets and hasActiveFacets', () => {
  it('matches a node against every active dimension', () => {
    const focus = CARD_PROJECTION.nodes.find((node) => node.id === ID.focusCard)
    assert.ok(focus !== undefined)
    assert.ok(
      nodeMatchesFacets(focus, {
        type: 'card',
        suit: 'classic',
        axis: 'TACTIC',
      }),
    )
    assert.ok(
      nodeMatchesFacets(focus, {
        type: 'card',
        suit: 'south-africa',
        axis: 'HISTORICAL',
      }),
    )
    assert.ok(
      !nodeMatchesFacets(focus, {
        type: 'card',
        suit: 'zionism-coded',
        axis: 'TACTIC',
      }),
    )
    assert.ok(
      !nodeMatchesFacets(focus, { type: 'claim', suit: 'classic', axis: null }),
    )
  })

  it('reports whether any dimension is narrowing', () => {
    assert.equal(hasActiveFacets(NO_FACET_FILTER), false)
    assert.equal(
      hasActiveFacets({ type: 'claim', suit: null, axis: null }),
      true,
    )
    assert.equal(
      hasActiveFacets({ type: null, suit: 'classic', axis: null }),
      true,
    )
  })
})
