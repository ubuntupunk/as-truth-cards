import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { connectedComponents, degreeReport, reachableFrom } from '../src/graph/analysis'
import {
  GraphologyAdapterError,
  toGraphology,
} from '../src/graph/graphology-adapter'
import type {
  GraphologyNodeAttributes,
  TropeGraphologyGraph,
} from '../src/graph/graphology-adapter'
import { projectGraph } from '../src/graph/projection'
import type { GraphEdge, GraphProjection } from '../src/graph/types'
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
 * The Graphology adapter must be lossless.
 *
 * Driven through the real projection rather than hand-built fixtures: an adapter is only
 * trustworthy if it is proven against the shapes `projectGraph` actually emits, including the
 * awkward ones. The fake reader is reused instead of new fixtures being written, so these tests
 * cannot drift from the projection they adapt.
 *
 * The failure this guards against is subtle. Graphology indexes efficiently and silently
 * accepts plausible input, so a mapping mistake — a dropped attribute, a flattened edge family,
 * an inferred relation — shows up as a working graph with the wrong content. Every assertion
 * here is therefore about preservation, never about the adapter's own opinions.
 */

/** The v1 view under test, narrowed once so no assertion can run against `undefined`. */
const view = getGraphView('card-argument-taxonomy')!
assert.ok(view, 'card-argument-taxonomy must be registered')

/** Project a fake corpus and adapt it, the full chain a caller would run. */
async function adapt(
  corpus: FakeCorpus = richCorpus(),
  overrides: Partial<Parameters<typeof projectGraph>[1]> = {},
) {
  const projection = await projectGraph(new FakeGraphReader(corpus), {
    focus: 'card-1',
    view,
    depth: DEFAULT_DEPTH,
    maxNodes: DEFAULT_MAX_NODES,
    ...overrides,
  })
  return { projection, graph: toGraphology(projection) }
}

/**
 * The sparsest projection `projectGraph` can produce: the focus card and nothing else.
 *
 * An empty corpus cannot produce an empty projection, because the focus has to resolve or the
 * request is a 404. So the real "no data" case is one node and zero edges, and that is what
 * these tests use. A literal `nodes: []` is covered separately below as a defensive contract.
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
  return { projection, graph: toGraphology(projection) }
}

/** Re-emit a projection with one field changed, for the malformed-input cases. */
function mutate(projection: GraphProjection, changes: Partial<GraphProjection>): GraphProjection {
  return { ...projection, ...changes }
}

/**
 * The classification attribute of a card node, narrowed.
 *
 * Optional in the adapter's attribute type because non-card nodes have none, so every read has
 * to prove it is looking at a card rather than asserting `undefined` past a warning.
 */
function cardClassification(
  graph: TropeGraphologyGraph,
  nodeId: string,
): NonNullable<GraphologyNodeAttributes['classification']> {
  const classification = graph.getNodeAttribute(nodeId, 'classification')
  assert.ok(classification, `node "${nodeId}" must carry a card classification`)
  return classification
}

