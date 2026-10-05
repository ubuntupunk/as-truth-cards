import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import cytoscape from 'cytoscape'

import {
  CytoscapeAdapterError,
  toCytoscapeElements,
  toCytoscapePresentation,
} from '../src/graph/cytoscape-adapter'
import type {
  CytoscapeEdgeElement,
  CytoscapeElement,
  CytoscapeNodeElement,
} from '../src/graph/cytoscape-adapter'
import { projectGraph } from '../src/graph/projection'
import type {
  CardNode,
  GraphEdge,
  GraphNode,
  GraphProjection,
} from '../src/graph/types'
import {
  DEFAULT_DEPTH,
  DEFAULT_MAX_NODES,
  getGraphView,
} from '../src/graph/views'
import {
  FakeGraphReader,
  card,
  claim,
  claimRelation,
  emptyCorpus,
  richCorpus,
} from './helpers/fake-graph-reader'
import type { FakeCorpus } from './helpers/fake-graph-reader'

/**
 * The Cytoscape adapter must be lossless, deterministic and inert.
 *
 * Driven through the real projection for the same reason `graphology-adapter.test.ts` is: an
 * adapter is only trustworthy when it is proven against the shapes `projectGraph` actually
 * emits, including the awkward ones. The fake reader is reused rather than new fixtures being
 * written, so these tests cannot drift from the projection they adapt.
 *
 * The failure this guards against is specific to Cytoscape and is worse than Graphology's. Both
 * libraries happily accept plausible input, so a mapping mistake — a dropped attribute, a
 * flattened edge family, an inferred relation — shows up as a working graph with the wrong
 * content. Cytoscape adds a second class of failure that Graphology does not have: it is
 * *silent* about id problems. Measured against 3.34.3, two nodes sharing an id merge into one,
 * two edges sharing an id merge into one, and an edge whose id equals a node id is discarded
 * entirely — none with an error. So "the view quietly shows fewer nodes than the projection
 * emitted" is a reachable failure here, and every assertion below is about preservation,
 * determinism or refusal rather than about the adapter's own opinions.
 *
 * Two things are deliberately tested through a real `cytoscape()` core as well as through the
 * returned array. First, that the output is genuinely acceptable to the library and not merely
 * structurally plausible. Second, the classes and data keys, because Cytoscape reads `classes`
 * only at element level and drops `undefined` values from `data()` — two ways a mapping can
 * look right in JSON and render wrong.
 */

/** The v1 view under test, narrowed once so no assertion can run against `undefined`. */
const view = getGraphView('card-argument-taxonomy')!
assert.ok(view, 'card-argument-taxonomy must be registered')

/** The browse-and-classify view, which is the only one that emits Concept. */
const taxonomyView = getGraphView('taxonomy')!
assert.ok(taxonomyView, 'taxonomy must be registered')

/**
 * Project a fake corpus and adapt it, the full chain a caller would run.
 *
 * Defaults to `depth: 2` rather than `DEFAULT_DEPTH`, because the claim-to-step hop is what
 * brings `inference_step` nodes, `claim_relation` edges and `PREMISE_OF`/`CONCLUDES` edges into
 * the projection. At `DEFAULT_DEPTH` (1) the fixture emits only assertions, Suit and Mechanism
 * links, so every assertion about reasoning structure would pass against a graph that contains
 * no reasoning at all.
 */
async function adapt(
  corpus: FakeCorpus = richCorpus(),
  overrides: Partial<Parameters<typeof projectGraph>[1]> = {},
) {
  const projection = await projectGraph(new FakeGraphReader(corpus), {
    focus: 'card-1',
    view,
    depth: 2,
    maxNodes: DEFAULT_MAX_NODES,
    ...overrides,
  })
  return { projection, ...toCytoscapePresentation(projection) }
}

/** Narrow one element to a node element, so no assertion runs against a union it cannot read. */
function asNode(element: CytoscapeElement): CytoscapeNodeElement {
  assert.equal(element.group, 'nodes', `expected a node element, got ${element.group}`)
  return element as CytoscapeNodeElement
}

/** Narrow one element to an edge element, so no assertion runs against a union it cannot read. */
function asEdge(element: CytoscapeElement): CytoscapeEdgeElement {
  assert.equal(element.group, 'edges', `expected an edge element, got ${element.group}`)
  return element as CytoscapeEdgeElement
}

/** Every edge element, narrowed. */
function edgeElements(elements: readonly CytoscapeElement[]): CytoscapeEdgeElement[] {
  return elements.filter((e): e is CytoscapeEdgeElement => e.group === 'edges')
}

/** Every node element, narrowed. */
function nodeElements(elements: readonly CytoscapeElement[]): CytoscapeNodeElement[] {
  return elements.filter((e): e is CytoscapeNodeElement => e.group === 'nodes')
}

/** The element carrying a given id, narrowed by kind, or a hard failure. */
function edgeById(
  elements: readonly CytoscapeElement[],
  id: string,
): CytoscapeEdgeElement {
  const found = elements.find((e) => e.group === 'edges' && e.data.id === id)
  assert.ok(found, `no edge element with id "${id}"`)
  return asEdge(found)
}

/** The element carrying a given id, narrowed by kind, or a hard failure. */
function nodeById(
  elements: readonly CytoscapeElement[],
  id: string,
): CytoscapeNodeElement {
  const found = elements.find((e) => e.group === 'nodes' && e.data.id === id)
  assert.ok(found, `no node element with id "${id}"`)
  return asNode(found)
}

