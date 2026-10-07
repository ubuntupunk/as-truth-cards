/**
 * Tests for `graph-status.tsx` — the honest Classification / Provenance /
 * Reasoning readout.
 *
 * The whole contract is the anti-fabrication rule: a dimension the selected
 * view never carries reads "not in this view" (`absent`), one it wants but the
 * corpus blocks reads `data-blocked` with the server's own reason, one it
 * carries and populated reads real counts (`ok`), and before anything loads the
 * cells are dashes (`pending`). No readout may ever present a non-`ok` state as
 * an ordinary zero.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'
import {
  deriveGraphStatus,
  type GraphStatus,
  GraphStatusStrip,
  STATUS_LABELS,
} from './graph-status'
import type { GraphViewDescriptor } from './projection-guards'
import { CARD_PROJECTION, DESCRIPTOR, SPARSE_PROJECTION } from './test-fixtures'

/** The three cell keys, in display order. */
const KEYS: readonly (keyof GraphStatus)[] = [
  'classification',
  'provenance',
  'reasoning',
]

/** A descriptor that declares all three dimensions as available. */
const FULLY_DECLARING_DESCRIPTOR: GraphViewDescriptor = {
  ...DESCRIPTOR,
  excludedNodeTypes: [],
  blockingGaps: [],
  edgeFamilies: [
    'domain',
    'classification',
    'source',
    'claim_relation',
    'inference',
  ],
  nodeTypes: ['card', 'claim', 'source', 'inference_step'],
}

/** A view that only carries classification; provenance/reasoning are foreign. */
const CLASSIFICATION_ONLY_DESCRIPTOR: GraphViewDescriptor = {
  ...DESCRIPTOR,
  edgeFamilies: ['classification'],
  nodeTypes: ['card', 'claim', 'inference_step'],
  excludedNodeTypes: [],
}

describe('deriveGraphStatus pending', () => {
  it('renders three dashes while no projection has loaded', () => {
    const status = deriveGraphStatus(null, null)
    for (const key of KEYS) {
      assert.equal(status[key].state, 'pending')
      assert.equal(status[key].value, '—')
      assert.equal(status[key].note, undefined)
    }
  })
})

describe('deriveGraphStatus populated state', () => {
  it('reports real projection counts when every dimension is available', () => {
    const status = deriveGraphStatus(
      CARD_PROJECTION,
      FULLY_DECLARING_DESCRIPTOR,
    )
    assert.equal(status.classification.state, 'ok')
    assert.equal(status.classification.value, '2 cards · 3 facet edges')
    assert.equal(status.provenance.state, 'ok')
    assert.equal(status.provenance.value, '1 source node · 0 attribution edges')
    assert.equal(status.reasoning.state, 'ok')
    assert.equal(status.reasoning.value, '1 claim relation · 3 inference edges')
  })

  it('is not tricked by an empty willing corpus into faking presence', () => {
    // A fully-populated view with an empty projection still reports real zeros,
    // because the view carries each dimension — absence of rows is an answer.
    const empty: GraphProjection = {
      ...CARD_PROJECTION,
      nodes: [],
      edges: [],
      meta: { ...CARD_PROJECTION.meta, nodeCount: 0, edgeCount: 0 },
    }
    const status = deriveGraphStatus(empty, FULLY_DECLARING_DESCRIPTOR)
    assert.equal(status.classification.state, 'ok')
    assert.equal(status.classification.value, '0 cards · 0 facet edges')
    assert.equal(
      status.reasoning.value,
      '0 claim relations · 0 inference edges',
    )
  })
})

describe('deriveGraphStatus absent state', () => {
  it('marks provenance not-in-this-view under a classification-only view', () => {
    const status = deriveGraphStatus(
      CARD_PROJECTION,
      CLASSIFICATION_ONLY_DESCRIPTOR,
    )
    assert.equal(status.classification.state, 'ok')
    assert.equal(status.provenance.state, 'absent')
    assert.equal(status.reasoning.state, 'absent')
    assert.equal(status.provenance.value, '1 source node · 0 attribution edges')
  })
})