describe('projection -> Graphology', () => {
  it('preserves node and edge counts, exactly', async () => {
    const { projection, graph } = await adapt()
    assert.equal(graph.order, projection.nodes.length)
    assert.equal(graph.size, projection.edges.length)
    assert.equal(graph.order, projection.meta.nodeCount)
    assert.equal(graph.size, projection.meta.edgeCount)
    assert.ok(graph.order > 0, 'the fixture must actually produce nodes')
  })

  it('preserves every node id as the Graphology node key', async () => {
    const { projection, graph } = await adapt()
    assert.deepEqual([...graph.nodes()].sort(), projection.nodes.map((n) => n.id).sort())
  })

  it('preserves every edge id as the Graphology edge key', async () => {
    const { projection, graph } = await adapt()
    assert.deepEqual([...graph.edges()].sort(), projection.edges.map((e) => e.id).sort())
  })

  it('preserves direction, keeping authored from/to on every edge', async () => {
    const { projection, graph } = await adapt()
    for (const edge of projection.edges) {
      assert.equal(graph.source(edge.id), edge.from, `edge ${edge.id} source`)
      assert.equal(graph.target(edge.id), edge.to, `edge ${edge.id} target`)
    }
  })

  it('keeps traversal separate from direction, so a bidirectional edge is still directed', async () => {
    // The distinction `types.ts` insists on: `from`/`to` are authored direction, `traversal`
    // governs expansion. An adapter that modelled the bidirectional edges as undirected edges
    // would destroy the authored direction a consumer is entitled to read.
    const { projection, graph } = await adapt()
    const bidirectional = projection.edges.filter((e) => e.traversal === 'bidirectional')
    assert.ok(bidirectional.length > 0, 'the fixture must include a bidirectional edge')
    for (const edge of bidirectional) {
      assert.equal(graph.getEdgeAttribute(edge.id, 'traversal'), 'bidirectional')
    }
    const directed = projection.edges.filter((e) => e.traversal === 'directed')
    for (const edge of directed) {
      assert.equal(graph.getEdgeAttribute(edge.id, 'traversal'), 'directed')
    }
  })

  it('preserves edge family and relation, never flattening them together', async () => {
    // The whole point of the family indirection: `SUPPORTS` from two families are different
    // edges. A Graphology graph that keyed edges by relation word alone would merge them.
    const corpus = richCorpus()
    corpus.claims = [claim({ id: 'claim-1' }), claim({ id: 'claim-2' })]
    corpus.claimRelations = [
      claimRelation({ id: 'rel-1', sourceClaimId: 'claim-1', targetClaimId: 'claim-2' }),
    ]
    const { projection, graph } = await adapt(corpus, { depth: 2 })
    const supportEdges = projection.edges.filter((e) => e.type.value === 'SUPPORTS')
    for (const edge of supportEdges) {
      assert.equal(graph.getEdgeAttribute(edge.id, 'family'), edge.family)
      assert.equal(graph.getEdgeAttribute(edge.id, 'relation'), 'SUPPORTS')
      assert.equal(graph.getEdgeAttribute(edge.id, 'sourceTable'), edge.sourceTable)
    }
  })

  it('carries the source table on every edge, so a consumer knows which vocabulary it read', async () => {
    const { projection, graph } = await adapt()
    for (const edge of projection.edges) {
      assert.equal(graph.getEdgeAttribute(edge.id, 'sourceTable'), edge.sourceTable)
      assert.notEqual(edge.sourceTable, '', 'the projection always names a source table')
    }
  })

  it('carries an inference_step_relation vocabulary when the projection has one', async () => {
    const { projection, graph } = await adapt()
    const withVocabulary = projection.edges.filter((e) => 'vocabulary' in e.type)
    for (const edge of withVocabulary) {
      assert.equal(graph.getEdgeAttribute(edge.id, 'vocabulary'), 'inference_step_relation_type')
    }
  })

  it('preserves multi-valued Axis assignments, ordinals and the primary marker', async () => {
    const { projection, graph } = await adapt()
    const cards = projection.nodes.filter((n) => n.type === 'card')
    assert.ok(cards.length > 0)
    for (const card of cards) {
      if (card.type !== 'card') continue
      const classification = cardClassification(graph, card.id)
      assert.deepEqual(classification.axes, card.classification.axes)
      const primaries = card.classification.axes.filter((a) => a.ordinal === 0)
      assert.equal(
        classification.axes.filter((a: { ordinal: number }) => a.ordinal === 0).length,
        primaries.length,
        'the primary axis must survive as ordinal 0, not as a rolled-up flag',
      )
    }
  })

  it('preserves Locale assignments, including the id/slug pairing', async () => {
    const { projection, graph } = await adapt()
    const localeCard = projection.nodes.find(
      (n) => n.type === 'card' && n.classification.localeSlugs.length > 0,
    )
    assert.ok(localeCard && localeCard.type === 'card', 'the fixture sets a locale')
    const classification = cardClassification(graph, localeCard.id)
    assert.deepEqual(classification.localeSlugs, localeCard.classification.localeSlugs)
    assert.deepEqual(classification.localeIds, localeCard.classification.localeIds)
  })

  it('preserves Suit, Mechanism and Axis independently of one another', async () => {
    const { projection, graph } = await adapt()
    const card = projection.nodes.find((n) => n.type === 'card')
    assert.ok(card && card.type === 'card')
    const classification = cardClassification(graph, card.id)
    assert.deepEqual(classification.suits, card.classification.suits)
    assert.deepEqual(classification.suitIds, card.classification.suitIds)
    assert.deepEqual(classification.mechanismSlugs, card.classification.mechanismSlugs)
    assert.deepEqual(classification.mechanismIds, card.classification.mechanismIds)
  })

  it('leaves classification absent on node types that have none', async () => {
    const { projection, graph } = await adapt()
    const nonCards = projection.nodes.filter((n) => n.type !== 'card')
    for (const node of nonCards) {
      assert.equal(
        graph.hasNodeAttribute(node.id, 'classification'),
        false,
        `${node.type} must not acquire a card classification`,
      )
    }
  })

  it('preserves per-node status without combining status across types', async () => {
    // Q4: each node carries its own status variant and the variants are not assignable to one
    // another. The adapter carries them verbatim and rolls nothing up.
    const { projection, graph } = await adapt()
    for (const node of projection.nodes) {
      assert.deepEqual(graph.getNodeAttribute(node.id, 'status'), node.status)
      assert.equal(graph.getNodeAttribute(node.id, 'status').source, node.status.source)
    }
  })

  it('keeps claims and inference steps distinguishable, including by status source', async () => {
    // The reasoning structure has to survive as distinct node types, or a consumer cannot tell
    // an assertion from the step that reasons about it. Status source is the sharper check: a
    // claim's status is the `epistemic_status` enum while a step's is free text, so an adapter
    // that flattened or rolled them up would collapse two different vocabularies.
    const { projection, graph } = await adapt(richCorpus(), { depth: 3 })
    const types = new Set(projection.nodes.map((n) => n.type))
    assert.ok(types.has('claim'), 'fixture should project a claim')
    assert.ok(types.has('inference_step'), 'fixture should project an inference step')

    for (const node of projection.nodes) {
      assert.equal(graph.getNodeAttribute(node.id, 'type'), node.type)
    }

    const claim = projection.nodes.find((n) => n.type === 'claim')
    const stepNode = projection.nodes.find((n) => n.type === 'inference_step')
    assert.ok(claim && stepNode)
    assert.equal(graph.getNodeAttribute(claim.id, 'status').source, 'epistemic_status')
    assert.equal(
      graph.getNodeAttribute(stepNode.id, 'status').source,
      'independent_inference_status',
      'an inference step keeps its own status vocabulary rather than adopting the claim one',
    )
  })

  it('gives taxonomy nodes no epistemic status, so nothing is rolled up onto them', async () => {
    const { projection, graph } = await adapt()
    const taxonomy = projection.nodes.filter((n) => n.type === 'collection' || n.type === 'mechanism')
    assert.ok(taxonomy.length > 0, 'fixture should project taxonomy nodes')
    for (const node of taxonomy) {
      assert.equal(graph.getNodeAttribute(node.id, 'status').source, 'none')
    }
  })

  it('preserves evidence and source nodes as their own types', () => {
    // The whole `evidence_*` layer is schema-only with zero seeded rows, so no projection can
    // currently produce these nodes and this case is built by hand. Recording it now means the
    // adapter's evidence handling is pinned before the first evidence row exists, rather than
    // being discovered against it later.
    const projection: GraphProjection = {
      focus: { id: 'claim-1', type: 'claim', slug: null },
      view: 'card-argument-taxonomy',
      depth: 1,
      nodes: [
        {
          id: 'claim-1',
          type: 'claim',
          label: 'An assertion',
          depth: 0,
          isFocus: true,
          degree: 1,
          status: { source: 'epistemic_status', value: 'CONTESTED' },
          metadata: {
            claimType: 'HISTORICAL',
            description: null,
            cardId: 'card-1',
          },
        },
        {
          id: 'ev-1',
          type: 'evidence_item',
          label: 'A located passage',
          depth: 1,
          isFocus: false,
          degree: 1,
          // Evidence carries a fourth status vocabulary, which is exactly why these types must
          // stay apart: an adapter that coerced them to a common status would lose the fact
          // that `evidence_status` is a different column from `epistemic_status`.
          status: { source: 'evidence_status', value: 'CORROBORATED', vocabulary: 'uncontrolled' },
          metadata: {
            evidenceType: 'PRIMARY_SOURCE',
            locator: 'p. 42',
            quoteOrExcerpt: 'a quote',
            strength: 'STRONG',
          },
        },
        {
          id: 'src-1',
          type: 'source',
          label: 'A book',
          depth: 1,
          isFocus: false,
          degree: 1,
          status: { source: 'none', value: null },
          metadata: {
            title: 'A book',
            author: null,
            publisher: null,
            citation: null,
            url: null,
            sourceType: 'BOOK',
          },
        },
      ],
      edges: [
        {
          id: 'evidence_claims|ev-1|SUPPORTS|claim-1',
          family: 'domain',
          type: { family: 'domain', value: 'ASSERTS' },
          sourceTable: 'evidence_claims',
          from: 'ev-1',
          to: 'claim-1',
          attributes: {},
          traversal: 'bidirectional',
        },
      ],
      meta: {
        nodeCount: 3,
        edgeCount: 1,
        truncated: false,
        maxNodes: DEFAULT_MAX_NODES,
        reachedDepth: 1,
        warnings: [],
      },
    }
    const graph = toGraphology(projection)
    assert.equal(graph.getNodeAttribute('ev-1', 'type'), 'evidence_item')
    assert.equal(graph.getNodeAttribute('src-1', 'type'), 'source')
    assert.equal(graph.getNodeAttribute('claim-1', 'type'), 'claim')
    // Evidence is not a claim and not a card; keeping the types apart is the whole requirement.
    assert.equal(graph.getNodeAttribute('ev-1', 'status').source, 'evidence_status')
    assert.equal(graph.getNodeAttribute('claim-1', 'status').source, 'epistemic_status')
    const evidenceMetadata = graph.getNodeAttribute('ev-1', 'metadata')
    assert.ok(
      'locator' in evidenceMetadata,
      'evidence metadata must survive as evidence metadata, not widen to the node union',
    )
    assert.equal(evidenceMetadata.locator, 'p. 42')
    assert.equal(graph.getEdgeAttribute('evidence_claims|ev-1|SUPPORTS|claim-1', 'sourceTable'), 'evidence_claims')
  })

  it('preserves node depth, focus flag and projected degree verbatim', async () => {
    const { projection, graph } = await adapt()
    for (const node of projection.nodes) {
      assert.equal(graph.getNodeAttribute(node.id, 'depth'), node.depth)
      assert.equal(graph.getNodeAttribute(node.id, 'isFocus'), node.isFocus)
      assert.equal(graph.getNodeAttribute(node.id, 'degree'), node.degree)
      assert.equal(graph.getNodeAttribute(node.id, 'label'), node.label)
    }
    assert.equal(
      [...graph.nodes()].filter((id) => graph.getNodeAttribute(id, 'isFocus')).length,
      1,
      'exactly one node may be the focus',
    )
  })

  it('carries focus, view, depth and the whole meta bag onto the graph', async () => {
    const { projection, graph } = await adapt()
    assert.equal(graph.getAttribute('focusId'), projection.focus.id)
    assert.equal(graph.getAttribute('focusType'), projection.focus.type)
    assert.equal(graph.getAttribute('focusSlug'), projection.focus.slug)
    assert.equal(graph.getAttribute('view'), projection.view)
    assert.equal(graph.getAttribute('depth'), projection.depth)
    assert.deepEqual(graph.getAttribute('meta'), projection.meta)
  })

  it('preserves the edge attributes bag, including role and ordinal', async () => {
    const { projection, graph } = await adapt()
    for (const edge of projection.edges) {
      assert.deepEqual(graph.getEdgeAttribute(edge.id, 'projectionAttributes'), edge.attributes)
    }
  })

  it('keeps two edges between one node pair as two distinct edges', async () => {
    // `relationships` has no uniqueness on the endpoint pair, so parallel edges are canonical.
    // Graphology's plain `Graph` class rejects a second edge for one pair outright, which is why
    // the adapter builds a MultiDirectedGraph.
    const { projection, graph } = await adapt()
    const pairCounts = new Map<string, number>()
    for (const edge of projection.edges) {
      const key = `${edge.from}->${edge.to}`
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
    }
    // The fixture relates card-1 to card-2 twice, as CANONICAL and PROPOSED.
    const parallel = [...pairCounts.entries()].filter(([, n]) => n > 1)
    assert.equal(parallel.length, 1, 'the fixture must contain a parallel pair to be meaningful')
    assert.equal(parallel[0]?.[1], 2)

    const betweenPair = projection.edges.filter(
      (e) => `${e.from}->${e.to}` === parallel[0]?.[0],
    )
    assert.equal(
      graph.size,
      projection.edges.length,
      'a parallel pair must not be collapsed into one edge',
    )
    for (const edge of betweenPair) {
      assert.ok(graph.hasEdge(edge.id), `parallel edge ${edge.id} must survive`)
    }
  })
})

