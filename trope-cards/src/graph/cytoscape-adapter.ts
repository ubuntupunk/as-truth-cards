/**
 * Cytoscape adapter: domain projection to a deterministic presentation element array.
 *
 * The adapter is the last seam in Issue #3's pipeline — `canonical Postgres/Drizzle → domain
 * projection → Graphology (optional analysis) → Cytoscape`. It consumes exactly one thing, the
 * `{ focus, view, depth, nodes, edges, meta }` contract from `types.ts`, and it reads no
 * database. Cytoscape is a presentation consumer and nothing more: no element is created,
 * dropped, merged or rewritten beyond the field-for-field mapping documented here, no ontology
 * is consulted, and no Cytoscape type reaches the API contract or the projection.
 *
 * ## Pure conversion, no core instance
 *
 * The output is a plain `cytoscape.ElementDefinition[]` — the flat array `cytoscape({elements})`
 * consumes — rather than a `cytoscape.Core`. Three reasons, all forced:
 *
 * - A core needs a `container` (a DOM element) or `headless: true`. Requiring either would drag
 *   a rendering concern into a module that has no business holding one, and would make the
 *   adapter untestable in Node without a DOM shim.
 * - Cytoscape mutates nothing in the definitions it is handed (verified, not assumed — see
 *   `test/cytoscape-adapter.test.ts`), so the array this module returns is exactly what the
 *   core receives, and a caller can convert once and render many times.
 * - Nothing in the conversion is lost by deferring instantiation: `elements` is the whole
 *   contract.
 *
 * ## Why the id validation here is not paranoia
 *
 * Cytoscape's failure mode for duplicate ids is **silent**, and it was measured against
 * 3.34.3 rather than assumed:
 *
 * | input | result |
 * |---|---|
 * | two nodes sharing an id | merged into one node, no error |
 * | two edges sharing an id | merged into one edge, no error |
 * | a node id equal to an edge id | the **edge is dropped entirely** |
 * | an edge pointing at an absent node | throws `Can not create edge ...` |
 *
 * Graphology rejects duplicates loudly, so `graphology-adapter.ts` gets those guards almost for
 * free. Cytoscape does not: a projection bug that reused a node id would render a smaller graph
 * and nothing would fail. Every guard below exists to turn that into a throw, because "the view
 * quietly shows fewer nodes than the projection emitted" is the exact failure this phase forbids.
 *
 * The cross-kind collision is the sharp one, and it is also the reason the adapter does not
 * need to solve the outstanding type-qualified `GraphNode` id question. `types.ts` fixes node
 * ids to `trope_graph` primary-key uuids while `buildEdgeId` always emits
 * `family|from|TYPE|to[|discriminator]`. A uuid contains no `|`, so a node id and an edge id
 * cannot be equal by construction — `test/cytoscape-adapter.test.ts` pins that invariant rather
 * than leaving it to this comment. If the id contract ever changes to something type-qualified
 * and a real collision appears, the correct response is to stop and report (Issue #3), not to
 * disambiguate ids inside a presentation adapter. Tracked as `as-truth-cards-2bq`.
 *
 * ## Semantic identity vs presentation metadata
 *
 * Issue #3 requires the split to be explicit, so it is enforced by which field of the element a
 * value lands in:
 *
 * - **Inside `data`** — semantic identity, copied verbatim: `id`, `type`, `label`, `depth`,
 *   `isFocus`, `degree`, `status`, `classification`, `metadata` on nodes; `source`, `target`,
 *   `family`, `relation`, `vocabulary`, `sourceTable`, `traversal`, `projectionAttributes` on
 *   edges. These are what a consumer asserts on, and none of them is renamed or flattened.
 * - **In element-level `classes`** — presentation metadata, derived and disposable: a
 *   stylesheet hook per node type, focus marker, status source, edge family, relation and
 *   traversal. Cytoscape reads `classes` at the element level only (a `classes` key placed
 *   inside `data` is silently ignored), and nothing semantic is stored there, so a stylesheet
 *   can be rewritten without touching meaning.
 *
 * ## Prohibitions
 *
 * - No database access. The adapter's only parameter is an already-computed projection.
 * - No second graph representation. There is no parallel node/edge model to drift out of step.
 * - No inference at render time. No relation is derived, no endpoint invented, no node type
 *   coerced into another type to make a layout work.
 * - No direction rewriting. `source`/`to` is always the authored direction; a
 *   `traversal: 'bidirectional'` edge stays a single directed Cytoscape edge and carries the
 *   walk rule as data, matching `graphology-adapter.ts`.
 * - No view knowledge. Neither `taxonomy` nor `card-argument-taxonomy` appears in this module,
 *   so a future projection is consumable without touching it.
 * - Malformed input fails loudly with {@link CytoscapeAdapterError} rather than being coerced
 *   into a partial graph.
 */

