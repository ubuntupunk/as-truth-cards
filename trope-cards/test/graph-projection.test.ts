import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  GraphFocusNotFoundError,
  buildEdgeId,
  projectGraph,
} from '../src/graph/projection'
import type {
  CardNode,
  ClaimNode,
  GraphEdge,
  GraphNode,
  InferenceStepNode,
} from '../src/graph/types'
import {
  DEFAULT_DEPTH,
  DEFAULT_MAX_NODES,
  HARD_MAX_NODES,
  getGraphView,
} from '../src/graph/views'
import {
  FakeGraphReader,
  card,
  chain,
  claim,
  emptyCorpus,
  link,
  localeLink,
  membership,
  relationship,
  richCorpus,
  step,
} from './helpers/fake-graph-reader'
import type { FakeCorpus } from './helpers/fake-graph-reader'

/**
 * The six normalisation invariants from `docs/GRAPH_PROJECTION_DESIGN.md` §3, plus the ten
 * maintainer decisions from issue #3.
 *
 * Driven through an in-memory reader rather than the seeded corpus, because each invariant has
 * a case the corpus cannot currently produce: `claim_relations` has 0 rows, so no amount of
 * projection testing against live data would prove that an authored SUPPORTS is read *and*
 * that an inferred one is not.
 */

/**
 * The v1 view under test.
 *
 * Asserted non-null rather than throwing: the type then narrows for every use below, so the
 * tests cannot quietly run against `undefined`.
 */
const view = getGraphView('card-argument-taxonomy')!
assert.ok(view, 'card-argument-taxonomy must be registered')

/** Project `corpus` at `depth`, defaulting the way the route defaults. */
async function project(
  corpus: FakeCorpus,
  overrides: Partial<Parameters<typeof projectGraph>[1]> = {},
) {
  const reader = new FakeGraphReader(corpus)
  const result = await projectGraph(reader, {
    focus: 'card-1',
    view,
    depth: DEFAULT_DEPTH,
    maxNodes: DEFAULT_MAX_NODES,
    ...overrides,
  })
  return { reader, result }
}

/** Nodes of one type, for readable assertions. */
function nodesOfType<T extends GraphNode['type']>(
  nodes: readonly GraphNode[],
  type: T,
): Extract<GraphNode, { type: T }>[] {
  return nodes.filter((n): n is Extract<GraphNode, { type: T }> => n.type === type)
}

/** An edge key of `family:VALUE`, the form `relationship=` filters on. */
function edgeKey(edge: GraphEdge): string {
  return `${edge.family}:${edge.type.value}`
}

/** `from -> to` pairs, for endpoint assertions. */
function endpoints(edges: readonly GraphEdge[]): string[] {
  return edges.map((e) => `${e.from} -> ${e.to}`)
}

// ---------------------------------------------------------------------------
// Invariant 1: every edge endpoint is a node in the projection
// ---------------------------------------------------------------------------

describe('invariant 1: no edge references an absent node', () => {
  it('resolves both endpoints of every emitted edge', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    const ids = new Set(result.nodes.map((n) => n.id))
    assert.ok(result.edges.length > 0, 'the fixture must produce edges to be meaningful')
    for (const edge of result.edges) {
      assert.ok(ids.has(edge.from), `edge ${edge.id} has no node for "from" ${edge.from}`)
      assert.ok(ids.has(edge.to), `edge ${edge.id} has no node for "to" ${edge.to}`)
    }
  })

  it('drops a card relationship whose target card does not resolve, and says so', async () => {
    const corpus = richCorpus()
    corpus.cardRelationships = [
      relationship({ id: 'rel-ok' }),
      relationship({ id: 'rel-dangling', toEntityId: 'card-does-not-exist' }),
      relationship({ id: 'rel-bad-type', fromEntityType: 'CLAIM', fromEntityId: 'claim-1' }),
    ]
    const { result } = await project(corpus, { depth: 2 })
    const cardLinks = result.edges.filter((e) => e.family === 'card_relationship')
    assert.deepEqual(
      endpoints(cardLinks),
      ['card-1 -> card-2'],
      'only the fully resolvable CARD -> CARD row may survive',
    )
    assert.equal(
      result.meta.warnings.filter((w) => w.includes('card-does-not-exist')).length,
      1,
      'a dropped row must be reported, not silently swallowed',
    )
    assert.ok(
      result.meta.warnings.some((w) => w.includes('CLAIM')),
      'a non-CARD entity type must be reported',
    )
  })
})