describe('projection -> Graphology: sparse projections', () => {
  it('yields a one-node, zero-edge graph for a card with no claims', async () => {
    const { projection, graph } = await adaptSparse()
    assert.equal(projection.nodes.length, 1)
    assert.equal(projection.edges.length, 0)
    assert.equal(graph.order, 1)
    assert.equal(graph.size, 0)
  })

  it('reports the isolated node with zero degree and a single component', async () => {
    const { graph } = await adaptSparse()
    const degrees = degreeReport(graph)
    assert.deepEqual(Object.values(degrees), [{ in: 0, out: 0, total: 0 }])
    assert.deepEqual(connectedComponents(graph), [[...graph.nodes()]])
  })

  it('keeps warnings, so an unpopulated layer stays visible', async () => {
    // An empty-but-valid projection is the documented way to say "this layer has no data yet".
    // Dropping the warnings here would turn that into an unexplained blank graph.
    const { projection, graph } = await adaptSparse()
    assert.ok(projection.meta.warnings.length > 0, 'the fixture should warn about unpopulated data')
    assert.deepEqual(graph.getAttribute('meta'), projection.meta)
  })
})

describe('projection -> Graphology: a projection with no nodes at all', () => {
  /**
   * `projectGraph` never returns this — the focus always yields a node — but the adapter is a
   * public function over the `GraphProjection` type, so its behaviour on the empty shape is
   * part of the contract rather than an accident. Asserted on a literal so a future view or a
   * restored cache cannot hit an undefined path.
   */
  const emptyProjection: GraphProjection = {
    focus: { id: 'nobody', type: 'card', slug: null },
    view: 'card-argument-taxonomy',
    depth: 1,
    nodes: [],
    edges: [],
    meta: {
      nodeCount: 0,
      edgeCount: 0,
      truncated: false,
      maxNodes: DEFAULT_MAX_NODES,
      reachedDepth: 0,
      warnings: ['nothing to project'],
    },
  }

  it('accepts it and yields an empty graph', () => {
    const graph = toGraphology(emptyProjection)
    assert.equal(graph.order, 0)
    assert.equal(graph.size, 0)
  })

  it('reports no degrees and no components', () => {
    const graph = toGraphology(emptyProjection)
    assert.deepEqual(degreeReport(graph), {})
    assert.deepEqual(connectedComponents(graph), [])
  })

  it('still carries the warnings onto the graph', () => {
    const graph = toGraphology(emptyProjection)
    assert.deepEqual(graph.getAttribute('meta'), emptyProjection.meta)
  })
})

