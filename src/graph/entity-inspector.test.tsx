/**
 * Tests for `entity-inspector.tsx` — the semantic side panel.
 *
 * `preact-render-to-string` renders the panel to a string under Node, and the
 * assertions read the data-* hooks and copy the component deliberately
 * emits. The issue-#3 boundaries asserted here are the anti-collapse rules:
 * `south-africa` stays split between Suit and Locale, the two `SUPPORTS`
 * edges stay in separate families, axis `primary` is derived from `ordinal 0`
 * — never from the legacy type — and status values always render beside their
 * `source` vocabulary tag.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'
import {
  EntityInspector,
  findEdgeById,
  findNodeById,
  type RefocusTarget,
} from './entity-inspector'
import type { GraphViewDescriptor } from './projection-guards'
import {
  CARD_PROJECTION,
  FOCUS_CARD_NODE,
  ID,
  PROJECTION_EDGES,
} from './test-fixtures'

function renderInspector(
  selection: Parameters<typeof EntityInspector>[0]['selection'],
  onRefocus?: (id: string, type: RefocusTarget) => void,
) {
  return render(
    <EntityInspector
      projection={CARD_PROJECTION}
      selection={selection}
      onNavigateCard={() => {}}
      onRefocus={onRefocus}
    />,
  )
}

describe('entity-inspector selection surface', () => {
  it('invites interaction when nothing is selected', () => {
    const html = renderInspector(null)
    assert.ok(
      html.includes('Select a node or an edge in the graph to inspect it'),
    )
  })

  it('handles a node id that is not in this projection', () => {
    const html = renderInspector({ kind: 'node', id: 'missing-node' })
    assert.ok(html.includes('no longer in this projection'))
  })

  it('handles an edge id that is not in this projection', () => {
    const html = renderInspector({ kind: 'edge', id: 'missing-edge' })
    assert.ok(html.includes('no longer in this projection'))
  })
})

describe('entity-inspector card node', () => {
  const html = renderInspector({ kind: 'node', id: ID.focusCard })

  it('renders the node silo with its canonical id', () => {
    assert.ok(html.includes('data-node-type="card"'))
    assert.ok(html.includes(`data-node-id="${ID.focusCard}"`))
    assert.ok(html.includes('focus node'))
    assert.ok(html.includes('data-testid="open-card"'))
    assert.ok(html.includes('data-slug="jesus-was-a-zionist"'))
  })

  it('labels legacy primary type as legacy, never as an axis', () => {
    assert.ok(html.includes('>TACTIC'))
    assert.ok(html.includes('legacy authoring field, not an axis'))
  })

  it('renders ordered axes with primary derived from ordinal 0', () => {
    assert.ok(html.includes('data-testid="axis"'))
    assert.ok(
      html.includes('data-axis="TACTIC" data-primary="true" data-ordinal="0"'),
    )
    assert.ok(
      html.includes(
        'data-axis="HISTORICAL" data-primary="false" data-ordinal="1"',
      ),
    )
  })

  it('keeps the shared south-africa slug split between Suit and Locale by id', () => {
    assert.ok(html.includes('Suits'))
    assert.ok(html.includes('Locales'))
    assert.ok(
      html.includes(
        `data-testid="suit" data-kind="suit" data-slug="south-africa" data-id="${ID.suitSouthAfrica}"`,
      ),
    )
    assert.ok(
      html.includes(
        'data-testid="locale" data-kind="locale" data-slug="south-africa" data-id="bf000000-0000-0000-0000-0000000000d1"',
      ),
    )
  })

  it('renders mechanisms from the classification bag and concepts from HAS_CONCEPT edges', () => {
    assert.ok(html.includes('data-testid="mechanism"'))
    assert.ok(html.includes(`data-id="${ID.mechanismRec}"`))
    assert.ok(html.includes('data-testid="concept"'))
    assert.ok(html.includes(`data-id="${ID.conceptX}"`))
    assert.ok(html.includes('Modern recontextualization'))
  })

  it('lists every incident edge with its family beside the relation word', () => {
    assert.ok(html.includes(`data-relationship-edge="`))
    // The focus card's incident edges: domain assertions, classification and
    // the card-to-card relationship. The claim_relation edge ties the two
    // claims together and is legitimately absent here.
    assert.ok(html.includes('data-relationship-family="domain"'))
    assert.ok(html.includes('data-relationship-family="classification"'))
    assert.ok(html.includes('data-relationship-family="card_relationship"'))
    assert.ok(html.includes('data-relationship-relation="SUPPORTS"'))
    assert.ok(!html.includes('data-relationship-family="claim_relation"'))
  })

  it('renders the approved status token beside its vocabulary in words', () => {
    assert.ok(html.includes('ESTABLISHED'))
    assert.ok(html.includes('Epistemic status'))
    assert.ok(html.includes('data-status="ESTABLISHED"'))
    assert.ok(html.includes('data-status-source="epistemic_status"'))
  })
})

describe('entity-inspector card-front fold', () => {
  const html = renderInspector({ kind: 'node', id: ID.focusCard })

  it('reproduces the card front badges from classification.suits', () => {
    assert.ok(html.includes('data-suit="classic"'))
    assert.ok(html.includes('data-suit="south-africa"'))
    assert.ok(html.includes('#ef44441f'))
    assert.ok(html.includes('#22d3ee1f'))
  })

  it('keeps axes in the authored order, TACTIC before HISTORICAL', () => {
    assert.ok(
      html.indexOf('data-axis="TACTIC"') <
        html.indexOf('data-axis="HISTORICAL"'),
    )
  })

  it('lists mechanisms before concepts inside the fold', () => {
    const section = html.slice(html.indexOf('data-testid="mechanism-concepts"'))
    assert.ok(section.includes('data-pill="mechanism"'))
    assert.ok(section.includes('data-pill="concept"'))
    assert.ok(
      section.indexOf('data-pill="mechanism"') <
        section.indexOf('data-pill="concept"'),
    )
    assert.ok(html.includes('Mechanisms &amp; concepts'))
    assert.ok(html.includes('Recontextualization'))
    assert.ok(html.includes('Modern recontextualization'))
  })

  it('keeps the card-front fold out when the card has no classification', () => {
    const sparse = renderInspector({ kind: 'node', id: ID.cardTwo })
    assert.ok(sparse.includes('data-axis="TACTIC"'))
    assert.ok(!sparse.includes('data-suit='))
    assert.ok(!sparse.includes('data-testid="mechanism-concepts"'))
  })
})

describe('entity-inspector card taxonomy absence', () => {
  const html = renderInspector({ kind: 'node', id: ID.cardTwo })

  it('renders a card with empty classification without facet headings', () => {
    assert.ok(html.includes('data-node-type="card"'))
    assert.ok(!html.includes('Suits'))
    assert.ok(!html.includes('Locales'))
    assert.ok(!html.includes('Concepts'))
    assert.ok(html.includes('CASE'))
  })
})

describe('entity-inspector non-card nodes', () => {
  it('renders a claim with its type and owning card id', () => {
    const html = renderInspector({ kind: 'node', id: ID.claimOne })
    assert.ok(html.includes('data-node-type="claim"'))
    assert.ok(html.includes('>HISTORICAL<'))
    assert.ok(html.includes(`>${ID.focusCard}<`))
  })

  it('renders an inference step with provenance, chains, premises and conclusions', () => {
    const html = renderInspector({ kind: 'node', id: ID.stepOne })
    assert.ok(html.includes('data-node-type="inference_step"'))
    assert.ok(html.includes('>DEDUCTIVE<'))
    assert.ok(html.includes('Canonical'))
    assert.ok(html.includes('The main argument'))
    assert.ok(html.includes('Jesus was born in Bethlehem'))
    assert.ok(html.includes('Zionism is a modern movement'))
    assert.ok(html.includes('argument_chain_steps'))
  })

  it('renders taxonomy nodes with the no-claim status truthfully', () => {
    const html = renderInspector({ kind: 'node', id: ID.suitSouthAfrica })
    assert.ok(html.includes('data-node-type="collection"'))
    assert.ok(html.includes('data-status="none"'))
    assert.ok(html.includes('>none<'))
    assert.ok(!html.includes('· None'))
  })

  it('renders a case with lifecycle status tagged by its vocabulary', () => {
    const html = renderInspector({ kind: 'node', id: ID.caseC })
    assert.ok(html.includes('data-node-type="case"'))
    assert.ok(html.includes('ACTIVE'))
    assert.ok(html.includes('Lifecycle status'))
    assert.ok(html.includes('case_status'))
  })

  it('renders an inference step with free-text status tagged uncontrolled', () => {
    const html = renderInspector({ kind: 'node', id: ID.stepTwo })
    assert.ok(html.includes('>UNSUPPORTED<'))
    assert.ok(html.includes('Independent inference status'))
    assert.ok(!html.includes('inference_step_relation_type'))
  })
})

describe('entity-inspector edges', () => {
  it('renders a claim_relation SUPPORTS edge without collapsing it into an inference', () => {
    const edge = findEdgeById(CARD_PROJECTION, PROJECTION_EDGES[2].id)
    assert.ok(edge)
    const html = renderInspector({ kind: 'edge', id: edge.id })
    assert.ok(html.includes(`data-edge-id="${edge.id}"`))
    assert.ok(html.includes('data-family="claim_relation"'))
    assert.ok(html.includes('data-relation="SUPPORTS"'))
    assert.ok(html.includes('data-source-table="claim_relations"'))
    assert.ok(html.includes('data-traversal="bidirectional"'))
    assert.ok(!html.includes('card_relationship'))
  })

  it('renders a card_relationship SUPPORTS edge in its own family', () => {
    const edge = findEdgeById(CARD_PROJECTION, PROJECTION_EDGES[9].id)
    assert.ok(edge)
    const html = renderInspector({ kind: 'edge', id: edge.id })
    assert.ok(html.includes('data-family="card_relationship"'))
    assert.ok(html.includes('data-relation="SUPPORTS"'))
    assert.ok(html.includes('data-source-table="relationships"'))
    assert.ok(html.includes('data-traversal="directed"'))
    assert.ok(html.includes('CANONICAL'))
    assert.ok(!html.includes('claim_relation'))
  })

  it('shows the vocabulary only when the edge type declares one', () => {
    const stepRelation = findEdgeById(CARD_PROJECTION, PROJECTION_EDGES[5].id)
    assert.ok(stepRelation)
    const html = renderInspector({ kind: 'edge', id: stepRelation.id })
    assert.ok(html.includes('inference_step_relation_type'))
  })

  it('resolves endpoint labels and ids for an inference edge', () => {
    const premise = findEdgeById(CARD_PROJECTION, PROJECTION_EDGES[3].id)
    assert.ok(premise)
    const html = renderInspector({ kind: 'edge', id: premise.id })
    assert.ok(html.includes('Jesus was born in Bethlehem'))
    assert.ok(html.includes('Step: premise to conclusion'))
    assert.ok(html.includes('inference_premises'))
  })

  it('exposes the same lookup helpers the page glue uses', () => {
    assert.equal(findNodeById(CARD_PROJECTION, ID.focusCard)?.type, 'card')
    assert.equal(findNodeById(CARD_PROJECTION, 'nope'), null)
    // FOCUS_CARD_NODE is the fixture node: it must be the one the projection carries.
    assert.equal(findNodeById(CARD_PROJECTION, ID.focusCard), FOCUS_CARD_NODE)
  })
})

/** A projection carrying one authored `claim -> source` attribution. */
const PROJECTION_WITH_SOURCE: GraphProjection = {
  ...CARD_PROJECTION,
  nodes: [
    ...CARD_PROJECTION.nodes,
    {
      id: 'source-1',
      type: 'source',
      label: 'Pilgrims and Patriots',
      depth: 1,
      isFocus: false,
      degree: 1,
      status: { source: 'none', value: null },
      metadata: {
        title: 'Pilgrims and Patriots',
        author: 'Sarah Rachel',
        publisher: null,
        citation: null,
        url: null,
        sourceType: 'BOOK',
      },
    },
  ],
  edges: [
    ...CARD_PROJECTION.edges,
    {
      id: `source|${ID.claimOne}|ATTRIBUTED_TO|source-1`,
      family: 'source',
      type: { family: 'source', value: 'ATTRIBUTED_TO' },
      sourceTable: 'claim_sources',
      from: ID.claimOne,
      to: 'source-1',
      attributes: {
        quoteOrExcerpt: 'a quotation the claim was read from',
        pageReference: 'p. 12',
        notes: null,
      },
      traversal: 'bidirectional',
    },
  ],
}