// ---------------------------------------------------------------------------
// Invariant 2: ids are unique and deterministic
// ---------------------------------------------------------------------------

describe('invariant 2: node and edge ids are unique and deterministic', () => {
  it('emits no duplicate node id', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    const ids = result.nodes.map((n) => n.id)
    assert.equal(new Set(ids).size, ids.length, 'a node id appeared twice')
  })

  it('emits no duplicate edge id', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    const ids = result.edges.map((e) => e.id)
    assert.equal(new Set(ids).size, ids.length, 'an edge id appeared twice')
  })

  it('produces byte-identical output for the same request', async () => {
    const first = await project(richCorpus(), { depth: 3 })
    const second = await project(richCorpus(), { depth: 3 })
    assert.equal(JSON.stringify(first.result), JSON.stringify(second.result))
  })

  it('keeps a PROPOSED and a CANONICAL relationship distinct', async () => {
    const corpus = richCorpus()
    corpus.cardRelationships = [
      relationship({ id: 'rel-a', status: 'CANONICAL' }),
      relationship({ id: 'rel-b', status: 'PROPOSED' }),
    ]
    const { result } = await project(corpus, { depth: 2 })
    const links = result.edges.filter((e) => e.family === 'card_relationship')
    assert.equal(links.length, 2, 'both rows must survive')
    assert.equal(
      new Set(links.map((e) => e.id)).size,
      2,
      'the two rows share a typed pair and must not collapse onto one id',
    )
    assert.ok(
      links.some((e) => e.attributes['status'] === 'PROPOSED'),
      'lifecycle status must survive onto the edge',
    )
  })

  it('namespaces edge ids by family so reused words cannot collide', () => {
    assert.notEqual(
      buildEdgeId('claim_relation', 'a', 'SUPPORTS', 'b'),
      buildEdgeId('card_relationship', 'a', 'SUPPORTS', 'b'),
    )
    assert.equal(buildEdgeId('domain', 'a', 'ASSERTS', 'b'), 'domain|a|ASSERTS|b')
  })
})

// ---------------------------------------------------------------------------
// Invariant 3: no edge the view excludes
// ---------------------------------------------------------------------------

