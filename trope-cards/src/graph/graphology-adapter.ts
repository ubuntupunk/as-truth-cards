/**
 * Graphology adapter: domain projection to an ephemeral analysis graph.
 *
 * The adapter is the seam Issue #3 names — `canonical Postgres/Drizzle → domain projection →
 * Graphology → Cytoscape`. It consumes exactly one thing, the `{ focus, view, depth, nodes,
 * edges, meta }` contract from `types.ts`, and it reads no database. Graphology is a
 * computation dependency here, never a source of truth: nothing in this module is persisted,
 * and no Graphology type ever appears in the API contract or the projection.
 *
 * ## Why `MultiDirectedGraph`
 *
 * Both halves of that choice are forced by the ontology, not by taste:
 *
 * - **Multi.** `relationships` is polymorphic with no unique constraint on the endpoint pair,
 *   so two rows may relate the same two cards and differ only by `status`. `buildEdgeId` already
 *   treats those as distinct edges, and the plain `Graph` class *rejects* a second edge for one
 *   (source, target) pair outright. A simple graph would therefore turn legitimate canonical
 *   data into a thrown error. The current seed has no such pair, so this is a guard against the
 *   schema rather than a fix for a live failure.
 * - **Directed.** `from`/`to` are the authored direction and stay that way in the structure.
 *   Some edges are nonetheless *expandable* in both directions — a card should see the
 *   relationships pointing at it — and the projection already models that separately as
 *   `edge.traversal`. Encoding it as an undirected edge would discard the authored direction
 *   that `types.ts` requires a consumer to be able to read, so it stays an attribute and the
 *   analysis helpers consult it instead.
 *
 * ## Prohibitions
 *
 * - No node or edge is created, dropped, merged, or rewritten. Counts and ids are asserted to
 *   survive in `test/graphology-adapter.test.ts`.
 * - No semantics are added. The adapter introduces no derived edge, no status rollup, and no
 *   inferred relation; `graphology` only indexes what the projection already emitted.
 * - Malformed input fails loudly with {@link GraphologyAdapterError} instead of being coerced
 *   into a partial graph, so a projection bug cannot be mistaken for a sparse corpus.
 */

import { MultiDirectedGraph } from 'graphology'

import type { GraphEdge, GraphNode, GraphProjection } from './types.ts'

/**
 * Node attributes as Graphology sees them.
 *
 * Every field of {@link GraphNode} except `id`, which becomes the node key. Kept flat and
 * typed rather than stashed under a single `node` attribute so a consumer can filter by
 * `graph.nodes()` alone without unpacking a nested payload, and so Axis/Locale survive as the
 * same values the projection emitted.
 */
export type GraphologyNodeAttributes = {
  /** Canonical `trope_graph` type: `card`, `claim`, `inference_step`, `argument_chain`, … */
  readonly type: GraphNode['type']
  readonly label: string
  /** Hop distance from the projection's focus, as the projection measured it. */
  readonly depth: number
  readonly isFocus: boolean
  /** Cardinality the projection reported, not a recomputed one. */
  readonly degree: number
  /** Per-type status variant, carried verbatim. Never combined across types (Q4). */
  readonly status: GraphNode['status']
  /** Card-only classification, including Axis and Locale assignments. Absent on other types. */
  readonly classification?: Extract<
    GraphNode,
    { type: 'card' }
  >['classification']
  /** The type-specific metadata bag, carried verbatim. */
  readonly metadata:
    | Extract<GraphNode, { type: 'card' }>['metadata']
    | GraphNode['metadata']
}

/** Edge attributes as Graphology sees them. */
export type GraphologyEdgeAttributes = {
  /** Which taxonomy produced the relation word, e.g. `inference` or `claim_relation`. */
  readonly family: GraphEdge['family']
  /** The relation word. Meaningless without `family`, which is why both are carried. */
  readonly relation: GraphEdge['type']['value']
  /** Vocabulary discriminator for `inference_step_relations`; absent otherwise. */
  readonly vocabulary?: 'inference_step_relation_type'
  /** The canonical table the relation word came from. */
  readonly sourceTable: string
  /** Whether traversal may cross this edge in both directions, independently of `from`/`to`. */
  readonly traversal: GraphEdge['traversal']
  /** The projection's edge attributes (`role`, `ordinal`, …), carried verbatim. */
  readonly projectionAttributes: GraphEdge['attributes']
}

/** The concrete graph type the adapter produces. */
export type TropeGraphologyGraph = MultiDirectedGraph<
  GraphologyNodeAttributes,
  GraphologyEdgeAttributes
>