import type { EdgeDefinition, NodeDefinition } from 'cytoscape'

import type {
  EdgeFamily,
  GraphEdge,
  GraphNode,
  GraphNodeType,
  GraphProjection,
  GraphProjectionMeta,
} from './types.ts'

/**
 * Node element data: the semantic identity of a {@link GraphNode}, minus `id` bookkeeping.
 *
 * `id` is included because Cytoscape requires it on every element; it is the node's key and is
 * never rewritten. Everything else is carried by reference, because the projection is treated
 * as immutable.
 */
export type CytoscapeNodeData = {
  /** Canonical `trope_graph` primary-key uuid, preserved exactly. */
  readonly id: string
  /** Canonical node type: `card`, `claim`, `inference_step`, `concept`, … */
  readonly type: GraphNodeType
  /** Display label, verbatim. Never a synthetic or truncated string. */
  readonly label: string
  /** Hop distance from the projection's focus, as the projection measured it. */
  readonly depth: number
  readonly isFocus: boolean
  /** Cardinality the projection reported, not a recomputed one. */
  readonly degree: number
  /**
   * Per-type status, verbatim including its `source` tag.
   *
   * Never combined across types (Q4): a stylesheet or consumer that wants epistemic status must
   * narrow on `status.source` rather than reading one rollup.
   */
  readonly status: GraphNode['status']
  /** Card-only classification, including Axis and Locale. Absent on every other node type. */
  readonly classification?: Extract<
    GraphNode,
    { type: 'card' }
  >['classification']
  /** The type-specific metadata bag, verbatim. */
  readonly metadata: GraphNode['metadata']
}

/**
 * Edge element data: the semantic identity of a {@link GraphEdge}.
 *
 * `family` and `relation` stay separate fields rather than one `SUPPORTS` string, because
 * `claim_relation: SUPPORTS` and `card_relationship: SUPPORTS` are different relations with
 * different endpoints and different authority. Presenting them as a single edge type is the
 * collapse Issue #3 forbids, so no consumer can be handed an edge whose family it cannot see.
 */
export type CytoscapeEdgeData = {
  /** The deterministic `buildEdgeId` composite, preserved exactly. */
  readonly id: string
  /** Authored direction. Never swapped to mean "traversable". */
  readonly source: string
  /** Authored direction. Never swapped to mean "traversable". */
  readonly target: string
  /** Which vocabulary produced the relation word, e.g. `inference` or `claim_relation`. */
  readonly family: EdgeFamily
  /** The relation word. Meaningless without `family`, which is why both are carried. */
  readonly relation: GraphEdge['type']['value']
  /** Vocabulary discriminator; present only for `inference_step_relations`. */
  readonly vocabulary?: 'inference_step_relation_type'
  /** The canonical table the relation word came from. */
  readonly sourceTable: string
  /** Whether traversal may cross this edge both ways, independently of `source`/`target`. */
  readonly traversal: GraphEdge['traversal']
  /** The projection's edge attributes (`role`, `ordinal`, …), verbatim. */
  readonly projectionAttributes: GraphEdge['attributes']
}

/**
 * A node as Cytoscape consumes it.
 *
 * `classes` sits at element level, not inside `data`, because that is the only place Cytoscape
 * reads it from.
 */
export type CytoscapeNodeElement = NodeDefinition & {
  readonly group: 'nodes'
  readonly data: CytoscapeNodeData
  readonly classes: readonly string[]
}

/** An edge as Cytoscape consumes it. */
export type CytoscapeEdgeElement = EdgeDefinition & {
  readonly group: 'edges'
  readonly data: CytoscapeEdgeData
  readonly classes: readonly string[]
}

/** Either element, discriminated on `group`, which Cytoscape treats as authoritative. */
export type CytoscapeElement = CytoscapeNodeElement | CytoscapeEdgeElement