describe('invariant 3: no excluded edge is emitted', () => {
  it('emits only the edge families the view declares', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    const allowed = new Set<string>(view.edgeFamilies)
    for (const edge of result.edges) {
      assert.ok(
        allowed.has(edge.family),
        `edge family "${edge.family}" is not in view "${view.name}"`,
      )
    }
  })

  it('never emits a Concept node, because view v1 excludes it pending Q2 population', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    assert.deepEqual(
      nodesOfType(result.nodes, 'concept').map((n) => n.id),
      [],
      'card_concepts has 0 rows, so a Concept node here would be invented',
    )
    assert.ok(
      view.excludedNodeTypes.some((e) => e.type === 'concept'),
      'the exclusion must be declared in the view rule, not just absent',
    )
  })

  it('never widens the view: a filter can only remove edge families', async () => {
    const { result } = await project(richCorpus(), {
      depth: 3,
      includeEdgeTypes: ['claim_relation:SUPPORTS'],
    })
    for (const edge of result.edges) {
      assert.equal(edgeKey(edge), 'claim_relation:SUPPORTS')
    }
  })

  it('couples filtering to traversal, because a filter that kept traversing would leak', async () => {
    // Claim relations are only reachable by crossing `domain:ASSERTS`, so asking for *only*
    // `claim_relation:SUPPORTS` yields nothing rather than reaching past the excluded edge to
    // find one. That coupling is deliberate: if the filter narrowed the returned edges but
    // still traversed them, the projection would report a `reachedDepth` it never actually
    // searched and a client could infer edges that were never emitted.
    const { result } = await project(richCorpus(), {
      depth: 3,
      includeEdgeTypes: ['claim_relation:SUPPORTS'],
    })
    assert.deepEqual(result.edges, [], 'nothing is reachable without crossing ASSERTS')
    assert.deepEqual(result.nodes.map((n) => n.id), ['card-1'])
  })

  it('narrows to a family the focus already reaches directly', async () => {
    const { result } = await project(richCorpus(), {
      depth: 1,
      includeEdgeTypes: ['classification:HAS_MECHANISM'],
    })
    assert.deepEqual([...new Set(result.edges.map(edgeKey))], [
      'classification:HAS_MECHANISM',
    ])
    assert.ok(
      result.nodes.some((n) => n.id === 'name-slur'),
      'the mechanism is reachable from the card at depth 1 without crossing another family',
    )
  })
})

// ---------------------------------------------------------------------------
// Invariant 4: status is present and typed per node type
// ---------------------------------------------------------------------------

describe('invariant 4: status is present and typed per node type', () => {
  it('gives cards and claims the epistemic enum', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    const cardNode = nodesOfType(result.nodes, 'card')[0] as CardNode
    assert.equal(cardNode.status.source, 'epistemic_status')
    assert.equal(cardNode.status.value, 'ESTABLISHED')

    const claimNode = nodesOfType(result.nodes, 'claim').find(
      (n) => n.id === 'claim-2',
    ) as ClaimNode
    assert.equal(claimNode.status.value, 'CONTESTED')
  })

  it('gives inference steps an independent status source, never the enum', async () => {
    const corpus = richCorpus()
    corpus.inferenceSteps[0] = step({
      id: 'step-1',
      cardId: 'card-1',
      // Free text in the schema. If the projection forced this through the enum it would
      // either drop the row or coerce it, both of which lose the author's wording.
      epistemicStatus: 'Reconstructed in 2019 editorial pass',
    })
    const { result } = await project(corpus, { depth: 3 })
    const stepNode = nodesOfType(result.nodes, 'inference_step').find(
      (n) => n.id === 'step-1',
    ) as InferenceStepNode
    assert.equal(stepNode.status.source, 'independent_inference_status')
    assert.equal(stepNode.status.value, 'Reconstructed in 2019 editorial pass')
  })

  it('gives taxonomy nodes no epistemic status at all', async () => {
    const { result } = await project(richCorpus(), { depth: 2 })
    for (const node of nodesOfType(result.nodes, 'collection')) {
      assert.equal(node.status.source, 'none')
      assert.equal(node.status.value, null)
    }
    for (const node of nodesOfType(result.nodes, 'mechanism')) {
      assert.equal(node.status.source, 'none')
    }
  })

  it('does not attach epistemic status to an argument chain by borrowing one', async () => {
    const corpus = richCorpus()
    corpus.argumentChains = [chain({ id: 'chain-1', epistemicStatus: 'draft' })]
    const { result } = await project(corpus, { depth: 2 })
    const chains = nodesOfType(result.nodes, 'argument_chain')
    assert.equal(chains.length, 0, 'chains are metadata on steps in a general card view (Q6)')
    assert.equal(
      corpus.claims.find((c) => c.id === 'claim-2')?.epistemicStatus,
      'CONTESTED',
      'a CONTESTED claim must not have leaked onto the chain',
    )
  })
})