/** The previous projection plus one evidence item asserted against the claim. */
const PROJECTION_WITH_EVIDENCE: GraphProjection = {
  ...PROJECTION_WITH_SOURCE,
  nodes: [
    ...PROJECTION_WITH_SOURCE.nodes,
    {
      id: 'ev-1',
      type: 'evidence_item',
      label: 'Field report',
      depth: 2,
      isFocus: false,
      degree: 1,
      status: {
        source: 'evidence_status',
        value: 'PRIMARY',
        vocabulary: 'uncontrolled',
      },
      metadata: {
        evidenceType: 'QUOTATION',
        locator: null,
        quoteOrExcerpt: 'Evidence ev-1 content',
        strength: null,
      },
    },
  ],
  edges: [
    ...PROJECTION_WITH_SOURCE.edges,
    {
      id: `evidence|ev-1|SUPPORTS|${ID.claimOne}`,
      family: 'evidence',
      type: { family: 'evidence', value: 'SUPPORTS' },
      sourceTable: 'evidence_claims',
      from: 'ev-1',
      to: ID.claimOne,
      attributes: { strength: 'STRONG', notes: null },
      traversal: 'bidirectional',
    },
  ],
}

/** A descriptor that declares the source family: provenance may speak. */
const SOURCE_DECLARING_VIEW: GraphViewDescriptor = {
  name: 'card-argument-taxonomy',
  description: 'fixture descriptor that declares the source family',
  status: 'implemented',
  focusTypes: ['card'],
  nodeTypes: ['card', 'claim', 'source'],
  edgeFamilies: ['domain', 'claim_relation', 'inference', 'source'],
  excludedNodeTypes: [],
  nonNodeStructures: [],
  maxDepth: 3,
  populated: true,
  blockingGaps: [],
}