/**
 * The sparsest projection `projectGraph` can produce: the focus card and nothing else.
 *
 * An empty corpus cannot produce an empty projection, because the focus has to resolve or the
 * request is a 404. So the real "no data" case is one node and zero edges, and that is what
 * these tests use. A literal `nodes: []` is covered separately as a defensive contract.
 */
async function adaptSparse() {
  const corpus = emptyCorpus()
  corpus.cards = [card({ id: 'card-1', slug: 'lonely-card' })]
  const projection = await projectGraph(new FakeGraphReader(corpus), {
    focus: 'card-1',
    view,
    depth: DEFAULT_DEPTH,
    maxNodes: DEFAULT_MAX_NODES,
  })
  return { projection, ...toCytoscapePresentation(projection) }
}

/** Re-emit a projection with one field changed, for the malformed-input cases. */
function mutate(
  projection: GraphProjection,
  changes: Partial<GraphProjection>,
): GraphProjection {
  return { ...projection, ...changes }
}

/** Re-emit a node with one field changed. */
function mutateNode(node: GraphNode, changes: Partial<GraphNode>): GraphNode {
  return { ...node, ...changes } as GraphNode
}

/** Re-emit an edge with one field changed. */
function mutateEdge(edge: GraphEdge, changes: Partial<GraphEdge>): GraphEdge {
  return { ...edge, ...changes } as GraphEdge
}

/**
 * A card node carrying every classification dimension the fake corpus cannot author.
 *
 * `card_axes` is not part of `FakeCorpus`, so a projection built from the fake reader reports
 * `axes: []` for every card. Asserting on an empty array would pass whether or not Axis survived
 * conversion, so this fixture supplies the dimension explicitly and the test below can fail.
 */
function classifiedCard(over: Partial<CardNode> = {}): CardNode {
  return {
    id: 'card-1',
    type: 'card',
    label: 'A card',
    depth: 0,
    isFocus: true,
    degree: 1,
    status: { source: 'epistemic_status', value: 'ESTABLISHED' },
    classification: {
      axes: [
        { axis: 'TACTIC', ordinal: 0, primary: true },
        { axis: 'THEOLOGICAL', ordinal: 1, primary: false },
      ],
      suits: ['classic', 'zionism-coded'],
      suitIds: ['suit-classic-id', 'suit-zionism-coded-id'],
      mechanismSlugs: ['name-slur'],
      mechanismIds: ['mechanism-name-slur-id'],
      localeSlugs: ['israel', 'south-africa'],
      localeIds: ['locale-israel-id', 'locale-south-africa-id'],
    },
    metadata: {
      slug: 'a-card',
      summary: 'A summary',
      coreQuestion: 'A question',
      legacyPrimaryType: 'CASE',
      legacyPrimaryTypeIsAxis: false,
    },
    ...over,
  }
}

/** A minimal, valid projection for the hand-built cases. */
function handProjection(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): GraphProjection {
  return {
    focus: { id: nodes[0]?.id ?? 'card-1', type: nodes[0]?.type ?? 'card', slug: null },
    view: 'hand-built',
    depth: 1,
    nodes,
    edges,
    meta: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      truncated: false,
      maxNodes: DEFAULT_MAX_NODES,
      reachedDepth: 1,
      warnings: ['a hand-built warning'],
    },
  }
}

/** A valid edge with one field changed, for the malformed-input cases. */
function handEdge(over: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'classification|card-1|HAS_CONCEPT|concept-1',
    family: 'classification',
    type: { family: 'classification', value: 'HAS_CONCEPT' },
    sourceTable: 'card_concepts',
    from: 'card-1',
    to: 'concept-1',
    attributes: { relationship: 'The card is about the movement.' },
    traversal: 'bidirectional',
    ...over,
  }
}

/**
 * Run the adapter, expect it to refuse, and return the error it refused with.
 *
 * `assert.throws` returns nothing, and asserting the message separately would re-run the
 * conversion, so this both runs it once and gives the message assertions something to read.
 */
function captureError(projection: GraphProjection): CytoscapeAdapterError {
  try {
    toCytoscapePresentation(projection)
  } catch (error) {
    assert.ok(
      error instanceof CytoscapeAdapterError,
      `expected a CytoscapeAdapterError, got ${String(error)}`,
    )
    return error
  }
  assert.fail('expected the adapter to refuse this projection')
}