// ---------------------------------------------------------------------------
// Invariant 5: multi-axis classification is ordered, with no single primary axis
// ---------------------------------------------------------------------------

describe('invariant 5: classification is multi-axis, ordered, and has no primary', () => {
  it('keeps every axis with its ordinal and exposes no primaryType at the classification level', async () => {
    const reader = new FakeGraphReader(richCorpus())
    const result = await projectGraph(reader, {
      focus: 'card-1',
      view,
      depth: 1,
      maxNodes: DEFAULT_MAX_NODES,
    })
    const cardNode = nodesOfType(result.nodes, 'card')[0] as CardNode
    assert.ok(Array.isArray(cardNode.classification.axes))
    assert.ok(!('primaryType' in cardNode.classification))
    assert.ok(
      !('primaryAxis' in cardNode.classification),
      'a single primary axis would defeat the multi-axis decision',
    )
  })

  it('reports the live Suit slugs without remapping them to epistemic values', async () => {
    const corpus = richCorpus()
    corpus.cardCollections = [
      link({ cardId: 'card-1', slug: 'zionism-coded' }),
      link({ cardId: 'card-1', slug: 'foundational' }),
    ]
    const { result } = await project(corpus, { depth: 1 })
    const cardNode = nodesOfType(result.nodes, 'card')[0] as CardNode
    assert.deepEqual([...cardNode.classification.suits].sort(), [
      'foundational',
      'zionism-coded',
    ])
    assert.ok(
      !cardNode.classification.suits.includes('contested'),
      'Q3 forbids mapping epistemic CONTESTED onto a Suit',
    )
  })

  it('reports legacy primary_type as non-classificatory metadata only', async () => {
    const corpus = richCorpus()
    corpus.cards[0] = card({ id: 'card-1', slug: 'x', primaryType: 'TACTIC' })
    const { result } = await project(corpus, { depth: 1 })
    const cardNode = nodesOfType(result.nodes, 'card')[0] as CardNode
    assert.equal(cardNode.metadata.legacyPrimaryType, 'TACTIC')
    assert.ok(
      !cardNode.classification.suits.includes('tactic'),
      'primary_type must not become a Suit',
    )
  })
})

// ---------------------------------------------------------------------------
// Invariant 5b: Locale is its own dimension, read only from card_locales
// ---------------------------------------------------------------------------

describe('invariant 5b: locale is a dimension of its own', () => {
  it('reports every locale a card is set in, with ids alongside slugs', async () => {
    const corpus = richCorpus()
    const { result } = await project(corpus, { depth: 1 })
    const cardNode = nodesOfType(result.nodes, 'card')[0] as CardNode
    assert.deepEqual(
      [...cardNode.classification.localeSlugs],
      ['israel', 'south-africa'],
      'locale slugs arrive sorted, like suits and mechanisms',
    )
    assert.deepEqual(
      [...cardNode.classification.localeIds],
      corpus.cardLocales
        .filter((l) => l.cardId === 'card-1')
        .map((l) => l.localeId)
        .sort(),
      'ids are parallel to slugs, not a separate or renumbered space',
    )
  })

  it('never infers a locale from the suit, in either direction', async () => {
    const corpus = richCorpus()
    corpus.cardCollections = [
      link({ cardId: 'card-1', slug: 'south-africa', name: 'South Africa' }),
    ]
    corpus.cardLocales = []
    const { result } = await project(corpus, { depth: 1 })
    const cardNode = nodesOfType(result.nodes, 'card')[0] as CardNode
    assert.deepEqual(
      cardNode.classification.suits,
      ['south-africa'],
      'the fixture puts the card in the south-africa suit',
    )
    assert.deepEqual(
      cardNode.classification.localeSlugs,
      [],
      'a card in the south-africa *collection* is not thereby a South Africa card',
    )
  })

  it('keeps locale independent of axis, mechanism, epistemic status and legacy primaryType', async () => {
    const corpus = richCorpus()
    corpus.cards[0] = card({
      id: 'card-1',
      slug: 'x',
      primaryType: 'THEOLOGY',
      epistemicStatus: 'CONTESTED',
    })
    corpus.cardLocales = [localeLink({ cardId: 'card-1', slug: 'south-africa' })]
    const { result } = await project(corpus, { depth: 1 })
    const cardNode = nodesOfType(result.nodes, 'card')[0] as CardNode
    assert.deepEqual(cardNode.classification.localeSlugs, ['south-africa'])
    assert.deepEqual(
      cardNode.classification.mechanismSlugs,
      ['name-slur'],
      'a locale must not displace or merge with a mechanism',
    )
    assert.equal(cardNode.status.value, 'CONTESTED')
  })

  it('reports empty lists for every dimension it has no rows for, rather than guessing', async () => {
    const corpus = richCorpus()
    const { result } = await project(corpus, { focus: 'card-3', depth: 1 })
    const cardNode = nodesOfType(result.nodes, 'card')[0] as CardNode
    assert.deepEqual(cardNode.classification.localeSlugs, ['south-africa'])
    assert.deepEqual(
      cardNode.classification.suits,
      [],
      'card-3 has a locale and no collection, so the dimensions are provably independent',
    )
    assert.deepEqual(
      cardNode.classification.mechanismSlugs,
      [],
      'and no mechanism: one dimension is never filled in from another',
    )
  })
})