/** Classification only: this view never asks for provenance. */
const TAXONOMY_ONLY_VIEW: GraphViewDescriptor = {
  ...SOURCE_DECLARING_VIEW,
  edgeFamilies: ['classification'],
}

/** The evidence view over a corpus with zero evidence rows. */
const EVIDENCE_EMPTY_VIEW: GraphViewDescriptor = {
  name: 'evidence',
  description: 'fixture descriptor over an empty evidence layer',
  status: 'data_blocked',
  focusTypes: ['claim', 'source', 'evidence_item'],
  nodeTypes: ['claim', 'source', 'evidence_item', 'inference_step'],
  edgeFamilies: ['inference', 'source', 'evidence'],
  excludedNodeTypes: [],
  nonNodeStructures: [],
  maxDepth: 3,
  populated: false,
  blockingGaps: ['evidence_item: trope_graph.evidence_items has 0 rows'],
}

/** The evidence view over a corpus that does have evidence rows elsewhere. */
const EVIDENCE_POPULATED_VIEW: GraphViewDescriptor = {
  ...EVIDENCE_EMPTY_VIEW,
  populated: true,
  blockingGaps: [],
}

/** Render the inspected claim under a given projection and view descriptor. */
function renderClaimWith(
  projection: GraphProjection,
  descriptor?: GraphViewDescriptor,
) {
  return render(
    <EntityInspector
      projection={projection}
      selection={{ kind: 'node', id: ID.claimOne }}
      onNavigateCard={() => {}}
      descriptor={descriptor}
    />,
  )
}