describe('projection -> Graphology: malformed input fails explicitly', () => {
  it('rejects an edge whose endpoint is not in the node set', async () => {
    const { projection } = await adapt()
    const [edge] = projection.edges
    assert.ok(edge)
    const dangling: GraphEdge = { ...edge, to: 'ghost-node' }
    assert.throws(
      () => toGraphology(mutate(projection, { edges: [dangling] })),
      (err: unknown) =>
        err instanceof GraphologyAdapterError &&
        /ghost-node/.test((err as Error).message),
      'a dangling endpoint must name the missing node rather than surfacing as a Graphology error',
    )
  })

  it('rejects a repeated node id', async () => {
    const { projection } = await adapt()
    const duplicated = projection.nodes[0]
    assert.ok(duplicated)
    assert.throws(
      () => toGraphology(mutate(projection, { nodes: [...projection.nodes, duplicated] })),
      GraphologyAdapterError,
    )
  })

  it('rejects a repeated edge id', async () => {
    const { projection } = await adapt()
    const [edge] = projection.edges
    assert.ok(edge)
    assert.throws(
      () => toGraphology(mutate(projection, { edges: [edge, edge] })),
      GraphologyAdapterError,
    )
  })

  it('refuses to traverse from a node the graph does not contain', async () => {
    const { graph } = await adapt()
    assert.throws(() => reachableFrom(graph, 'ghost-node'), /no such node/)
  })
})