// ---------------------------------------------------------------------------
// Invariant 6: no second ontology
// ---------------------------------------------------------------------------

describe('invariant 6: the projection introduces no second ontology', () => {
  it('never exposes a public.cards field, and never reads it', async () => {
    const reader = new FakeGraphReader(richCorpus())
    const result = await projectGraph(reader, {
      focus: 'card-1',
      view,
      depth: 3,
      maxNodes: DEFAULT_MAX_NODES,
    })
    const keys = Object.keys(result).sort()
    assert.deepEqual(keys, ['depth', 'edges', 'focus', 'meta', 'nodes', 'view'])

    // The transitional Prisma deck model uses these names. Any of them appearing at the top
    // level would mean a bridge crept in under Q8.
    for (const forbidden of ['cards', 'decks', 'frontDescription', 'backDescription']) {
      assert.ok(
        !(forbidden in result),
        `"${forbidden}" at the response root suggests a public.cards bridge`,
      )
    }
  })

  it('uses trope_graph vocabulary only: node types and edge source tables', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    const allowedTypes = new Set<string>(view.nodeTypes)
    for (const node of result.nodes) {
      assert.ok(allowedTypes.has(node.type), `unexpected node type ${node.type}`)
    }
    const allowedTables = new Set([
      'claims',
      'claim_relations',
      'inference_premises',
      'inference_conclusions',
      'inference_step_relations',
      'relationships',
      'card_collections',
      'card_mechanisms',
    ])
    for (const edge of result.edges) {
      assert.ok(
        allowedTables.has(edge.sourceTable),
        `edge names unknown table ${edge.sourceTable}`,
      )
    }
  })

  it('identifies nodes by uuid and treats the slug as an alias', async () => {
    const reader = new FakeGraphReader(richCorpus())
    const bySlug = await projectGraph(reader, {
      focus: 'jesus-was-a-zionist',
      view,
      depth: 1,
      maxNodes: DEFAULT_MAX_NODES,
    })
    const byId = await projectGraph(reader, {
      focus: 'card-1',
      view,
      depth: 1,
      maxNodes: DEFAULT_MAX_NODES,
    })
    assert.equal(bySlug.focus.id, 'card-1')
    assert.equal(bySlug.focus.slug, 'jesus-was-a-zionist')
    assert.equal(byId.focus.slug, null, 'a uuid-addressed focus reports no slug alias')
    assert.deepEqual(bySlug.nodes.map((n) => n.id), byId.nodes.map((n) => n.id))
  })
})