/**
 * Graph-level context that has no home inside a Cytoscape element.
 *
 * Cytoscape has no graph-level attribute bag — `graphology-adapter.ts` used `mergeAttributes`
 * for this — so `focus`, `view`, `depth` and the whole `meta` bag travel beside `elements`.
 * Without this a renderer could not tell a small graph from a capped one, nor show the warnings
 * that make an unpopulated layer distinguishable from a broken request.
 */
export type CytoscapeContext = {
  readonly focus: GraphProjection['focus']
  readonly view: string
  readonly depth: number
  readonly meta: GraphProjectionMeta
}

/**
 * A complete, self-describing presentation payload for one projection.
 *
 * `elements` is a mutable array on purpose, and it is the only mutable thing here: Cytoscape's
 * own option type demands `ElementDefinition[]`, so a `readonly` array would not be assignable
 * and every caller would have to copy it before rendering. The array is fresh per call, so
 * mutating it cannot corrupt a later conversion. Every field *inside* an element stays readonly.
 */
export type CytoscapePresentation = {
  /** Pass straight to `cytoscape({ elements })`. */
  readonly elements: CytoscapeElement[]
  readonly context: CytoscapeContext
}

/**
 * Raised when a projection cannot be represented faithfully as Cytoscape elements.
 *
 * Always a bug in the projection or in a caller, never a condition to recover from. Each cause
 * corresponds to a silent data-loss path in Cytoscape itself; see the module docstring.
 */
export class CytoscapeAdapterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CytoscapeAdapterError'
  }
}

/**
 * Node types this adapter can present.
 *
 * Typed as a `Set` of the domain union so that adding a `GraphNodeType` fails
 * `typecheck:graph` until the adapter is updated. That compile error is the mechanism behind
 * "a future projection should be consumable without changing Cytoscape-specific code": a new
 * node type is impossible to introduce into the projection without the adapter being asked about
 * it. No per-type behaviour exists here — the set exists to reject unknown types, not to switch
 * on them.
 */
const SUPPORTED_NODE_TYPES: ReadonlySet<string> = new Set<GraphNodeType>([
  'card',
  'claim',
  'inference_step',
  'argument_chain',
  'collection',
  'mechanism',
  'concept',
  'source',
  'evidence_item',
  'case',
  'interpretation',
  'question',
])

/** Edge families this adapter can present. Same compile-time role as the node-type set. */
const SUPPORTED_EDGE_FAMILIES: ReadonlySet<string> = new Set<EdgeFamily>([
  'domain',
  'claim_relation',
  'inference',
  'card_relationship',
  'classification',
  'source',
  'evidence',
])

/**
 * Convert a domain projection into a Cytoscape presentation payload.
 *
 * Lossless with respect to the projection: same nodes, same edges, same ids, same directions,
 * same attributes, same counts. An empty projection is valid and yields an empty array — a card
 * with no claims is a fact, not a failure — and only genuinely malformed input throws.
 *
 * Pure and deterministic: same input, byte-identical output, with no database access and no
 * Cytoscape core instantiated. Calling it twice yields deeply equal payloads.
 *
 * @param projection The output of `projectGraph`, used as-is; never re-queried.
 * @returns `{ elements, context }`, where `elements` is the flat array `cytoscape({elements})`
 * accepts and `context` carries `focus`, `view`, `depth` and `meta`.
 * @throws {CytoscapeAdapterError} If a node or edge is missing required fields or carries an
 * unknown type/family; if a node id, an edge id, or a node id and edge id collide; if an edge
 * references an endpoint absent from `projection.nodes`; or if an edge's `type.family`
 * contradicts its `family` field.
 * @example
 * ```ts
 * const { elements, context } = toCytoscapePresentation(projection)
 * const cy = cytoscape({ container, elements })
 * cy.nodes().length === context.meta.nodeCount
 * ```
 */