describe('analysis over the adapted graph', () => {
  it('reports degree per node, keyed and sorted', async () => {
    const { graph } = await adapt()
    const degrees = degreeReport(graph)
    assert.deepEqual(Object.keys(degrees), [...graph.nodes()].sort())
    for (const [nodeId, value] of Object.entries(degrees)) {
      assert.equal(value.in, graph.inDegree(nodeId))
      assert.equal(value.out, graph.outDegree(nodeId))
      assert.equal(value.total, value.in + value.out)
    }
  })

  it('finds weakly connected components covering every node exactly once', async () => {
    const { projection, graph } = await adapt()
    const components = connectedComponents(graph)
    const flattened = components.flat()
    assert.deepEqual([...flattened].sort(), projection.nodes.map((n) => n.id).sort())
    assert.equal(new Set(flattened).size, flattened.length, 'a node may appear in one component only')
    assert.deepEqual(
      components.map((c) => c[0]),
      [...components.map((c) => c[0])].sort(),
      'components must be ordered by smallest member',
    )
  })

  it('crosses a bidirectional edge from either end', async () => {
    const { projection, graph } = await adapt()
    const bidirectional = projection.edges.find((e) => e.traversal === 'bidirectional')
    assert.ok(bidirectional)
    // Every v1 family expands both ways, so a card sees the relationships pointing at it.
    assert.ok(
      reachableFrom(graph, bidirectional.to).nodeIds.includes(bidirectional.from),
      'the source of a bidirectional edge must be reachable from its target',
    )
    assert.ok(
      reachableFrom(graph, bidirectional.from).nodeIds.includes(bidirectional.to),
      'the target of a bidirectional edge must be reachable from its source',
    )
  })

  it('does not walk a directed edge backwards', async () => {
    // No v1 family emits `traversal: 'directed'` — `projection.ts` hardcodes `bidirectional`
    // because a neighbourhood that hid one direction would lie. The branch is therefore built
    // by hand here, so the adapter's directed handling stays covered against the case the
    // design says is coming rather than only against the case that exists today.
    const { projection } = await adapt()
    const template = projection.edges[0]
    assert.ok(template)
    const directed: GraphEdge = {
      ...template,
      id: 'domain|asserts|directed-only',
      traversal: 'directed',
    }
    const pairOnly: GraphProjection = mutate(
      {
        ...projection,
        nodes: projection.nodes.filter(
          (n) => n.id === directed.from || n.id === directed.to,
        ),
      },
      { edges: [directed], focus: { ...projection.focus, id: directed.to } },
    )
    const reach = reachableFrom(toGraphology(pairOnly), directed.to)
    assert.deepEqual(
      reach.nodeIds,
      [],
      'a directed edge must not be crossed from its target back to its source',
    )
    // And the same edge is still reachable from its source, so the failure above is about
    // direction rather than about the edge being dropped.
    const forward = reachableFrom(toGraphology(pairOnly), directed.from)
    assert.deepEqual(forward.nodeIds, [directed.to])
    assert.equal(forward.truncated, false)
  })

  it('bounds traversal by depth and reports the depth reached', async () => {
    const { projection, graph } = await adapt(richCorpus(), { depth: 3 })
    const focus = projection.focus.id
    const oneHop = reachableFrom(graph, focus, { maxDepth: 1 })
    const twoHops = reachableFrom(graph, focus, { maxDepth: 2 })
    assert.ok(twoHops.nodeIds.length >= oneHop.nodeIds.length)
    for (const nodeId of oneHop.nodeIds) {
      assert.ok(twoHops.nodeIds.includes(nodeId), 'a shallower walk is a subset of a deeper one')
    }
    assert.equal(reachableFrom(graph, focus, { maxDepth: 0 }).nodeIds.length, 0)
  })

  it('reports truncation only when the node cap cut the walk short', async () => {
    const { graph } = await adapt()
    const focus = [...graph.nodes()].sort()[0]
    assert.ok(focus)
    // Respecting maxDepth is honouring the request, not truncating, matching meta.truncated.
    assert.equal(reachableFrom(graph, focus, { maxDepth: 1 }).truncated, false)
    const capped = reachableFrom(graph, focus, { maxNodes: 1 })
    if (capped.nodeIds.length > 1) {
      assert.equal(capped.truncated, true)
      assert.equal(capped.nodeIds.length, 1)
    }
  })

  it('is deterministic, returning the same result for the same graph', async () => {
    const { projection, graph } = await adapt()
    const second = toGraphology(projection)
    assert.deepEqual(reachableFrom(graph, projection.focus.id), reachableFrom(second, projection.focus.id))
    assert.deepEqual(degreeReport(graph), degreeReport(second))
    assert.deepEqual(connectedComponents(graph), connectedComponents(second))
  })

  it('returns sorted ids, so two runs serialise identically', async () => {
    const { projection, graph } = await adapt()
    const reach = reachableFrom(graph, projection.focus.id)
    assert.deepEqual(reach.nodeIds, [...reach.nodeIds].sort())
    for (const component of connectedComponents(graph)) {
      assert.deepEqual(component, [...component].sort())
    }
  })
})