describe('projection -> Cytoscape', () => {
  it('preserves node and edge counts, exactly', async () => {
    const { projection, elements } = await adapt()
    assert.equal(nodeElements(elements).length, projection.nodes.length)
    assert.equal(edgeElements(elements).length, projection.edges.length)
    assert.equal(nodeElements(elements).length, projection.meta.nodeCount)
    assert.equal(edgeElements(elements).length, projection.meta.edgeCount)
    assert.equal(elements.length, projection.nodes.length + projection.edges.length)
    assert.ok(projection.nodes.length > 0, 'the fixture must actually produce nodes')
  })

  it('preserves every node id verbatim, and never synthesises one', async () => {
    const { projection, elements } = await adapt()
    assert.deepEqual(
      nodeElements(elements).map((e) => e.data.id).sort(),
      projection.nodes.map((n) => n.id).sort(),
    )
  })

  it('preserves every edge id verbatim', async () => {
    const { projection, elements } = await adapt()
    const projected = projection.edges.map((e) => e.id).sort()
    assert.deepEqual(edgeElements(elements).map((e) => e.data.id).sort(), projected)
  })

  it('preserves direction, keeping the authored from/to on every edge', async () => {
    const { projection, elements } = await adapt()
    assert.ok(projection.edges.length > 0)
    for (const edge of projection.edges) {
      const element = edgeById(elements, edge.id)
      assert.equal(element.data.source, edge.from, `edge ${edge.id} source`)
      assert.equal(element.data.target, edge.to, `edge ${edge.id} target`)
    }
  })

  it('keeps traversal separate from direction, so a bidirectional edge is still directed', async () => {
    // The distinction `types.ts` insists on: `from`/`to` are authored direction, `traversal`
    // governs expansion. An adapter that modelled bidirectional edges as Cytoscape's undirected
    // two-arrow style, or that swapped source/target, would destroy the authored direction a
    // consumer is entitled to read.
    const { projection, elements } = await adapt()
    const bidirectional = projection.edges.filter((e) => e.traversal === 'bidirectional')
    assert.ok(bidirectional.length > 0, 'the fixture must include a bidirectional edge')
    for (const edge of bidirectional) {
      const element = edgeById(elements, edge.id)
      assert.equal(element.data.traversal, 'bidirectional')
      assert.equal(element.data.source, edge.from)
      assert.equal(element.data.target, edge.to)
    }
  })

  it('preserves edge family and relation, never flattening them together', async () => {
    // The whole point of the family indirection: `SUPPORTS` from two families are different
    // edges. A mapping that keyed elements by relation word alone would merge them.
    const corpus = richCorpus()
    corpus.claims = [claim({ id: 'claim-1' }), claim({ id: 'claim-2' })]
    corpus.claimRelations = [
      claimRelation({ id: 'cr-1', sourceClaimId: 'claim-1', targetClaimId: 'claim-2' }),
    ]
    const { projection, elements } = await adapt(corpus, { depth: 2 })
    const supports = projection.edges.filter((e) => e.type.value === 'SUPPORTS')
    assert.ok(supports.length > 0, 'the fixture must produce an authored SUPPORTS edge')
    for (const edge of supports) {
      const element = edgeById(elements, edge.id)
      assert.equal(element.data.relation, 'SUPPORTS')
      assert.equal(element.data.family, edge.family)
      assert.equal(element.data.sourceTable, edge.sourceTable)
    }
  })

  it('keeps HAS_CONCEPT distinct from HAS_MECHANISM, as separate relations and separate edges', async () => {
    // Concept and Mechanism are separate tables with no cross-mapping, so the projection emits a
    // third classification value rather than reusing HAS_MECHANISM. An adapter that normalised
    // relation words, or that styled by target node type instead of relation, would erase the
    // one authored fact that distinguishes them.
    const { elements } = await adapt(richCorpus(), { view: taxonomyView })
    const conceptEdge = edgeElements(elements).find(
      (e) => e.data.relation === 'HAS_CONCEPT',
    )
    const mechanismEdge = edgeElements(elements).find(
      (e) => e.data.relation === 'HAS_MECHANISM',
    )
    assert.ok(conceptEdge, 'the taxonomy view must emit a HAS_CONCEPT edge')
    assert.ok(mechanismEdge, 'the taxonomy view must emit a HAS_MECHANISM edge')
    assert.notEqual(conceptEdge.data.id, mechanismEdge.data.id)
    assert.notEqual(conceptEdge.data.sourceTable, mechanismEdge.data.sourceTable)
    assert.equal(conceptEdge.data.sourceTable, 'card_concepts')
    assert.equal(mechanismEdge.data.sourceTable, 'card_mechanisms')
    assert.equal(conceptEdge.data.family, 'classification')
    assert.equal(mechanismEdge.data.family, 'classification')
    // And the classes differ, so a stylesheet can tell them apart without reading data.
    assert.ok(conceptEdge.classes.includes('relation-HAS_CONCEPT'))
    assert.ok(mechanismEdge.classes.includes('relation-HAS_MECHANISM'))
    assert.ok(!conceptEdge.classes.includes('relation-HAS_MECHANISM'))
  })

  it('keeps argument and inference edges distinct from direct claim relations', async () => {
    // The collapse Issue #3 forbids: `claims.card_id` assertions, inference structure and
    // authored claim relations are three different vocabularies. If inference were rendered as
    // a direct claim relation, a reader could not tell an authored SUPPORTS from a reconstructed
    // one, and `step-2 -> claim-2` has no premise row pairing them at all.
    const corpus = richCorpus()
    corpus.claims = [
      claim({ id: 'claim-1' }),
      claim({ id: 'claim-2' }),
      claim({ id: 'claim-3' }),
    ]
    corpus.claimRelations = [
      claimRelation({ id: 'cr-1', sourceClaimId: 'claim-1', targetClaimId: 'claim-2' }),
    ]
    const { projection, elements } = await adapt(corpus, { depth: 2 })

    const families = new Map<string, string>()
    for (const element of edgeElements(elements)) {
      families.set(`${element.data.family}|${element.data.relation}`, element.data.sourceTable)
    }
    assert.equal(families.get('domain|ASSERTS'), 'claims')
    assert.equal(families.get('inference|PREMISE_OF'), 'inference_premises')
    assert.equal(families.get('inference|CONCLUDES'), 'inference_conclusions')
    assert.equal(families.get('claim_relation|SUPPORTS'), 'claim_relations')

    // The authored-but-unsupported conclusion must remain an inference edge, never a
    // claim-to-claim edge.
    const conclusions = edgeElements(elements).filter(
      (e) => e.data.family === 'inference' && e.data.relation === 'CONCLUDES',
    )
    assert.ok(conclusions.length > 0)
    for (const edge of conclusions) {
      assert.ok(
        edge.data.target.startsWith('claim-') || edge.data.target.startsWith('step-'),
        `an inference edge must keep its reasoning endpoint, got ${edge.data.target}`,
      )
    }
    assert.equal(
      projection.edges.filter((e) => e.family === 'inference').length > 0,
      true,
      'fixture sanity: inference edges exist',
    )
  })

  it('never collapses reasoning structure into a card-to-card edge', async () => {
    const { elements } = await adapt(richCorpus(), { depth: 2 })
    for (const edge of edgeElements(elements)) {
      const cardToCard =
        edge.data.source.startsWith('card-') && edge.data.target.startsWith('card-')
      assert.equal(
        cardToCard,
        edge.data.family === 'card_relationship',
        `only card_relationship edges may join two cards, got ${edge.data.family} ` +
          `(${edge.data.source} -> ${edge.data.target})`,
      )
    }
  })

  it('carries the source table on every edge, so a consumer knows which vocabulary it read', async () => {
    const { projection, elements } = await adapt()
    for (const edge of projection.edges) {
      const element = edgeById(elements, edge.id)
      assert.equal(element.data.sourceTable, edge.sourceTable)
      assert.notEqual(element.data.sourceTable, '', 'the projection always names a source table')
    }
  })

  it('carries an inference_step_relation vocabulary when the projection has one', async () => {
    // Depth 3 is the only depth at which a step-to-step relation appears, because it is emitted
    // when the BFS expands the `inference_step` nodes it reached at depth 2.
    const corpus = richCorpus()
    corpus.stepRelations = [
      {
        sourceInferenceStepId: 'step-1',
        targetInferenceStepId: 'step-2',
        relationType: 'CHALLENGES',
        description: 'pushes back',
      },
    ]
    const { projection, elements } = await adapt(corpus, { depth: 3 })
    const withVocabulary = projection.edges.filter((e) => 'vocabulary' in e.type)
    assert.equal(
      withVocabulary.length,
      1,
      'the fixture must produce a vocabulary-bearing edge, or this asserts nothing',
    )
    for (const edge of withVocabulary) {
      const element = edgeById(elements, edge.id)
      assert.equal(element.data.vocabulary, 'inference_step_relation_type')
      assert.equal(element.data.family, 'inference')
      assert.equal(element.data.relation, edge.type.value)
      assert.equal(element.data.sourceTable, 'inference_step_relations')
      assert.deepEqual(element.data.projectionAttributes, edge.attributes)
    }
  })

  it('keeps a step-to-step relation distinct from a premise edge with the same word', async () => {
    // `inference_step_relations` reuses relation words from other vocabularies, so the
    // projection prefixes the edge id. An adapter that keyed elements by relation word would
    // collide the two.
    const corpus = richCorpus()
    corpus.stepRelations = [
      {
        sourceInferenceStepId: 'step-1',
        targetInferenceStepId: 'step-2',
        relationType: 'DEPENDS_ON',
        description: null,
      },
    ]
    const { elements } = await adapt(corpus, { depth: 3 })
    const stepEdge = edgeElements(elements).find(
      (e) => e.data.sourceTable === 'inference_step_relations',
    )
    assert.ok(stepEdge, 'the fixture must produce a step-to-step relation')
    const premiseEdge = edgeElements(elements).find(
      (e) => e.data.sourceTable === 'inference_premises',
    )
    assert.ok(premiseEdge, 'the fixture must also produce a premise edge')
    assert.notEqual(stepEdge.data.id, premiseEdge.data.id)
    assert.equal(stepEdge.data.relation, 'DEPENDS_ON')
    assert.equal(premiseEdge.data.relation, 'PREMISE_OF')
  })

  it('omits the vocabulary key entirely when the edge has none', async () => {
    // Cytoscape drops `undefined` values from `data()`, so a key that is present-and-undefined
    // reads back as absent anyway. Asserting the key is absent here keeps the returned array
    // honest, because a consumer may inspect the array without a core.
    const { elements } = await adapt()
    for (const edge of edgeElements(elements)) {
      const hasVocabulary = edge.data.family === 'inference'
      if (!hasVocabulary) {
        assert.ok(
          !('vocabulary' in edge.data),
          `${edge.data.id} must not carry a vocabulary key`,
        )
      }
    }
  })

  it('preserves the projection attributes bag, including role and ordinal', async () => {
    const { projection, elements } = await adapt()
    for (const edge of projection.edges) {
      const element = edgeById(elements, edge.id)
      assert.deepEqual(element.data.projectionAttributes, edge.attributes)
    }
  })

  it('preserves node depth, focus flag and projected degree verbatim', async () => {
    const { projection, elements } = await adapt()
    for (const node of projection.nodes) {
      const element = nodeById(elements, node.id)
      assert.equal(element.data.depth, node.depth, `node ${node.id} depth`)
      assert.equal(element.data.isFocus, node.isFocus, `node ${node.id} isFocus`)
      assert.equal(element.data.degree, node.degree, `node ${node.id} degree`)
    }
  })

  it('preserves every node metadata bag verbatim, including card-only fields', async () => {
    // Found by mutation testing: the suite proved counts, ids, direction, family, status and
    // classification but nothing caught a dropped `metadata` bag, which is where the slug, the
    // summary and the legacy primary type live.
    const { projection, elements } = await adapt()
    for (const node of projection.nodes) {
      const element = nodeById(elements, node.id)
      assert.deepEqual(
        element.data.metadata,
        node.metadata,
        `node ${node.id} (${node.type}) metadata must survive verbatim`,
      )
    }

    const card = nodeById(elements, 'card-1')
    assert.equal(card.data.type, 'card')
    const cardMetadata = card.data.metadata as Extract<
      GraphNode,
      { type: 'card' }
    >['metadata']
    assert.equal(cardMetadata.slug, 'jesus-was-a-zionist')
    assert.equal(cardMetadata.legacyPrimaryType, 'CASE')
    // `primaryType` is legacy metadata only, and Q3/Issue #2 forbid reading it as an axis.
    assert.equal(cardMetadata.legacyPrimaryTypeIsAxis, false)

    const claimElement = nodeElements(elements).find((n) => n.data.id === 'claim-2')
    assert.ok(claimElement, 'the fixture must produce a second claim')
    const claimMetadata = claimElement.data.metadata as Extract<
      GraphNode,
      { type: 'claim' }
    >['metadata']
    assert.equal(claimMetadata.claimType, 'HISTORICAL')
    assert.equal(claimMetadata.cardId, 'card-1')
    assert.equal(claimElement.data.type, 'claim')
  })

  it('preserves the label verbatim, never truncating or synthesising one', async () => {
    const { projection, elements } = await adapt()
    for (const node of projection.nodes) {
      assert.equal(nodeById(elements, node.id).data.label, node.label)
    }
  })

  it('preserves per-node status without combining status across types', async () => {
    // Q4: `epistemic_status`, `independent_inference_status` and `evidence_status` are three
    // different columns. The adapter copies the `source` tag, so a consumer must narrow rather
    // than read one graph-wide rollup.
    const { elements } = await adapt()
    const card = nodeById(elements, 'card-1')
    assert.equal(card.data.status.source, 'epistemic_status')
    const step = nodeElements(elements).find((n) => n.data.type === 'inference_step')
    assert.ok(step, 'the fixture must produce an inference step')
    assert.equal(step.data.status.source, 'independent_inference_status')
    const taxonomy = nodeElements(elements).find((n) => n.data.type === 'collection')
    assert.ok(taxonomy, 'the fixture must produce a taxonomy node')
    assert.equal(taxonomy.data.status.source, 'none')
    assert.equal(taxonomy.data.status.value, null)
  })

  it('leaves classification absent on node types that have none', async () => {
    const { elements } = await adapt()
    for (const node of nodeElements(elements)) {
      if (node.data.type === 'card') {
        assert.ok(node.data.classification, 'a card must carry its classification')
      } else {
        assert.ok(
          !('classification' in node.data),
          `${node.data.type} node ${node.data.id} must not carry a classification key`,
        )
      }
    }
  })

  it('exposes focus, view, depth and the whole meta bag as context', async () => {
    const { projection, context } = await adapt()
    assert.deepEqual(context.focus, projection.focus)
    assert.equal(context.view, projection.view)
    assert.equal(context.depth, projection.depth)
    assert.deepEqual(context.meta, projection.meta)
    assert.ok(
      context.meta.warnings.length > 0,
      'the fixture must produce warnings, so their survival is meaningful',
    )
  })
})