export function toCytoscapePresentation(
  projection: GraphProjection,
): CytoscapePresentation {
  const nodeElements: CytoscapeNodeElement[] = []
  const edgeElements: CytoscapeEdgeElement[] = []
  const nodeIds = new Set<string>()
  /** Every id handed to Cytoscape, of either kind, because one namespace. */
  const allIds = new Set<string>()

  for (const node of projection.nodes) {
    assertUsableNode(node)
    if (nodeIds.has(node.id)) {
      throw new CytoscapeAdapterError(
        `projection repeats node id "${node.id}"; node ids must be unique ` +
          '(Cytoscape would silently merge the two into one node)',
      )
    }
    nodeIds.add(node.id)
    allIds.add(node.id)
    nodeElements.push(toNodeElement(node))
  }

  for (const edge of projection.edges) {
    assertUsableEdge(edge)
    if (allIds.has(edge.id)) {
      // This is the dangerous branch. A node already owns the id, and Cytoscape shares one id
      // namespace across nodes and edges: the edge would be dropped without an error.
      throw new CytoscapeAdapterError(
        `edge id "${edge.id}" collides with a node id of the same name; Cytoscape keeps the ` +
          'node and silently discards the edge. Node ids are uuids and edge ids are ' +
          'family|from|TYPE|to composites, so they cannot be equal by construction — a ' +
          'collision means the graph id contract changed and needs a human decision, not an ' +
          'adapter workaround',
      )
    }
    allIds.add(edge.id)
    // Checked here so the failure names the edge and its endpoint, instead of surfacing as
    // Cytoscape's "Can not create edge" for a node the projection never claimed to emit.
    for (const [role, endpoint] of [
      ['source', edge.from],
      ['target', edge.to],
    ] as const) {
      if (!nodeIds.has(endpoint)) {
        throw new CytoscapeAdapterError(
          `edge "${edge.id}" has ${role} endpoint "${endpoint}", which is not in the ` +
            `projection's ${projection.nodes.length} node(s); an edge may only join nodes ` +
            'the projection emitted',
        )
      }
    }
    edgeElements.push(toEdgeElement(edge))
  }

  return {
    // Nodes precede edges. Cytoscape accepts either order, but emitting nodes first matches the
    // documented notation and keeps a partially-consumed array readable.
    elements: [...nodeElements, ...edgeElements],
    context: {
      focus: projection.focus,
      view: projection.view,
      depth: projection.depth,
      meta: projection.meta,
    },
  }
}

/**
 * Convert a domain projection into just the Cytoscape element array.
 *
 * A convenience over {@link toCytoscapePresentation} for callers that hold the context already
 * or render nothing from `meta`. It runs the identical validation, so it is not a laxer path.
 *
 * @param projection The output of `projectGraph`, used as-is; never re-queried.
 * @returns The flat element array for `cytoscape({elements})`.
 * @throws {CytoscapeAdapterError} Under exactly the conditions documented on
 * {@link toCytoscapePresentation}.
 */
export function toCytoscapeElements(
  projection: GraphProjection,
): CytoscapeElement[] {
  return [...toCytoscapePresentation(projection).elements]
}

/**
 * Reject a node that is not presentable.
 *
 * The checks are about fields a stylesheet or consumer will read without narrowing, so a node
 * that survives has enough to be rendered and enough to be asserted on. Type-specific metadata
 * is deliberately *not* validated: `types.ts` already discriminates the union on `type`, and
 * re-checking each metadata shape here would duplicate the contract in the place most likely to
 * drift from it.
 */
function assertUsableNode(node: GraphNode): void {
  if (typeof node.id !== 'string' || node.id.length === 0) {
    throw new CytoscapeAdapterError(
      `node of type "${String(node.type)}" has no id; Cytoscape requires an id on every ` +
        'element and would assign one, losing canonical identity',
    )
  }
  if (!SUPPORTED_NODE_TYPES.has(node.type)) {
    throw new CytoscapeAdapterError(
      `node "${node.id}" has unsupported type "${String(node.type)}"; this adapter knows ` +
        `${SUPPORTED_NODE_TYPES.size} node types and must be extended before a new one can ` +
        'be presented',
    )
  }
  if (typeof node.label !== 'string' || node.label.length === 0) {
    throw new CytoscapeAdapterError(
      `node "${node.id}" has no label; a renderer would otherwise draw an unidentifiable ` +
        'shape',
    )
  }
  if (!Number.isFinite(node.depth) || !Number.isFinite(node.degree)) {
    throw new CytoscapeAdapterError(
      `node "${node.id}" has non-finite depth/degree; the projection must report measured ` +
        'numbers, not placeholders',
    )
  }
  if (node.status === undefined || node.status === null) {
    throw new CytoscapeAdapterError(
      `node "${node.id}" has no status; Q4 keeps status per node type and the adapter will ` +
        'not substitute one',
    )
  }
}