describe('deriveGraphStatus data-blocked state', () => {
  it('reports the server reason when the source family is excluded', () => {
    // DESCRIPTOR excludes `source` ("0 rows in sources") and declares the
    // source node type; the projection does contain a lone source node.
    const status = deriveGraphStatus(CARD_PROJECTION, DESCRIPTOR)
    assert.equal(status.provenance.state, 'data-blocked')
    assert.equal(status.provenance.note, '0 rows in sources')
    assert.equal(status.classification.state, 'ok')
    assert.equal(status.reasoning.state, 'ok')
  })

  it('reports a blockingGap reason when the corpus table is empty', () => {
    const blocked: GraphViewDescriptor = {
      ...DESCRIPTOR,
      excludedNodeTypes: [],
      edgeFamilies: ['classification', 'source', 'claim_relation', 'inference'],
      blockingGaps: ['source: trope_graph.sources has 0 rows'],
    }
    const status = deriveGraphStatus(SPARSE_PROJECTION, blocked)
    assert.equal(status.provenance.state, 'data-blocked')
    assert.ok(
      (status.provenance.note ?? '').includes('sources has 0 rows'),
      `expected the table-level reason, got "${status.provenance.note}"`,
    )
    assert.equal(status.classification.state, 'ok')
    assert.equal(status.classification.value, '1 card · 0 facet edges')
  })

  it('counts 0 when the projection carries none of a blocked dimension', () => {
    const blocked: GraphViewDescriptor = {
      ...CLASSIFICATION_ONLY_DESCRIPTOR,
      nodeTypes: ['card', 'claim', 'source'],
      edgeFamilies: ['classification', 'source'],
      excludedNodeTypes: [{ type: 'source', reason: '0 rows in sources' }],
      blockingGaps: [],
    }
    const status = deriveGraphStatus(SPARSE_PROJECTION, blocked)
    assert.equal(status.provenance.state, 'data-blocked')
    assert.equal(
      status.provenance.value,
      '0 source nodes · 0 attribution edges',
    )
  })
})

describe('GraphStatusStrip markup', () => {
  it('renders exactly the three cells with the shared IA distinctions', () => {
    const html = render(
      <GraphStatusStrip
        projection={CARD_PROJECTION}
        descriptor={CLASSIFICATION_ONLY_DESCRIPTOR}
      />,
    )
    assert.ok(html.includes('data-testid="graph-status"'))
    for (const label of Object.values(STATUS_LABELS)) {
      assert.ok(html.includes(label))
    }
    for (const key of KEYS) {
      assert.ok(html.includes(`data-readout="${key}"`))
    }
    // The three-way distinction is spelled out, never collapsed.
    assert.ok(
      html.includes('Classification') &&
        html.includes('Provenance documents its origin'),
    )
    assert.ok(html.includes('Reasoning connects claims'))
  })

  it('shows the not-in-this-view caption for an absent cell only', () => {
    const html = render(
      <GraphStatusStrip
        projection={CARD_PROJECTION}
        descriptor={CLASSIFICATION_ONLY_DESCRIPTOR}
      />,
    )
    assert.ok(html.includes('not in this view'))
    assert.ok(html.includes('data-state="absent"'))
    assert.ok(html.includes('data-state="ok"'))
  })

  it('renders pending cells before any projection exists', () => {
    const html = render(
      <GraphStatusStrip projection={null} descriptor={null} />,
    )
    assert.ok(html.includes('data-state="pending"'))
    assert.equal(
      html.match(/data-state="pending"/g)?.length,
      3,
      'all three cells must be pending before a projection loads',
    )
    // A dash is not a claim: the value is rendered, not fabricated text.
    assert.ok(html.includes('>—<'))
  })

  it('names the block reason instead of letting a blocked cell look ok', () => {
    const html = render(
      <GraphStatusStrip
        projection={SPARSE_PROJECTION}
        descriptor={DESCRIPTOR}
      />,
    )
    assert.ok(html.includes('data-state="data-blocked"'))
    assert.ok(html.includes('data-block-note'))
    assert.ok(html.includes('0 rows in sources'))
  })
})