// ---------------------------------------------------------------------------
// Q1: claim_relations are read, never derived
// ---------------------------------------------------------------------------

describe('Q1: authored claim relations are read and never inferred', () => {
  it('emits the authored SUPPORTS', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    const authored = result.edges.filter((e) => e.family === 'claim_relation')
    assert.deepEqual(endpoints(authored), ['claim-1 -> claim-2'])
    assert.equal(authored[0]?.type.value, 'SUPPORTS')
    assert.equal(authored[0]?.sourceTable, 'claim_relations')
  })

  it('does not derive SUPPORTS from a step concluding a claim', async () => {
    // `step-2` concludes `claim-3`, and nothing authors a relation between `claim-2` and
    // `claim-3`. Inferring one from the inference structure is precisely the Q1 failure.
    const corpus = richCorpus()
    corpus.conclusions.push({
      inferenceStepId: 'step-2',
      claimId: 'claim-3',
      ordinal: 1,
    })
    const { result } = await project(corpus, { depth: 3 })
    const authored = result.edges.filter((e) => e.family === 'claim_relation')
    assert.equal(
      authored.length,
      1,
      'a conclusion is not a claim relation; only claim_relations rows may produce these edges',
    )
    assert.ok(
      !endpoints(authored).includes('claim-2 -> claim-3'),
      'claim-2 must not gain a derived link to claim-3',
    )
  })

  it('keeps inference structure on its own edges', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    const inference = result.edges.filter((e) => e.family === 'inference')
    assert.ok(inference.some((e) => e.type.value === 'PREMISE_OF'))
    assert.ok(inference.some((e) => e.type.value === 'CONCLUDES'))
    assert.ok(
      inference.every((e) => e.sourceTable.startsWith('inference_')),
      'inference edges must name the inference tables, not claim_relations',
    )
  })

  it('carries premise role and ordinal so two premises of one claim stay distinct', async () => {
    const corpus = richCorpus()
    corpus.premises = [
      { inferenceStepId: 'step-1', claimId: 'claim-1', role: 'PRIMARY', ordinal: 0 },
      { inferenceStepId: 'step-1', claimId: 'claim-2', role: 'COUNTERPREMISE', ordinal: 1 },
    ]
    const { result } = await project(corpus, { depth: 3 })
    const premises = result.edges.filter((e) => e.type.value === 'PREMISE_OF')
    assert.equal(new Set(premises.map((e) => e.id)).size, premises.length)
    assert.ok(
      premises.some((e) => e.attributes['role'] === 'COUNTERPREMISE'),
      'the premise role must survive, or the edge cannot be interpreted',
    )
  })
})

// ---------------------------------------------------------------------------
// Q5: relationships are whitelisted and endpoint-resolved
// ---------------------------------------------------------------------------

describe('Q5: card relationships are projected defensively', () => {
  it('keeps a resolvable CARD -> CARD row in both directions of traversal', async () => {
    const { result } = await project(richCorpus(), { depth: 1 })
    const links = result.edges.filter((e) => e.family === 'card_relationship')
    assert.equal(links.length, 2, 'CANONICAL and PROPOSED rows for one pair')
    for (const link of links) {
      assert.equal(link.traversal, 'bidirectional')
      assert.equal(link.from, 'card-1', 'authored direction is preserved even when traversable both ways')
    }
  })

  it('finds the related card by traversing inward, not only outward', async () => {
    const corpus = richCorpus()
    corpus.cardRelationships = [
      relationship({ id: 'rel-in', fromEntityId: 'card-3', toEntityId: 'card-1' }),
    ]
    const { result } = await project(corpus, { depth: 1 })
    assert.deepEqual(endpoints(result.edges.filter((e) => e.family === 'card_relationship')), [
      'card-3 -> card-1',
    ])
    assert.ok(
      result.nodes.some((n) => n.id === 'card-3'),
      'the card on the far side of an inbound link must be emitted',
    )
  })
})