describe('entity-inspector provenance and evidence honesty', () => {
  it('shows the authored attribution with its quote, page and source label', () => {
    const html = renderClaimWith(PROJECTION_WITH_SOURCE, SOURCE_DECLARING_VIEW)
    assert.ok(html.includes('data-provenance-edge='))
    assert.ok(html.includes('data-source-table="claim_sources"'))
    assert.ok(html.includes('ATTRIBUTED_TO'))
    assert.ok(html.includes('a quotation the claim was read from'))
    assert.ok(html.includes('p. 12'))
    assert.ok(html.includes('Pilgrims and Patriots'))
  })

  it('reports an expanded claim with no attribution as a corpus fact', () => {
    // claimOne sits at depth 1 of a depth-3, untruncated projection, so its
    // rows were fully requested: silence here is the corpus's answer.
    const html = renderClaimWith(CARD_PROJECTION, SOURCE_DECLARING_VIEW)
    assert.ok(
      html.includes(
        'No source attribution recorded for this claim in the corpus.',
      ),
    )
  })

  it('stays silent about provenance when the view declares no source family', () => {
    const html = renderClaimWith(CARD_PROJECTION, TAXONOMY_ONLY_VIEW)
    assert.ok(!html.includes('Provenance'))
    assert.ok(!html.includes('No source attribution recorded'))
  })

  it('suppresses the provenance empty state when no descriptor was passed', () => {
    const html = renderClaimWith(CARD_PROJECTION)
    assert.ok(!html.includes('Provenance'))
  })

  it('reports the empty evidence layer as a corpus fact, not schema language', () => {
    const html = renderClaimWith(CARD_PROJECTION, EVIDENCE_EMPTY_VIEW)
    assert.ok(html.includes('No evidence is recorded in the corpus at all'))
    assert.ok(!html.includes('trope_graph.evidence_items'))
  })

  it('reports an unsupported claim when the corpus has evidence rows but none here', () => {
    const html = renderClaimWith(CARD_PROJECTION, EVIDENCE_POPULATED_VIEW)
    assert.ok(
      html.includes(
        'No evidence is recorded against this claim. A corpus fact, not a load failure.',
      ),
    )
    assert.ok(!html.includes('evidence_'))
  })

  it('lists evidence against the claim with relation, strength and quote', () => {
    const html = renderClaimWith(PROJECTION_WITH_EVIDENCE, EVIDENCE_EMPTY_VIEW)
    assert.ok(html.includes('data-evidence-edge='))
    assert.ok(html.includes('data-source-table="evidence_claims"'))
    assert.ok(html.includes('SUPPORTS'))
    assert.ok(html.includes('strength STRONG'))
    assert.ok(html.includes('Evidence ev-1 content'))
    assert.ok(html.includes('Field report'))
  })

  it('offers refocus for a source node', () => {
    const html = render(
      <EntityInspector
        projection={PROJECTION_WITH_SOURCE}
        selection={{ kind: 'node', id: 'source-1' }}
        onNavigateCard={() => {}}
        onRefocus={() => {}}
      />,
    )
    assert.ok(html.includes('data-testid="focus-entity"'))
    assert.ok(html.includes('data-entity-type="source"'))
    assert.ok(html.includes('Focus source'))
  })
})