/**
 * Reject an edge that is not presentable, including an edge whose `family` and `type` disagree.
 *
 * That last check is the adapter's most opinionated rule and the one worth defending. `types.ts`
 * keys `GraphEdgeType` by family precisely so `claim_relation: SUPPORTS` cannot be mistaken for
 * `card_relationship: SUPPORTS`; an edge asserting `family: 'classification'` with
 * `type.family: 'inference'` is exactly the flattening the design forbids, and it would reach a
 * stylesheet as two contradictory facts.
 */
function assertUsableEdge(edge: GraphEdge): void {
  if (typeof edge.id !== 'string' || edge.id.length === 0) {
    throw new CytoscapeAdapterError(
      `edge from "${edge.from}" to "${edge.to}" has no id; edge ids are the deterministic ` +
        'buildEdgeId composite and may not be absent',
    )
  }
  if (!SUPPORTED_EDGE_FAMILIES.has(edge.family)) {
    throw new CytoscapeAdapterError(
      `edge "${edge.id}" has unsupported family "${String(edge.family)}"; this adapter knows ` +
        `${SUPPORTED_EDGE_FAMILIES.size} edge families and must be extended before a new one ` +
        'can be presented',
    )
  }
  if (edge.type === undefined || edge.type === null) {
    throw new CytoscapeAdapterError(
      `edge "${edge.id}" has no type; an edge without a relation word cannot be styled or ` +
        'asserted on',
    )
  }
  if (edge.type.family !== edge.family) {
    throw new CytoscapeAdapterError(
      `edge "${edge.id}" reports family "${edge.family}" but its type reports family ` +
        `"${String(edge.type.family)}"; the two vocabularies are separate by design and must ` +
        'never be flattened together',
    )
  }
  if (typeof edge.from !== 'string' || edge.from.length === 0) {
    throw new CytoscapeAdapterError(
      `edge "${edge.id}" has no source endpoint; authored direction is never inferred`,
    )
  }
  if (typeof edge.to !== 'string' || edge.to.length === 0) {
    throw new CytoscapeAdapterError(
      `edge "${edge.id}" has no target endpoint; authored direction is never inferred`,
    )
  }
  if (typeof edge.sourceTable !== 'string' || edge.sourceTable.length === 0) {
    throw new CytoscapeAdapterError(
      `edge "${edge.id}" has no sourceTable; a consumer cannot interpret the relation word ` +
        'without knowing which vocabulary it came from',
    )
  }
}

/** Map a node onto a Cytoscape node element, preserving every semantic field. */
function toNodeElement(node: GraphNode): CytoscapeNodeElement {
  const classes = [
    `type-${node.type}`,
    `status-${node.status.source}`,
    ...(node.isFocus ? ['is-focus'] : []),
  ]
  return {
    group: 'nodes',
    data: {
      id: node.id,
      type: node.type,
      label: node.label,
      depth: node.depth,
      isFocus: node.isFocus,
      degree: node.degree,
      status: node.status,
      // Narrowed rather than destructured: only a card has `classification`, and spreading a
      // union keeps the key genuinely absent on other types instead of widening it to
      // `undefined`, which Cytoscape would drop from `data()` and make indistinguishable from
      // a card whose classification is missing.
      ...('classification' in node
        ? { classification: node.classification }
        : {}),
      metadata: node.metadata,
    },
    classes,
  }
}

/** Map an edge onto a Cytoscape edge element, preserving direction, family and relation. */
function toEdgeElement(edge: GraphEdge): CytoscapeEdgeElement {
  const { family, value } = edge.type
  return {
    group: 'edges',
    data: {
      id: edge.id,
      // Authored direction. `traversal` is a walk rule, not a direction, so a bidirectional edge
      // stays one directed Cytoscape edge and the rule travels as data.
      source: edge.from,
      target: edge.to,
      family,
      relation: value,
      // Only the `inference_step_relations` variant carries a vocabulary. Conditionally spread
      // so the key is absent otherwise, matching graphology-adapter: Cytoscape drops
      // `undefined` keys from `data()` anyway, but a key that is absent on read is cheaper to
      // assert on than one that is present and undefined.
      ...('vocabulary' in edge.type
        ? { vocabulary: edge.type.vocabulary }
        : {}),
      sourceTable: edge.sourceTable,
      traversal: edge.traversal,
      projectionAttributes: edge.attributes,
    },
    classes: [
      `family-${family}`,
      `relation-${value}`,
      `traversal-${edge.traversal}`,
    ],
  }
}