/**
 * Raised when a projection cannot be represented faithfully.
 *
 * These are all bugs in the projection or in a caller, never conditions to recover from: an
 * edge with a missing endpoint, a repeated node id, or a repeated edge id would each mean the
 * adapter is about to silently lose or invent structure.
 */
export class GraphologyAdapterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphologyAdapterError'
  }
}

/**
 * Convert a domain projection into an ephemeral Graphology graph.
 *
 * Lossless with respect to the projection: same nodes, same edges, same ids, same directions,
 * same attributes. Graph-level attributes carry `focus`, `view`, `depth` and the whole `meta`
 * bag, so truncation and warnings travel with the graph instead of being re-derived.
 *
 * An empty projection is valid and yields an empty graph — a card with no claims is a fact,
 * not a failure. Only genuinely malformed input throws.
 *
 * @param projection The output of `projectGraph`, used as-is; never re-queried.
 * @returns A `MultiDirectedGraph` keyed by node id and edge id.
 * @throws {GraphologyAdapterError} If a node id repeats, an edge id repeats, or an edge
 * references an endpoint that is not in `projection.nodes`.
 * @example
 * ```ts
 * const graph = toGraphology(await projectGraph(reader, request));
 * graph.order;      // === projection.meta.nodeCount
 * graph.size;       // === projection.meta.edgeCount
 * ```
 */
export function toGraphology(
  projection: GraphProjection,
): TropeGraphologyGraph {
  const graph = new MultiDirectedGraph<
    GraphologyNodeAttributes,
    GraphologyEdgeAttributes
  >()

  const seenNodeIds = new Set<string>()
  for (const node of projection.nodes) {
    if (seenNodeIds.has(node.id)) {
      throw new GraphologyAdapterError(
        `projection repeats node id "${node.id}"; node ids must be unique`,
      )
    }
    seenNodeIds.add(node.id)
    graph.addNode(node.id, toNodeAttributes(node))
  }

  const seenEdgeIds = new Set<string>()
  for (const edge of projection.edges) {
    if (seenEdgeIds.has(edge.id)) {
      throw new GraphologyAdapterError(
        `projection repeats edge id "${edge.id}"; edge ids must be unique`,
      )
    }
    seenEdgeIds.add(edge.id)
    // Checked before handing to Graphology so the failure names the edge rather than surfacing
    // as a bare NotFoundGraphError, and so an endpoint missing from `nodes` is never mistaken
    // for an unpopulated layer.
    for (const [role, endpoint] of [
      ['from', edge.from],
      ['to', edge.to],
    ] as const) {
      if (!seenNodeIds.has(endpoint)) {
        throw new GraphologyAdapterError(
          `edge "${edge.id}" has ${role} endpoint "${endpoint}", which is not in the ` +
            `projection's ${projection.nodes.length} node(s); an edge may only join nodes the ` +
            'projection emitted',
        )
      }
    }
    graph.addEdgeWithKey(edge.id, edge.from, edge.to, toEdgeAttributes(edge))
  }

  graph.mergeAttributes({
    focusId: projection.focus.id,
    focusType: projection.focus.type,
    focusSlug: projection.focus.slug,
    view: projection.view,
    depth: projection.depth,
    meta: projection.meta,
  })

  return graph
}

/**
 * Project a node's fields onto Graphology attributes.
 *
 * `id` is omitted because it is the node key. Everything else is copied by reference; the
 * projection is treated as immutable, so no defensive copy is warranted.
 */
function toNodeAttributes(node: GraphNode): GraphologyNodeAttributes {
  // The card-only `classification` is absent on every other node type, and spreading a union
  // keeps that absence rather than widening it to `undefined` on non-cards.
  return {
    type: node.type,
    label: node.label,
    depth: node.depth,
    isFocus: node.isFocus,
    degree: node.degree,
    status: node.status,
    ...('classification' in node
      ? { classification: node.classification }
      : {}),
    metadata: node.metadata,
  }
}

/** Project an edge's fields onto Graphology attributes. `from`/`to` are the edge's endpoints. */
function toEdgeAttributes(edge: GraphEdge): GraphologyEdgeAttributes {
  const { family, value } = edge.type
  return {
    family,
    relation: value,
    // Narrowed rather than destructured: only the `inference_step_relations` variant of
    // `GraphEdgeType` carries a vocabulary, and the edge keeps it verbatim when it has one.
    ...('vocabulary' in edge.type ? { vocabulary: edge.type.vocabulary } : {}),
    sourceTable: edge.sourceTable,
    traversal: edge.traversal,
    projectionAttributes: edge.attributes,
  }
}