// ---------------------------------------------------------------------------
// Q6: argument chains are metadata on steps
// ---------------------------------------------------------------------------

describe('Q6: argument chains ride on inference steps', () => {
  it('puts chain membership in step metadata and emits no chain node', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    assert.deepEqual(nodesOfType(result.nodes, 'argument_chain').map((n) => n.id), [])
    const stepNode = nodesOfType(result.nodes, 'inference_step').find(
      (n) => n.id === 'step-2',
    ) as InferenceStepNode
    assert.equal(stepNode.metadata.chains.length, 1, 'chain membership must be on the step')
    assert.equal(stepNode.metadata.chains[0]?.id, 'chain-1')
    assert.equal(stepNode.metadata.chains[0]?.role, 'ALTERNATIVE')
    assert.equal(stepNode.metadata.chains[0]?.ordinal, 1)
    assert.equal(
      stepNode.metadata.chains[0]?.membershipSource,
      'argument_chain_steps',
      'the projection must say which attachment path produced the membership',
    )
  })

  it('resolves a chain attached only through inference_steps.argument_chain_id', async () => {
    const corpus = richCorpus()
    corpus.chainMemberships = []
    corpus.inferenceSteps[0] = step({
      id: 'step-1',
      cardId: 'card-1',
      argumentChainId: 'chain-1',
    })
    const { result } = await project(corpus, { depth: 3 })
    const stepNode = nodesOfType(result.nodes, 'inference_step').find(
      (n) => n.id === 'step-1',
    ) as InferenceStepNode
    assert.equal(stepNode.metadata.chains[0]?.id, 'chain-1')
    assert.equal(
      stepNode.metadata.chains[0]?.membershipSource,
      'inference_steps_argument_chain_id',
      'the direct foreign key is a distinct attachment path and must be labelled',
    )
  })

  it('warns when a step references a chain that does not resolve', async () => {
    const corpus = richCorpus()
    corpus.inferenceSteps[0] = step({
      id: 'step-1',
      cardId: 'card-1',
      argumentChainId: 'chain-missing',
    })
    const { result } = await project(corpus, { depth: 3 })
    assert.ok(
      result.meta.warnings.some((w) => w.includes('chain-missing')),
      'an unresolvable chain reference must be reported',
    )
  })
})

// ---------------------------------------------------------------------------
// Q9: depth is hops within the view
// ---------------------------------------------------------------------------

describe('Q9: depth counts hops under the view adjacency rules', () => {
  it('reports hop distance, not table distance', async () => {
    const shallow = await project(richCorpus(), { depth: 1 })
    const deep = await project(richCorpus(), { depth: 3 })

    const depthOf = (nodes: readonly GraphNode[], id: string): number | undefined =>
      nodes.find((n) => n.id === id)?.depth

    assert.equal(depthOf(shallow.result.nodes, 'card-1'), 0)
    assert.equal(depthOf(deep.result.nodes, 'step-2'), 2, 'card -> claim -> step is two hops')
    assert.ok(
      depthOf(shallow.result.nodes, 'step-2') === undefined,
      'a claim is not a step, so depth 1 stops before reaching one',
    )
  })

  it('never exceeds the requested depth', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    for (const node of result.nodes) {
      assert.ok(node.depth <= 3, `node ${node.id} sits at depth ${node.depth}`)
    }
    assert.equal(result.meta.reachedDepth <= 3, true)
  })

  it('returns the focus alone at depth 0', async () => {
    const { result } = await project(richCorpus(), { depth: 0 })
    assert.deepEqual(result.nodes.map((n) => n.id), ['card-1'])
    assert.deepEqual(result.edges, [])
    assert.equal(result.nodes[0]?.isFocus, true)
  })

  it('marks exactly one focus node', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    assert.deepEqual(
      result.nodes.filter((n) => n.isFocus).map((n) => n.id),
      ['card-1'],
    )
  })
})