describe('projection -> Cytoscape: a real cytoscape core accepts the output', () => {
  it('reports the same node and edge counts the projection declared', async () => {
    const { projection, elements } = await adapt()
    const cy = cytoscape({ headless: true, elements })
    assert.equal(cy.nodes().length, projection.nodes.length)
    assert.equal(cy.edges().length, projection.edges.length)
    assert.equal(cy.elements().length, projection.nodes.length + projection.edges.length)
  })

  it('reads direction back off a real edge, in the authored direction', async () => {
    const { projection, elements } = await adapt()
    const cy = cytoscape({ headless: true, elements })
    for (const edge of projection.edges) {
      const element = cy.getElementById(edge.id)
      assert.equal(element.source().id(), edge.from, `edge ${edge.id} source`)
      assert.equal(element.target().id(), edge.to, `edge ${edge.id} target`)
    }
  })

  it('applies the derived classes, which Cytoscape reads only at element level', async () => {
    // The taxonomy view, because `card-argument-taxonomy` deliberately excludes Concept.
    const { elements } = await adapt(richCorpus(), { view: taxonomyView })
    const cy = cytoscape({ headless: true, elements })
    const focus = cy.getElementById('card-1')
    assert.ok(focus.classes().includes('is-focus'), 'the focus must be classable')
    assert.ok(focus.classes().includes('type-card'))
    assert.ok(focus.classes().includes('status-epistemic_status'))

    const conceptEdge = edgeElements(elements).find(
      (e) => e.data.relation === 'HAS_CONCEPT',
    )
    assert.ok(conceptEdge)
    const cyEdge = cy.getElementById(conceptEdge.data.id)
    assert.ok(cyEdge.classes().includes('family-classification'))
    assert.ok(cyEdge.classes().includes('relation-HAS_CONCEPT'))
    assert.ok(cyEdge.classes().includes('traversal-bidirectional'))
  })

  it('keeps two edges between one node pair as two distinct edges', async () => {
    // `relationships` has no uniqueness on its endpoint pair, so two rows may relate the same two
    // cards and differ only by status. A representation that cannot hold that would drop
    // legitimate canonical data.
    const { projection, elements } = await adapt()
    const betweenPair = projection.edges.filter(
      (e) => e.family === 'card_relationship' && e.from === 'card-1' && e.to === 'card-2',
    )
    assert.ok(
      betweenPair.length >= 2,
      'the fixture must produce two relationships for one node pair',
    )
    const cy = cytoscape({ headless: true, elements })
    for (const edge of betweenPair) {
      assert.ok(cy.getElementById(edge.id).nonempty(), `edge ${edge.id} must survive`)
    }
  })

  it('does not mutate the element array, so one conversion can render many times', async () => {
    const { elements } = await adapt()
    const snapshot = JSON.stringify(elements)
    cytoscape({ headless: true, elements })
    cytoscape({ headless: true, elements })
    assert.equal(JSON.stringify(elements), snapshot)
  })

  it('round-trips the same data through two cores identically', async () => {
    const { elements } = await adapt()
    const dump = (cy: cytoscape.Core) =>
      JSON.stringify({
        nodes: cy
          .nodes()
          .map((n) => ({ id: n.id(), data: n.data(), classes: n.classes().sort() }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        edges: cy
          .edges()
          .map((e) => ({ id: e.id(), data: e.data(), classes: e.classes().sort() }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      })
    assert.equal(
      dump(cytoscape({ headless: true, elements })),
      dump(cytoscape({ headless: true, elements })),
    )
  })
})

describe('projection -> Cytoscape: the id contract holds without a type-qualified id', () => {
  it('never lets a node id equal an edge id, because the delimiters cannot overlap', async () => {
    // The open graph-contract question is whether `GraphNode.id` should become type-qualified.
    // This phase must not decide it. What it can do is prove the collision is impossible under
    // today's ids: node ids are `trope_graph` primary-key uuids and `buildEdgeId` always emits
    // `family|from|TYPE|to[|discriminator]`, so a node id can contain no `|`. If that ever stops
    // being true, the guard below fires and the adapter refuses rather than disambiguating.
    // Tracked as `as-truth-cards-2bq`.
    const { projection, elements } = await adapt()
    for (const node of projection.nodes) {
      assert.ok(
        !node.id.includes('|'),
        `node id "${node.id}" contains the edge-id delimiter, so it could collide`,
      )
    }
    const nodeIds = new Set(projection.nodes.map((n) => n.id))
    for (const edge of projection.edges) {
      assert.ok(!nodeIds.has(edge.id), `edge id "${edge.id}" collides with a node id`)
    }
    assert.equal(elements.length, projection.nodes.length + projection.edges.length)
  })

  it('gives every element a non-empty id, since Cytoscape would otherwise assign one', async () => {
    const { elements } = await adapt()
    for (const element of elements) {
      assert.equal(typeof element.data.id, 'string')
      assert.notEqual(element.data.id, '')
    }
  })
})

describe('projection -> Cytoscape: Axis, Locale and Collection metadata survive', () => {
  it('preserves every classification dimension, including the primary axis ordinal', async () => {
    const card = classifiedCard()
    const concept: GraphNode = {
      id: 'concept-1',
      type: 'concept',
      label: 'A concept',
      depth: 1,
      isFocus: false,
      degree: 1,
      status: { source: 'none', value: null },
      metadata: { slug: 'a-concept', description: null, definition: null },
    }
    const { elements } = toCytoscapePresentation(handProjection([card, concept], [handEdge()]))
    const element = nodeById(elements, 'card-1')

    assert.deepEqual(element.data.classification, card.classification)
    // The primary axis must survive as ordinal 0, not as a rolled-up flag, and the second axis
    // must survive alongside it.
    assert.equal(element.data.classification?.axes.length, 2)
    assert.deepEqual(element.data.classification?.axes[0], {
      axis: 'TACTIC',
      ordinal: 0,
      primary: true,
    })
    assert.equal(element.data.classification?.axes[1]?.primary, false)
    assert.deepEqual(element.data.classification?.localeSlugs, ['israel', 'south-africa'])
    assert.deepEqual(element.data.classification?.localeIds, [
      'locale-israel-id',
      'locale-south-africa-id',
    ])
    assert.deepEqual(element.data.classification?.suits, ['classic', 'zionism-coded'])
    assert.deepEqual(element.data.classification?.suitIds, [
      'suit-classic-id',
      'suit-zionism-coded-id',
    ])
    assert.deepEqual(element.data.classification?.mechanismSlugs, ['name-slur'])
  })

  it('survives a real cytoscape core, which drops undefined but keeps false and null', async () => {
    const card = classifiedCard()
    const concept: GraphNode = {
      id: 'concept-1',
      type: 'concept',
      label: 'A concept',
      depth: 1,
      isFocus: false,
      degree: 1,
      status: { source: 'none', value: null },
      metadata: { slug: 'a-concept', description: null, definition: null },
    }
    const { elements } = toCytoscapePresentation(handProjection([card, concept], [handEdge()]))
    const cy = cytoscape({ headless: true, elements })
    const data = cy.getElementById('card-1').data()

    assert.equal(data.isFocus, true)
    assert.equal(data.depth, 0)
    assert.equal(data.degree, 1)
    // `false` and `null` must survive: an axis marked non-primary, and a taxonomy node with no
    // status value, are facts rather than absences.
    const classification = data.classification
    assert.equal(classification.axes[1].primary, false)
    assert.equal(classification.axes[1].ordinal, 1)
    assert.deepEqual(classification.localeIds, ['locale-israel-id', 'locale-south-africa-id'])
    assert.equal(cy.getElementById('concept-1').data().status.value, null)
  })

  it('does not read one classification dimension to infer another', async () => {
    // The fake corpus carries a `south-africa` Suite slug and a `south-africa` Locale slug on
    // purpose. A conversion that inferred one from the other would produce a locale the card
    // never had.
    const { elements } = await adapt(richCorpus(), { view: taxonomyView })
    const classification = nodeById(elements, 'card-1').data.classification
    assert.deepEqual(classification?.suits, ['zionism'])
    assert.deepEqual(classification?.localeSlugs, ['israel', 'south-africa'])
  })

  it('keeps a Suit and a Locale that share a slug in separate fields', async () => {
    const card = classifiedCard({
      classification: {
        axes: [],
        suits: ['south-africa'],
        suitIds: ['collection-south-africa'],
        mechanismSlugs: [],
        mechanismIds: [],
        localeSlugs: ['south-africa'],
        localeIds: ['locale-south-africa'],
      },
    })
    const { elements } = toCytoscapePresentation(handProjection([card], []))
    const classification = nodeById(elements, 'card-1').data.classification
    assert.deepEqual(classification?.suits, ['south-africa'])
    assert.deepEqual(classification?.localeSlugs, ['south-africa'])
    assert.notEqual(classification?.suitIds[0], classification?.localeIds[0])
  })
})

describe('projection -> Cytoscape: determinism', () => {
  it('produces deeply equal output from repeated conversions of one projection', async () => {
    const { projection } = await adapt()
    assert.deepEqual(toCytoscapePresentation(projection), toCytoscapePresentation(projection))
    assert.deepEqual(toCytoscapeElements(projection), toCytoscapeElements(projection))
  })

  it('produces identical output for identical projections built independently', async () => {
    const first = await adapt()
    const second = await adapt()
    assert.notEqual(first.projection, second.projection, 'two distinct projection objects')
    assert.deepEqual(first.elements, second.elements)
  })

  it('emits nodes before edges, so a partially consumed array still reads correctly', async () => {
    const { projection, elements } = await adapt()
    let lastNodeIndex = -1
    for (const [index, element] of elements.entries()) {
      if (element.group === 'nodes') lastNodeIndex = index
    }
    const firstEdgeIndex = elements.findIndex((e) => e.group === 'edges')
    assert.ok(lastNodeIndex < firstEdgeIndex, 'every node must precede every edge')
    assert.equal(lastNodeIndex, projection.nodes.length - 1)
  })

  it('returns a fresh array each call, so a caller cannot mutate shared state', async () => {
    const { projection } = await adapt()
    const first = toCytoscapeElements(projection)
    const injected = first[0]
    assert.ok(injected, 'the fixture must produce an element')
    first.splice(0, first.length)
    assert.notEqual(toCytoscapeElements(projection).length, first.length)
  })
})

describe('projection -> Cytoscape: sparse projections', () => {
  it('converts a card with no claims into one node and zero edges', async () => {
    const { projection, elements } = await adaptSparse()
    assert.equal(projection.nodes.length, 1)
    assert.equal(projection.edges.length, 0)
    assert.equal(elements.length, 1)
    const [only] = elements
    assert.ok(only, 'the sparse projection must produce exactly one element')
    const element = asNode(only)
    assert.equal(element.data.id, 'card-1')
    assert.equal(element.data.degree, 0)
    assert.ok(element.classes.includes('is-focus'))
  })

  it('keeps the warnings, so an unpopulated layer stays visible', async () => {
    const { context } = await adaptSparse()
    assert.ok(context.meta.warnings.length > 0)
    assert.equal(context.meta.nodeCount, 1)
    assert.equal(context.meta.edgeCount, 0)
  })
})

describe('projection -> Cytoscape: a projection with no nodes at all', () => {
  it('accepts it and yields an empty element array', () => {
    const { elements, context } = toCytoscapePresentation(handProjection([], []))
    assert.deepEqual(elements, [])
    assert.equal(context.meta.nodeCount, 0)
    assert.equal(context.meta.edgeCount, 0)
  })

  it('is still accepted by a real cytoscape core', () => {
    const cy = cytoscape({ headless: true, elements: toCytoscapeElements(handProjection([], [])) })
    assert.equal(cy.elements().length, 0)
  })

  it('still carries the warnings', () => {
    const { context } = toCytoscapePresentation(handProjection([], []))
    assert.deepEqual(context.meta.warnings, ['a hand-built warning'])
  })
})

describe('projection -> Cytoscape: malformed input fails explicitly', () => {
  it('rejects a repeated node id, which Cytoscape would merge silently', async () => {
    const { projection } = await adapt()
    const [firstNode] = projection.nodes
    assert.ok(firstNode, 'the fixture must produce a node')
    const doubled = mutate(projection, {
      nodes: [...projection.nodes, firstNode],
      meta: { ...projection.meta, nodeCount: projection.nodes.length + 1 },
    })
    assert.throws(
      () => toCytoscapePresentation(doubled),
      (error: unknown) => {
        assert.ok(error instanceof CytoscapeAdapterError)
        assert.match(error.message, /repeats node id/)
        assert.match(error.message, /silently merge/)
        return true
      },
    )
  })

  it('rejects a repeated edge id, which Cytoscape would merge silently', async () => {
    const { projection } = await adapt()
    const doubled = mutate(projection, {
      edges: [...projection.edges, ...(projection.edges[0] ? [projection.edges[0]] : [])],
      meta: { ...projection.meta, edgeCount: projection.edges.length + 1 },
    })
    assert.throws(
      () => toCytoscapePresentation(doubled),
      (error: unknown) => {
        assert.ok(error instanceof CytoscapeAdapterError)
        assert.match(error.message, /collides with a node id/)
        return true
      },
    )
  })

  it('rejects an edge whose id equals a node id, which Cytoscape would drop silently', async () => {
    // The sharpest case. Cytoscape shares one id namespace: the node survives and the edge
    // disappears with no error, so the rendered graph would be smaller than the projection.
    const card = classifiedCard()
    const colliding = handEdge({ id: 'card-1' })
    const error = captureError(handProjection([card], [colliding]))
    assert.match(error.message, /collides with a node id/)
    assert.match(error.message, /silently discards the edge/)
    assert.match(error.message, /human decision/)

    // And the library really would have dropped it, which is why this is refused.
    const silent = cytoscape({
      headless: true,
      elements: [
        { group: 'nodes', data: { id: 'card-1' } },
        { group: 'nodes', data: { id: 'concept-1' } },
        { group: 'edges', data: { id: 'card-1', source: 'card-1', target: 'concept-1' } },
      ],
    })
    assert.equal(silent.edges().length, 0, 'cytoscape drops the edge without complaint')
    assert.equal(silent.nodes().length, 2)
  })

  it('rejects an edge whose endpoint is not in the node set', async () => {
    const card = classifiedCard()
    const dangling = handEdge({ to: 'ghost' })
    const error = captureError(handProjection([card], [dangling]))
    assert.match(error.message, /target endpoint "ghost"/)
    assert.match(error.message, /an edge may only join nodes the projection emitted/)
  })

  it('rejects an edge whose family contradicts its type family', async () => {
    // The flattening the design forbids: an edge asserting it came from one vocabulary while its
    // relation word belongs to another.
    const card = classifiedCard()
    const concept: GraphNode = {
      id: 'concept-1',
      type: 'concept',
      label: 'A concept',
      depth: 1,
      isFocus: false,
      degree: 1,
      status: { source: 'none', value: null },
      metadata: { slug: 'a-concept', description: null, definition: null },
    }
    const contradicted = handEdge({
      family: 'claim_relation',
      type: { family: 'inference', value: 'CONCLUDES' as const },
    })
    const error = captureError(handProjection([card, concept], [contradicted]))
    assert.match(error.message, /reports family "claim_relation"/)
    assert.match(error.message, /must never be flattened together/)
  })

  it('rejects an unsupported node type instead of coercing it', () => {
    const bogus = {
      ...classifiedCard(),
      type: 'trope',
    } as unknown as GraphNode
    const error = captureError(handProjection([bogus], []))
    assert.match(error.message, /unsupported type "trope"/)
  })

  it('rejects an unsupported edge family instead of coercing it', () => {
    const card = classifiedCard()
    const bogus = handEdge({ family: 'vibes' as unknown as GraphEdge['family'] })
    const error = captureError(handProjection([card], [bogus]))
    assert.match(error.message, /unsupported family "vibes"/)
  })

  it('rejects a node with no id, which Cytoscape would silently assign one to', () => {
    const error = captureError(handProjection([classifiedCard({ id: '' })], []))
    assert.match(error.message, /has no id/)
    assert.match(error.message, /losing canonical identity/)
  })

  it('rejects a node with no label, which nothing could identify on screen', () => {
    const error = captureError(handProjection([classifiedCard({ label: '' })], []))
    assert.match(error.message, /has no label/)
  })

  it('rejects non-finite depth or degree rather than rendering them', () => {
    const error = captureError(handProjection([classifiedCard({ depth: Number.NaN })], []))
    assert.match(error.message, /non-finite depth\/degree/)
  })

  it('rejects a node with no status, rather than substituting one', () => {
    const error = captureError(
      handProjection([mutateNode(classifiedCard(), { status: undefined as never })], []),
    )
    assert.match(error.message, /has no status/)
  })

  it('rejects an edge with no id, or no source table, or no endpoints', () => {
    const card = classifiedCard()
    const concept: GraphNode = {
      id: 'concept-1',
      type: 'concept',
      label: 'A concept',
      depth: 1,
      isFocus: false,
      degree: 1,
      status: { source: 'none', value: null },
      metadata: { slug: 'a-concept', description: null, definition: null },
    }
    const nodes = [card, concept]

    assert.throws(
      () => toCytoscapePresentation(handProjection(nodes, [handEdge({ id: '' })])),
      /has no id/,
    )
    assert.throws(
      () => toCytoscapePresentation(handProjection(nodes, [handEdge({ sourceTable: '' })])),
      /has no sourceTable/,
    )
    assert.throws(
      () => toCytoscapePresentation(handProjection(nodes, [handEdge({ from: '' })])),
      /has no source endpoint/,
    )
    assert.throws(
      () => toCytoscapePresentation(handProjection(nodes, [handEdge({ to: '' })])),
      /has no target endpoint/,
    )
    assert.throws(
      () =>
        toCytoscapePresentation(
          handProjection(nodes, [
            mutateEdge(handEdge(), { type: undefined as never }),
          ]),
        ),
      /has no type/,
    )
  })

  it('runs the same validation through the elements-only entry point', async () => {
    const { projection } = await adapt()
    const [firstNode] = projection.nodes
    assert.ok(firstNode, 'the fixture must produce a node')
    const doubled = mutate(projection, { nodes: [...projection.nodes, firstNode] })
    assert.throws(() => toCytoscapeElements(doubled), CytoscapeAdapterError)
  })
})

describe('projection -> Cytoscape: the adapter touches no database', () => {
  it('imports only types, and no reader, drizzle, prisma or graphology module', () => {
    // The claim "the adapter never queries the database" is otherwise untestable: a projection is
    // already a plain object, so a well-behaved adapter and one that silently opened a
    // connection would produce identical results in this suite. Asserting on the import list is
    // the check that actually fails if someone later adds a reader here. The `FakeGraphReader`
    // chain in every test above is the second half of the proof: no database exists in this
    // process at all.
    const source = readFileSync(
      fileURLToPath(new URL('../src/graph/cytoscape-adapter.ts', import.meta.url)),
      'utf8',
    )
    const imports = [...source.matchAll(/^import\s+(?:type\s+)?\{?([^}]*)\}?\s+from\s+'([^']+)'/gm)]
    const specifiers = imports.map((match) => match[2])
    assert.deepEqual(specifiers.sort(), ['./types.ts', 'cytoscape'])

    for (const forbidden of [
      'graphology',
      'drizzle',
      'prisma',
      'reader',
      'projection',
      'url.js',
      'pg',
      'postgres',
    ]) {
      assert.ok(
        !source.includes(`'${forbidden}`),
        `the adapter must not import anything from ${forbidden}`,
      )
    }
  })
})