describe('entity-inspector refocus action', () => {
  const noOp = () => {}

  it('offers to focus a claim and carries the id the handler needs', () => {
    const html = renderInspector({ kind: 'node', id: ID.claimOne }, noOp)
    assert.ok(html.includes('data-testid="focus-entity"'))
    assert.ok(html.includes('data-entity-type="claim"'))
    assert.ok(html.includes(`data-entity-id="${ID.claimOne}"`))
    assert.ok(html.includes('Focus claim'))
  })

  it('offers to focus an argument chain', () => {
    const html = renderInspector({ kind: 'node', id: ID.chainOne }, noOp)
    assert.ok(html.includes('data-testid="focus-entity"'))
    assert.ok(html.includes('data-entity-type="argument_chain"'))
    assert.ok(html.includes(`data-entity-id="${ID.chainOne}"`))
    assert.ok(html.includes('Focus argument'))
  })

  it('never offers refocus for a card or other non-refocusable node', () => {
    const card = renderInspector({ kind: 'node', id: ID.focusCard }, noOp)
    assert.ok(!card.includes('data-testid="focus-entity"'))
    const step = renderInspector({ kind: 'node', id: ID.stepOne }, noOp)
    assert.ok(!step.includes('data-testid="focus-entity"'))
  })

  it('omits the button when the page passed no handler', () => {
    const html = renderInspector({ kind: 'node', id: ID.claimOne })
    assert.ok(!html.includes('data-testid="focus-entity"'))
  })

  it('omits the button when the node is already the focus', () => {
    const focused = {
      ...CARD_PROJECTION,
      nodes: CARD_PROJECTION.nodes.map((node) =>
        node.id === ID.claimOne ? { ...node, isFocus: true } : node,
      ),
    }
    const html = render(
      <EntityInspector
        projection={focused}
        selection={{ kind: 'node', id: ID.claimOne }}
        onNavigateCard={() => {}}
        onRefocus={noOp}
      />,
    )
    assert.ok(!html.includes('data-testid="focus-entity"'))
    assert.ok(html.includes('focus node'))
  })
})
