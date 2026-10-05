/**
 * Deterministic graph analysis over the Graphology adapter.
 *
 * Everything here operates on a graph the caller already built from a projection. Nothing
 * queries Postgres, and nothing reads a Graphology attribute to *invent* meaning: the helpers
 * count structure the projection already emitted. That is the whole reason this layer is worth
 * having — a metric the ontology cannot justify is a claim someone will later read as fact, so
 * the vocabulary here is deliberately thin.
 *
 * ## What is deliberately absent
 *
 * - **No status rollups.** There is no "graph consensus", "argument strength", or
 *   confidence score. Node status is a per-type enum or free-text variant and is not assignable
 *   across types (Q4); averaging it would invent a quantity the ontology does not contain.
 * - **No centrality ranking.** PageRank and friends imply a flow model over argument edges.
 *   `PREMISE_OF` and `CONCLUDES` are reasoning structure, not traffic, and a "most important
 *   claim" would be a fabricated editorial claim.
 * - **No strongly connected components.** See {@link connectedComponents} for why weakly
 *   connected is the defensible reading and strongly connected is not.
 * - **No path-finding between arbitrary nodes.** Nothing in the ontology says a path from
 *   card A to card B means anything specific; traversal is offered from a start node instead,
 *   which is the claim the graph can actually support.
 *
 * ## Determinism
 *
 * Every helper returns sorted keys and assigns visit order by sorted id, never by insertion
 * order. Two runs over the same graph therefore serialise identically, which is what makes a
 * cached analysis diffable against a fresh one.
 */

import type { TropeGraphologyGraph } from './graphology-adapter.ts'

/** In/out/total degree for one node. */
export type NodeDegrees = {
  readonly in: number
  readonly out: number
  readonly total: number
}

/**
 * Degree per node, keyed by node id and sorted by it.
 *
 * Reported in three parts because a directed graph has no single meaningful degree: a claim
 * that many steps conclude from is not in the same position as one that concludes many.
 * `total` counts each incident edge once, so a self-loop contributes one rather than two.
 */
export function degreeReport(
  graph: TropeGraphologyGraph,
): Readonly<Record<string, NodeDegrees>> {
  const report: Record<string, NodeDegrees> = {}
  for (const nodeId of [...graph.nodes()].sort()) {
    report[nodeId] = {
      in: graph.inDegree(nodeId),
      out: graph.outDegree(nodeId),
      total: graph.degree(nodeId),
    }
  }
  return report
}

/** Options for {@link reachableFrom}. Both bounds default to unbounded within reason. */
export type ReachabilityOptions = {
  /**
   * Maximum hop count, inclusive of the start node at depth 0.
   *
   * Bounded deliberately: an unbounded walk over a corpus that grows with every seeded claim is
   * not something a request handler should be able to trigger.
   */
  readonly maxDepth?: number
  /** Hard cap on returned node ids, so a wide graph cannot produce an unbounded payload. */
  readonly maxNodes?: number
}

/** Outcome of a bounded traversal. */
export type Reachability = {
  /** Reachable node ids excluding the start node, sorted. */
  readonly nodeIds: readonly string[]
  /** Greatest depth actually visited, 0 when nothing was reachable. */
  readonly reachedDepth: number
  /** True when `maxDepth` or `maxNodes` stopped the walk early, so the caller knows it is partial. */
  readonly truncated: boolean
}

/**
 * Node ids within `maxDepth` hops of `startId`, honouring each edge's `traversal` attribute.
 *
 * A `bidirectional` edge is walked in both directions; a `directed` one only from `from` to
 * `to`. That distinction is the projection's, not this module's: it is why a card sees the
 * relationships pointing *at* it while `claims.card_id` still points one way.
 *
 * The start node is never included in `nodeIds`, so a caller can union the result with its own
 * id without deduplicating.
 *
 * @param graph Graph from `toGraphology`.
 * @param startId Node to walk from. Must exist in the graph.
 * @param options `maxDepth` and `maxNodes` bounds; both optional.
 * @returns Sorted reachable ids, the depth reached, and whether a bound cut the walk short.
 * @throws {Error} If `startId` is not a node in the graph.
 * @example
 * ```ts
 * const reach = reachableFrom(graph, projection.focus.id, { maxDepth: 2, maxNodes: 200 });
 * reach.nodeIds; // sorted, excludes the focus
 * ```
 */