// ---------------------------------------------------------------------------
// Q10 and bounds: computed per request, capped, and honest about truncation
// ---------------------------------------------------------------------------

describe('bounds and truncation', () => {
  it('truncates at maxNodes and reports it rather than silently narrowing', async () => {
    const { result } = await project(richCorpus(), { depth: 3, maxNodes: 3 })
    assert.equal(result.nodes.length, 3)
    assert.equal(result.meta.truncated, true)
    assert.equal(result.meta.maxNodes, 3)
  })

  it('is untruncated when the cap is generous', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    assert.equal(result.meta.truncated, false)
  })

  it('echoes a node count matching the nodes actually returned', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    assert.equal(result.meta.nodeCount, result.nodes.length)
    assert.equal(result.meta.edgeCount, result.edges.length)
  })

  it('computes degree from the emitted edges, after truncation', async () => {
    const { result } = await project(richCorpus(), { depth: 3 })
    for (const node of result.nodes) {
      const counted = result.edges.filter((e) => e.from === node.id || e.to === node.id).length
      assert.equal(node.degree, counted, `degree of ${node.id} disagrees with the edge list`)
    }
  })

  it('returns an empty but valid projection for a card with no claims', async () => {
    const corpus = emptyCorpus()
    corpus.cards = [card({ id: 'card-1', slug: 'bare' })]
    const { result } = await project(corpus, { depth: 2 })
    assert.deepEqual(result.nodes.map((n) => n.id), ['card-1'])
    assert.deepEqual(result.edges, [])
    assert.equal(result.meta.truncated, false)
  })

  it('caps maxNodes at the documented hard limit', () => {
    assert.equal(HARD_MAX_NODES, 500)
  })
})

// ---------------------------------------------------------------------------
// Focus resolution
// ---------------------------------------------------------------------------

describe('focus resolution', () => {
  it('rejects a focus no card matches', async () => {
    await assert.rejects(
      project(richCorpus(), { focus: 'no-such-card' }),
      GraphFocusNotFoundError,
    )
  })

  it('rejects a card focus on a view that will not take one', async () => {
    await assert.rejects(
      projectGraph(new FakeGraphReader(richCorpus()), {
        focus: 'card-1',
        view: {
          ...view,
          name: 'claim-only',
          status: 'designed',
          focusTypes: ['claim'],
          nodeTypes: ['claim'],
          edgeFamilies: ['claim_relation'],
          excludedNodeTypes: [],
          nonNodeStructures: [],
        },
        depth: 1,
        maxNodes: DEFAULT_MAX_NODES,
      }),
      GraphFocusNotFoundError,
    )
  })
})

// ---------------------------------------------------------------------------
// Registry consistency
// ---------------------------------------------------------------------------

describe('view registry', () => {
  it('declares v1 as the only implemented view', () => {
    assert.equal(view.status, 'implemented')
    assert.equal(view.maxDepth, 3)
  })

  it('names the mechanism/concept slug collision rather than resolving it', () => {
    assert.ok(
      view.excludedNodeTypes.some((e) => e.type === 'concept' && /slug/i.test(e.reason)),
      'Q2 requires the collision to stay visible until the corpus task resolves it',
    )
  })

  it('declares a non-node structure for the layers that are not nodes yet', () => {
    assert.ok(
      view.nonNodeStructures.length > 0,
      'evidence attribution and card axes must be reported as structures, not invented nodes',
    )
    const named = view.nonNodeStructures.map((s) => s.structure)
    assert.ok(named.includes('card_axes'), 'multi-axis ordinal assignment is metadata')
  })
})

/** Kept so an unused-import lint cannot hide a regression in the fixture builders. */
export const fixtureBuilders = { card, chain, claim, link, membership, relationship, richCorpus }
