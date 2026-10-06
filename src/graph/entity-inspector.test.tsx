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
import {
  EntityInspector,
  findEdgeById,
  findNodeById,
  type RefocusTarget,
} from './entity-inspector'
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

  it('renders the status with its vocabulary source', () => {
    assert.ok(html.includes('ESTABLISHED'))
    assert.ok(html.includes('epistemic_status'))
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
    assert.ok(html.includes('· none'))
  })

  it('renders a case with lifecycle status tagged by its vocabulary', () => {
    const html = renderInspector({ kind: 'node', id: ID.caseC })
    assert.ok(html.includes('data-node-type="case"'))
    assert.ok(html.includes('ACTIVE'))
    assert.ok(html.includes('lifecycle_status'))
    assert.ok(html.includes('case_status'))
  })

  it('renders an inference step with free-text status tagged uncontrolled', () => {
    const html = renderInspector({ kind: 'node', id: ID.stepTwo })
    assert.ok(html.includes('>UNSUPPORTED<'))
    assert.ok(html.includes('independent_inference_status'))
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