export function reachableFrom(
  graph: TropeGraphologyGraph,
  startId: string,
  options: ReachabilityOptions = {},
): Reachability {
  if (!graph.hasNode(startId)) {
    throw new Error(
      `cannot traverse from "${startId}": no such node in the graph`,
    )
  }
  const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY
  const maxNodes = options.maxNodes ?? Number.POSITIVE_INFINITY

  // BFS. Two things make it deterministic rather than merely correct: each frontier is sorted
  // before it is expanded, and each node's neighbours are sorted before the node cap is
  // applied. Without the second, *which* nodes survive a cap would depend on Graphology's edge
  // iteration order, so the same request could return a different subset between runs.
  const visited = new Set<string>([startId])
  const depthOf = new Map<string, number>([[startId, 0]])
  let frontier = [startId]
  let hitNodeCap = false

  while (frontier.length > 0) {
    // Every member of a frontier shares one depth, so the first entry answers for all of them.
    const frontierDepth = depthOf.get(frontier[0] as string) as number
    if (frontierDepth >= maxDepth) break

    const next: string[] = []
    for (const nodeId of frontier) {
      for (const neighbour of [...adjacentNodes(graph, nodeId)].sort()) {
        if (visited.has(neighbour)) continue
        // Checked before adding, so the cap bounds results rather than visited-set size; the
        // start node is excluded from the count because it is not a result.
        if (visited.size - 1 >= maxNodes) {
          hitNodeCap = true
          break
        }
        visited.add(neighbour)
        depthOf.set(neighbour, frontierDepth + 1)
        next.push(neighbour)
      }
      if (hitNodeCap) break
    }
    if (hitNodeCap) break
    if (next.length === 0) break
    frontier = next.sort()
  }

  const nodeIds = [...visited].filter((id) => id !== startId).sort()
  return {
    nodeIds,
    // Measured from the visited set rather than a loop counter, so it stays truthful when a cap
    // cuts an expansion in half.
    reachedDepth: nodeIds.reduce(
      (max, id) => Math.max(max, depthOf.get(id) ?? 0),
      0,
    ),
    // Only the node cap truncates. Stopping at `maxDepth` is honouring the request, not
    // returning less than was asked for, which matches `meta.truncated` in the projection.
    truncated: hitNodeCap,
  }
}

/**
 * Weakly connected components, each internally sorted, ordered by smallest member.
 *
 * Weakly connected is the only defensible choice here. Direction on these edges is authored
 * reasoning structure — a card asserts a claim, a step concludes one — and treating that as a
 * flow would make component membership depend on argument order rather than on what is
 * connected to what. A strongly connected component, meanwhile, would assert that a group of
 * nodes justifies each other circularly, which is an editorial claim no table records. Both
 * readings would be inventions; ignoring direction makes no claim at all.
 *
 * @param graph Graph from `toGraphology`.
 * @returns Component arrays. A graph with no edges yields one component per node, and an empty
 * graph yields none.
 */
export function connectedComponents(graph: TropeGraphologyGraph): string[][] {
  const assigned = new Set<string>()
  const components: string[][] = []

  for (const startId of [...graph.nodes()].sort()) {
    if (assigned.has(startId)) continue
    // Reuses the same traversal rule as reachability, so a component and a neighbourhood mean
    // the same thing to a reader.
    const members = [startId, ...reachableFrom(graph, startId).nodeIds]
    for (const member of members) assigned.add(member)
    components.push(members.sort())
  }

  // Ordering by smallest member makes the output independent of node insertion order.
  components.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))
  return components
}

/**
 * Neighbours reachable across one incident edge.
 *
 * Internal, and the single place {@link reachableFrom} and {@link connectedComponents} agree
 * on what "adjacent" means.
 *
 * A `directed` edge yields only its target, so `claims.card_id` reads one way. A
 * `bidirectional` edge also yields its source, which is what lets a card see the relationships
 * pointing *at* it — without the adapter having had to discard the authored direction to make
 * it walkable. A self-loop yields the node itself, which the caller's `visited` set absorbs.
 */
function* adjacentNodes(
  graph: TropeGraphologyGraph,
  nodeId: string,
): Generator<string> {
  for (const edge of graph.edges(nodeId)) {
    const source = graph.source(edge) as string
    const target = graph.target(edge) as string

    if (source === nodeId) {
      yield target
    }
    if (
      target === nodeId &&
      graph.getEdgeAttribute(edge, 'traversal') === 'bidirectional'
    ) {
      yield source
    }
  }
}
