/**
 * The read-only domain graph projection.
 *
 * Postgres is canonical; this module turns a selected subgraph of it into the `{nodes, edges,
 * meta}` shape documented in `docs/GRAPH_PROJECTION_DESIGN.md` §5.2. It reads through
 * {@link TropeGraphReader} and never imports Drizzle, so the same code path is exercised by
 * in-memory tests and by the live database without a second implementation to keep in sync.
 *
 * ## Responsibilities
 *
 * - **Breadth-first expansion under the view's adjacency rules** (§6 step 3). Depth is a hop
 *   count within the selected view (Q9): the view decides which transitions exist, so
 *   taxonomy depth and argument depth never interfere and there is no ontology-wide adjacency
 *   graph to measure depth against.
 * - **Normalisation invariants** (§6), enforced here and asserted directly by
 *   `test/graph-projection.test.ts`.
 * - **Defensive handling of untrusted rows** (Q5). `relationships` is polymorphic with no
 *   foreign keys, so a row whose discriminators or endpoints do not resolve is reported in
 *   `meta.warnings` and dropped, never emitted as a dangling edge.
 *
 * ## Prohibitions, enforced by construction rather than by review
 *
 * - No code path derives a `claim_relations` edge from an inference step. Q1 keeps direct
 *   semantic claim relations as authored data; inferring them from reasoning structure would
 *   fabricate the exact distinction the table exists to hold. A card that reasons
 *   `Claim A --PREMISE_OF--> Step --CONCLUDES--> Claim B` emits those two edges and no
 *   `SUPPORTS` edge.
 * - No code path derives a card's axis from `cards.primary_type`. Axis is `card_axes.ordinal
 *   = 0`, expressed once, in {@link groupCardAxes}.
 * - No code path aggregates status across node types (Q4). Each node carries its own status
 *   variant and the variants are not assignable to one another.
 * - No edge is emitted unless both endpoints are in the emitted node set.
 */

import type {
  ArgumentChainExpansion,
  ArgumentChainMembershipRow,
  ArgumentChainRow,
  CardExpansion,
  CardRow,
  ClaimExpansion,
  ClaimRelationRow,
  ClaimRow,
  ClaimSourceRow,
  EvidenceClaimRow,
  EvidenceInferenceRow,
  EvidenceItemExpansion,
  EvidenceSourceRow,
  InferenceConclusionRow,
  InferencePremiseRow,
  InferenceStepExpansion,
  InferenceStepRelationRow,
  InferenceStepRow,
  NodeHydration,
  NodeRefSet,
  RelationshipRow,
  SourceExpansion,
  TropeGraphReader,
} from './reader'
import type {
  ArgumentChainMembership,
  ArgumentChainNode,
  AxisAssignment,
  CardClassification,
  CardNode,
  CardNodeMetadata,
  ClaimNode,
  CollectionNode,
  ConceptNode,
  EvidenceItemNode,
  GraphEdge,
  GraphEdgeType,
  GraphNode,
  GraphNodeType,
  GraphProjection,
  GraphProjectionMeta,
  InferenceStepNode,
  InferenceStepRoleValue,
  MechanismNode,
  NodeStatus,
  SourceNode,
} from './types'
import {
  DEFAULT_DEPTH,
  DEFAULT_MAX_NODES,
  type GraphViewRule,
  HARD_MAX_DEPTH,
  HARD_MAX_NODES,
  viewBlockingGaps,
  viewEmitsNodeType,
  viewTraversesFamily,
} from './views'

/** A node the BFS has reached, before metadata is attached. */
type NodeRef = { readonly type: GraphNodeType; readonly id: string }

/**
 * An authored edge plus the traversal bookkeeping the BFS needs.
 *
 * The endpoint refs are kept in typed form because `from`/`to` on the wire are bare ids and
 * the id spaces of different tables must never be conflated to decide whether a node exists.
 */
type CandidateEdge = {
  readonly edge: GraphEdge
  readonly from: NodeRef
  readonly to: NodeRef
  /** Hop distance at which this edge's endpoints are reached. */
  readonly depth: number
}

/** A validated projection request. */
export type GraphProjectionRequest = {
  /** A card slug or uuid (Q7). */
  readonly focus: string
  readonly view: GraphViewRule
  readonly depth: number
  readonly maxNodes: number
  /**
   * Subset allow-list of node types to emit.
   *
   * Always a subset of the view's own node set, never an expansion of it: `include=source`
   * against the card view is rejected at parse time rather than widening the view.
   */
  readonly includeNodeTypes?: readonly GraphNodeType[]
  /**
   * Subset allow-list of edge types to traverse.
   *
   * Accepts a bare relation word (`SUPPORTS`, `PREMISE_OF`) or a family-qualified form
   * (`claim_relation:SUPPORTS`). The qualified form is what makes Q1's rule enforceable from
   * outside the server: a client that wants authored claim relations and not card links asks
   * for `claim_relation:SUPPORTS` and cannot accidentally receive the other.
   */
  readonly includeEdgeTypes?: readonly string[]
}

/** Thrown when the focus cannot be resolved or is not permitted by the view. */
export class GraphFocusNotFoundError extends Error {
  constructor(
    readonly focus: string,
    readonly reason: string,
  ) {
    super(`Graph focus "${focus}" could not be resolved: ${reason}`)
    this.name = 'GraphFocusNotFoundError'
  }
}

/** Map key for a node reference. */
function refKey(ref: NodeRef): string {
  return `${ref.type}|${ref.id}`
}

/**
 * Build a deterministic edge id.
 *
 * The design doc §4 specifies `"{fromId}|{type}|{toId}"`, disambiguated by premise
 * `role`/`ordinal` or step relation. The family is included because two vocabularies reuse the
 * same word for unrelated edges — `claim_relations.SUPPORTS` and `relationships.SUPPORTS` —
 * and a shared id space would let them collide if a card and a claim were ever related through
 * both. The discriminator is included only for tables that permit a repeated typed pair:
 * `inference_premises` is unique per `(step, claim)` so the pair plus role suffices, while
 * `relationships` is unique per pair *plus status*, so a `PROPOSED` row and its `CANONICAL`
 * replacement are two distinct edges and must not share an id.
 *
 * @param family Edge family, used as the id's namespace prefix.
 * @param from Source node id.
 * @param type The relation word.
 * @param to Target node id.
 * @param discriminator Extra qualifier for tables that allow a repeated typed pair.
 * @returns A stable composite id.
 * @example
 * ```ts
 * buildEdgeId("claim_relation", "a", "SUPPORTS", "b");
 * // -> "claim_relation|a|SUPPORTS|b"
 * buildEdgeId("card_relationship", "a", "RELATED", "b", "PROPOSED");
 * // -> "card_relationship|a|RELATED|b|PROPOSED"
 * ```
 */
export function buildEdgeId(
  family: string,
  from: string,
  type: string,
  to: string,
  discriminator?: string,
): string {
  const base = `${family}|${from}|${type}|${to}`
  return discriminator === undefined ? base : `${base}|${discriminator}`
}

/** The `family:TYPE` key an edge filter matches on. */
function edgeTypeKey(edge: GraphEdge): string {
  return `${edge.family}:${edge.type.value}`
}

/**
 * Project a focused, depth-bounded, filtered subgraph of the Trope Graph.
 *
 * @param reader Read-only port over `trope_graph`.
 * @param request Validated focus, view, depth and filters.
 * @returns The projection, with counts, truncation state and non-fatal warnings.
 * @throws {GraphFocusNotFoundError} If `focus` resolves to nothing, or resolves to an entity
 * the requested view does not permit as a focus.
 * @example
 * ```ts
 * const view = getGraphView("card-argument-taxonomy")!;
 * const projection = await projectGraph(reader, {
 *   focus: "jesus-was-a-zionist",
 *   view,
 *   depth: 2,
 *   maxNodes: DEFAULT_MAX_NODES,
 * });
 * projection.meta.nodeCount; // > 0 for every seeded card
 * ```
 */
export async function projectGraph(
  reader: TropeGraphReader,
  request: GraphProjectionRequest,
): Promise<GraphProjection> {
  const warnings: string[] = []
  const { view } = request

  const { ref: focusRef, card } = await resolveFocus(reader, request.focus)
  if (!view.focusTypes.includes(focusRef.type)) {
    throw new GraphFocusNotFoundError(
      request.focus,
      `view "${view.name}" does not accept a ${focusRef.type} as a focus`,
    )
  }
  const edgeFilter = normaliseEdgeFilter(request.includeEdgeTypes)

  /** Refs reached so far, in discovery order, keyed by `type|id`. */
  const discovered = new Map<string, NodeRef>([[refKey(focusRef), focusRef]])
  /** Hop distance from the focus, per ref. */
  const distances = new Map<string, number>([[refKey(focusRef), 0]])
  /** Edges admitted so far, keyed by edge id. */
  const edges = new Map<string, CandidateEdge>()

  let frontier: NodeRef[] = [focusRef]
  let reachedDepth = 0
  let truncated = false

  for (let hop = 0; hop < request.depth && frontier.length > 0; hop += 1) {
    const candidates = await expandRound(reader, frontier, view, warnings, hop)
    const nextFrontier: NodeRef[] = []

    for (const candidate of candidates) {
      // An excluded edge type is not traversed either: a client that filters out
      // `card_relationship` should not reach another card by hopping over a relationship.
      if (edgeFilter && !edgePassesFilter(candidate.edge, edgeFilter)) continue

      edges.set(candidate.edge.id, candidate)

      for (const endpoint of [candidate.from, candidate.to]) {
        const key = refKey(endpoint)
        if (distances.has(key)) continue
        distances.set(key, candidate.depth)
        discovered.set(key, endpoint)
        nextFrontier.push(endpoint)
      }
    }

    reachedDepth = candidateDepth(hop + 1)
    frontier = nextFrontier

    if (discovered.size >= request.maxNodes) {
      truncated = true
      frontier = []
    }
  }

  // Soft cap. Deterministically keep the first `maxNodes` refs in discovery order and drop the
  // rest; `normaliseEdges` then drops every edge that referenced a dropped node.
  if (discovered.size > request.maxNodes) {
    truncated = true
    for (const key of [...discovered.keys()].slice(request.maxNodes)) {
      discovered.delete(key)
      distances.delete(key)
    }
  }

  // `include` and the view's own node set both filter *before* hydration, so a filtered node
  // contributes no rows and can never leave an edge pointing at it (invariant 3).
  const includeSet = request.includeNodeTypes
    ? new Set(request.includeNodeTypes)
    : undefined
  const allowedRefs = new Set(
    [...discovered.values()]
      .filter((ref) => viewEmitsNodeType(view, ref.type))
      .filter((ref) => includeSet === undefined || includeSet.has(ref.type))
      .map(refKey),
  )
  const refs = splitRefs(allowedRefs, discovered)

  const hydration = await reader.hydrate(refs)

  warnings.push(...chainMembershipWarnings(hydration))
  warnings.push(...(await populationWarnings(reader, view)))

  const nodeList = buildNodes(refs, distances, focusRef, hydration, warnings)
  // Normalising against the nodes that were *actually emitted* rather than the refs that
  // were discovered is what makes invariant 1 hold for references hydration could not
  // resolve. A `relationships` row pointing at a deleted card produces a discovered ref, an
  // absent node, and — before this — a live edge pointing at nothing.
  const edgeList = normaliseEdges(
    edges,
    allowedRefs,
    new Set(nodeList.map((node) => node.id)),
    warnings,
  )

  const degrees = new Map<string, number>()
  for (const edge of edgeList) {
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1)
    degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1)
  }

  const meta: GraphProjectionMeta = {
    nodeCount: nodeList.length,
    edgeCount: edgeList.length,
    truncated,
    maxNodes: request.maxNodes,
    reachedDepth,
    warnings: [...new Set(warnings)],
  }

  return {
    focus: {
      id: focusRef.id,
      type: focusRef.type,
      // A slug is only echoed when a card focus was addressed that way (Q7); claims and
      // argument chains carry no slug, so their focus is uuid-only by construction.
      slug:
        focusRef.type === 'card' &&
        card !== undefined &&
        request.focus === card.slug
          ? card.slug
          : null,
    },
    view: view.name,
    depth: request.depth,
    nodes: nodeList.map((node) => ({
      ...node,
      degree: degrees.get(node.id) ?? 0,
    })),
    edges: edgeList,
    meta,
  }
}

/**
 * Resolve a `focus` reference to the node it names, across every type a view may focus on.
 *
 * The card table is tried first because slugs live there and a slug is the only
 * human-facing alias in the graph; claims, argument chains, sources and evidence items
 * carry no slug and answer to their uuid alone, so their finders short-circuit any
 * non-uuid reference.
 * Type-specific resolution comes before the view's `focusTypes` check, so the error
 * distinguishes "nothing matches" from "something matches but this view refuses it".
 *
 * @param reader Read-only port over `trope_graph`.
 * @param focus A card slug, or a card / claim / argument-chain / source / evidence-item uuid.
 * @returns The resolved ref, plus the matched card row when one exists — it carries the
 * slug echoed back in `focus.slug` (Q7).
 * @throws {GraphFocusNotFoundError} If no type in the graph matches the reference.
 * @example
 * ```ts
 * const { ref } = await resolveFocus(reader, "jesus-was-a-zionist");
 * ref.type; // "card" — slug-addressed, and only the card table has slugs
 * ```
 */
async function resolveFocus(
  reader: TropeGraphReader,
  focus: string,
): Promise<{ ref: NodeRef; card: CardRow | undefined }> {
  const card = await reader.findCardByRef(focus)
  if (card) return { ref: { type: 'card', id: card.id }, card }

  const claim = await reader.findClaimByRef(focus)
  if (claim) return { ref: { type: 'claim', id: claim.id }, card: undefined }

  const chain = await reader.findArgumentChainByRef(focus)
  if (chain) {
    return {
      ref: { type: 'argument_chain', id: chain.id },
      card: undefined,
    }
  }

  const source = await reader.findSourceByRef(focus)
  if (source) {
    return { ref: { type: 'source', id: source.id }, card: undefined }
  }

  const evidenceItem = await reader.findEvidenceItemByRef(focus)
  if (evidenceItem) {
    return {
      ref: { type: 'evidence_item', id: evidenceItem.id },
      card: undefined,
    }
  }

  throw new GraphFocusNotFoundError(
    focus,
    'no card, claim, argument chain, source or evidence item matches this slug or uuid',
  )
}

/** Clamp a computed hop to the hard depth cap so a reported depth is always requestable. */
function candidateDepth(hop: number): number {
  return Math.min(hop, HARD_MAX_DEPTH)
}

// ---------------------------------------------------------------------------
// Round expansion
// ---------------------------------------------------------------------------

/** Expand one breadth-first round, bucketed by the node types present in the frontier. */
async function expandRound(
  reader: TropeGraphReader,
  frontier: readonly NodeRef[],
  view: GraphViewRule,
  warnings: string[],
  hop: number,
): Promise<CandidateEdge[]> {
  const cardIds: string[] = []
  const claimIds: string[] = []
  const stepIds: string[] = []
  const chainIds: string[] = []
  const sourceIds: string[] = []
  const evidenceIds: string[] = []
  for (const ref of frontier) {
    if (ref.type === 'card') cardIds.push(ref.id)
    else if (ref.type === 'claim') claimIds.push(ref.id)
    else if (ref.type === 'inference_step') stepIds.push(ref.id)
    else if (ref.type === 'argument_chain') chainIds.push(ref.id)
    else if (ref.type === 'source') sourceIds.push(ref.id)
    else if (ref.type === 'evidence_item') evidenceIds.push(ref.id)
  }

  // Every node discovered in this round is exactly one hop from a node in the frontier, so
  // the round's hop number *is* the depth of everything it produces. Hardcoding `1` here
  // would report every claim, step, Suit and Mechanism in the graph as one hop from the
  // focus, which makes `depth` useless for telling a direct neighbour from a chain of
  // reasoning two assertions deep.
  const depth = candidateDepth(hop + 1)
  const out: CandidateEdge[] = []
  if (cardIds.length > 0) {
    const expansion = await reader.expandCards(cardIds)
    out.push(...cardCandidates(expansion, view, warnings, depth))
  }
  if (claimIds.length > 0) {
    out.push(
      ...claimCandidates(await reader.expandClaims(claimIds), view, depth),
    )
  }
  if (stepIds.length > 0) {
    out.push(
      ...stepCandidates(
        await reader.expandInferenceSteps(stepIds),
        view,
        depth,
      ),
    )
  }
  if (chainIds.length > 0) {
    out.push(
      ...chainCandidates(await reader.expandChains(chainIds), view, depth),
    )
  }
  if (sourceIds.length > 0) {
    out.push(
      ...sourceCandidates(await reader.expandSources(sourceIds), view, depth),
    )
  }
  if (evidenceIds.length > 0) {
    out.push(
      ...evidenceItemCandidates(
        await reader.expandEvidenceItems(evidenceIds),
        view,
        depth,
      ),
    )
  }
  return out
}

/**
 * Build the candidate edges reachable in one round from a set of card ids.
 *
 * @param expansion Rows the reader returned for those cards.
 * @param view The view whose adjacency rules apply.
 * @param warnings Collector for Q5 and vocabulary warnings.
 * @param depth Hop distance from the focus, for every node discovered this round.
 */
function cardCandidates(
  expansion: CardExpansion,
  view: GraphViewRule,
  warnings: string[],
  depth: number,
): CandidateEdge[] {
  const out: CandidateEdge[] = []

  if (viewTraversesFamily(view, 'classification')) {
    for (const row of expansion.cardCollections) {
      out.push(
        authored({
          id: buildEdgeId(
            'classification',
            row.cardId,
            'IN_SUIT',
            row.collectionId,
          ),
          type: { family: 'classification', value: 'IN_SUIT' },
          sourceTable: 'card_collections',
          from: { type: 'card', id: row.cardId },
          to: { type: 'collection', id: row.collectionId },
          attributes: { slug: row.slug, name: row.name },
          depth,
        }),
      )
    }
    for (const row of expansion.cardMechanisms) {
      out.push(
        authored({
          id: buildEdgeId(
            'classification',
            row.cardId,
            'HAS_MECHANISM',
            row.mechanismId,
          ),
          type: { family: 'classification', value: 'HAS_MECHANISM' },
          sourceTable: 'card_mechanisms',
          from: { type: 'card', id: row.cardId },
          to: { type: 'mechanism', id: row.mechanismId },
          attributes: { slug: row.slug, name: row.name },
          depth,
        }),
      )
    }
    // One edge per `card_concepts` row, never more. The row is the whole justification: there is
    // no fallback that reconstructs Concept membership from a Mechanism name, an Axis, a
    // Collection, a Locale, claim text or the card slug, so a card whose authored rows are
    // empty simply emits no Concept edge.
    for (const row of expansion.cardConcepts) {
      out.push(
        authored({
          id: buildEdgeId(
            'classification',
            row.cardId,
            'HAS_CONCEPT',
            row.conceptId,
          ),
          type: { family: 'classification', value: 'HAS_CONCEPT' },
          sourceTable: 'card_concepts',
          from: { type: 'card', id: row.cardId },
          to: { type: 'concept', id: row.conceptId },
          // `relationship` is the authored editorial justification and is passed through
          // verbatim, including null. Normalising it away would leave an edge asserting a
          // Concept link with no recorded reason.
          attributes: {
            slug: row.slug,
            name: row.name,
            relationship: row.relationship,
          },
          depth,
        }),
      )
    }
  }

  if (viewTraversesFamily(view, 'domain')) {
    // The assertion relation *is* the foreign key, so there is no join table to read.
    for (const claim of expansion.claims) {
      out.push(
        authored({
          id: buildEdgeId('domain', claim.cardId, 'ASSERTS', claim.id),
          type: { family: 'domain', value: 'ASSERTS' },
          sourceTable: 'claims',
          from: { type: 'card', id: claim.cardId },
          to: { type: 'claim', id: claim.id },
          attributes: { claimType: claim.claimType },
          depth,
        }),
      )
    }
  }

  if (viewTraversesFamily(view, 'card_relationship')) {
    out.push(
      ...relationshipCandidates(expansion.cardRelationships, warnings, depth),
    )
  }

  return out
}

/**
 * Build candidates for the polymorphic `relationships` table, defensively (Q5).
 *
 * `*_entity_type` is free text and `*_entity_id` carries no foreign key, so nothing guarantees
 * a row points at a card that exists. Rather than trusting the row, this checks both
 * discriminators against a whitelist and resolves both endpoints against the cards actually
 * present, reporting anything it cannot vouch for as a warning.
 *
 * Existence is deliberately *not* checked here. A `relationships` row is a pointer, and the
 * only component with authority on whether a card exists is `hydrate`; deciding it here
 * against the ids this round happened to expand would silently drop every relationship that
 * points at a card outside the current frontier, which is most of them. So a whitelisted
 * `CARD -> CARD` row becomes a candidate, the far card is discovered, and if hydration finds
 * no card row for it the node is dropped and the edge goes with it — the same place invariant
 * 1 is enforced for every other unresolvable reference.
 *
 * @param rows `relationships` rows touching the current card set.
 * @param warnings Collector for the resulting warnings.
 * @param depth Hop distance from the focus, for every node discovered this round.
 */
function relationshipCandidates(
  rows: readonly RelationshipRow[],
  warnings: string[],
  depth: number,
): CandidateEdge[] {
  const out: CandidateEdge[] = []
  const seenWarnings = new Set<string>()

  for (const row of rows) {
    const fromType = normaliseEntityType(row.fromEntityType)
    const toType = normaliseEntityType(row.toEntityType)
    if (fromType !== CARD_ENTITY_TYPE || toType !== CARD_ENTITY_TYPE) {
      // Deferred in the reader on purpose: an unrecognised discriminator is a data decision,
      // not a SQL concern, and this is the only place the warning can be observed.
      const note =
        `Relationship ${row.id} (${row.relationshipType}) declares entity types ` +
        `"${row.fromEntityType}" -> "${row.toEntityType}". Only ${CARD_ENTITY_TYPE} -> ` +
        `${CARD_ENTITY_TYPE} is projected, so this row was skipped rather than guessed at.`
      if (!seenWarnings.has(note)) {
        seenWarnings.add(note)
        warnings.push(note)
      }
      continue
    }
    out.push(
      authored({
        // `relationships` is unique per typed pair *plus status*, so status belongs in the id:
        // a PROPOSED row and its CANONICAL replacement are two edges, not one.
        id: buildEdgeId(
          'card_relationship',
          row.fromEntityId,
          row.relationshipType,
          row.toEntityId,
          row.status,
        ),
        type: { family: 'card_relationship', value: row.relationshipType },
        sourceTable: 'relationships',
        from: { type: 'card', id: row.fromEntityId },
        to: { type: 'card', id: row.toEntityId },
        attributes: {
          description: row.description,
          status: row.status,
          relationshipRowId: row.id,
        },
        depth,
      }),
    )
  }

  return out
}

/**
 * Build the candidate edges reachable in one round from a set of claim ids.
 *
 * This is where Q1 is load-bearing. `claim_relations` rows are projected as authored, and
 * nothing here synthesises a relation from an inference.
 *
 * @param expansion Rows the reader returned for those claims.
 * @param view The view whose adjacency rules apply.
 * @param depth Hop distance from the focus, for every node discovered this round.
 */
function claimCandidates(
  expansion: ClaimExpansion,
  view: GraphViewRule,
  depth: number,
): CandidateEdge[] {
  const out: CandidateEdge[] = []

  if (viewTraversesFamily(view, 'claim_relation')) {
    for (const row of expansion.claimRelations) {
      out.push(claimRelationCandidate(row, depth))
    }
  }

  if (viewTraversesFamily(view, 'inference')) {
    for (const row of expansion.premises) out.push(premiseCandidate(row, depth))
    for (const row of expansion.conclusions)
      out.push(conclusionCandidate(row, depth))
  }

  // `claim_sources` is the authored attribution layer: the claim is the `from`, the
  // bibliography entry is the `to`. Direction never reverses — a source does not assert a
  // claim, a claim is read from a source.
  if (viewTraversesFamily(view, 'source')) {
    for (const row of expansion.claimSources) {
      out.push(claimSourceCandidate(row, depth))
    }
  }

  if (viewTraversesFamily(view, 'evidence')) {
    for (const row of expansion.evidenceClaims) {
      out.push(evidenceClaimCandidate(row, depth))
    }
  }

  return out
}

/**
 * Project one `claim_relations` row as a direct semantic claim-to-claim edge.
 *
 * @param row The authored relation.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function claimRelationCandidate(
  row: ClaimRelationRow,
  depth: number,
): CandidateEdge {
  return authored({
    id: buildEdgeId(
      'claim_relation',
      row.sourceClaimId,
      row.relationType,
      row.targetClaimId,
    ),
    type: { family: 'claim_relation', value: row.relationType },
    sourceTable: 'claim_relations',
    from: { type: 'claim', id: row.sourceClaimId },
    to: { type: 'claim', id: row.targetClaimId },
    attributes: {
      description: row.description,
      claimRelationRowId: row.id,
    },
    depth,
  })
}

/**
 * Project one `inference_premises` row, carrying the premise role as an edge attribute.
 *
 * @param row The authored premise.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function premiseCandidate(
  row: InferencePremiseRow,
  depth: number,
): CandidateEdge {
  return authored({
    // Unique per (step, claim); the role is included so the id stays readable when one claim
    // is related to the same step in two authored rows, which the current index forbids but a
    // future partial unique index might not.
    id: buildEdgeId(
      'inference',
      row.claimId,
      `PREMISE_OF:${row.role}`,
      row.inferenceStepId,
    ),
    type: { family: 'inference', value: 'PREMISE_OF' },
    sourceTable: 'inference_premises',
    from: { type: 'claim', id: row.claimId },
    to: { type: 'inference_step', id: row.inferenceStepId },
    attributes: { role: row.role, ordinal: row.ordinal },
    depth,
  })
}

/**
 * Project one `inference_conclusions` row.
 *
 * @param row The authored conclusion.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function conclusionCandidate(
  row: InferenceConclusionRow,
  depth: number,
): CandidateEdge {
  return authored({
    id: buildEdgeId('inference', row.inferenceStepId, 'CONCLUDES', row.claimId),
    type: { family: 'inference', value: 'CONCLUDES' },
    sourceTable: 'inference_conclusions',
    from: { type: 'inference_step', id: row.inferenceStepId },
    to: { type: 'claim', id: row.claimId },
    attributes: { ordinal: row.ordinal },
    depth,
  })
}

/**
 * Build the candidate edges reachable in one round from a set of inference-step ids.
 *
 * Covers every family a step touches: premise and conclusion rows (the claims
 * the steps reason from and arrive at), both chain-membership paths, and the
 * step-to-step relations.
 *
 * @param expansion Rows the reader returned for those steps.
 * @param view The view whose adjacency rules apply.
 * @param depth Hop distance from the focus, for every node discovered this round.
 */
function stepCandidates(
  expansion: InferenceStepExpansion,
  view: GraphViewRule,
  depth: number,
): CandidateEdge[] {
  const out: CandidateEdge[] = []

  if (viewTraversesFamily(view, 'inference')) {
    // Both step-to-chain attachment paths are emitted, membership rows first: they carry the
    // authored `role` and `ordinal`, and the direct `inference_steps.argument_chain_id` path
    // only adds pairs the join row did not already cover. The dedupe key is the edge id,
    // which is byte-identical for both paths — the same "both reported, neither silently
    // preferred" rule `groupChainsByStep` applies when it reports chains from a step's
    // point of view.
    const seen = new Set<string>()
    for (const row of expansion.chainMemberships) {
      const id = buildEdgeId(
        'inference',
        row.inferenceStepId,
        'MEMBER_OF',
        row.chainId,
      )
      seen.add(id)
      out.push(
        chainMemberCandidate({
          id,
          stepId: row.inferenceStepId,
          chainId: row.chainId,
          sourceTable: 'argument_chain_steps',
          membershipSource: 'argument_chain_steps',
          role: row.role,
          ordinal: row.ordinal,
          depth,
        }),
      )
    }
    for (const link of expansion.declaredChainLinks) {
      const id = buildEdgeId(
        'inference',
        link.stepId,
        'MEMBER_OF',
        link.chainId,
      )
      if (seen.has(id)) continue
      seen.add(id)
      out.push(
        chainMemberCandidate({
          id,
          stepId: link.stepId,
          chainId: link.chainId,
          sourceTable: 'inference_steps',
          membershipSource: 'inference_steps_argument_chain_id',
          role: null,
          ordinal: null,
          depth,
        }),
      )
    }

    // Premise and conclusion rows are emitted from the step side too, not only from a claim
    // frontier: the claims composing an argument must be reachable when the entry point is a
    // chain or a step's neighbour, or a chain focus dead-ends at its steps. The edge id is
    // the claim frontier's byte for byte, so the edges map folds the two emissions into one.
    out.push(...expansion.premises.map((row) => premiseCandidate(row, depth)))
    out.push(
      ...expansion.conclusions.map((row) => conclusionCandidate(row, depth)),
    )
    out.push(
      ...expansion.stepRelations.map((row) =>
        stepRelationCandidate(row, depth),
      ),
    )
  }

  // `evidence_inferences` is a separate family from `inference`: the row records that a step
  // cites an evidence item, not a structural fact about the step's reasoning. 0 rows today.
  if (viewTraversesFamily(view, 'evidence')) {
    for (const row of expansion.evidenceInferences) {
      out.push(evidenceInferenceCandidate(row, depth))
    }
  }

  return out
}

/**
 * Build the candidate edges reachable in one round from a set of argument-chain ids.
 *
 * A chain frontier expands through its `argument_chain_steps` rows, which place each step
 * in the chain. The edge is built from the same projection as a step-frontier membership
 * (same id, same attributes), so a chain reached from a step and a step reached from a
 * chain produce one edge, not two.
 *
 * @param expansion Membership rows the reader returned for those chains.
 * @param view The view whose adjacency rules apply.
 * @param depth Hop distance from the focus, for every node discovered this round.
 */
function chainCandidates(
  expansion: ArgumentChainExpansion,
  view: GraphViewRule,
  depth: number,
): CandidateEdge[] {
  if (!viewTraversesFamily(view, 'inference')) return []
  return expansion.chainMemberships.map((row) =>
    chainMemberCandidate({
      id: buildEdgeId(
        'inference',
        row.inferenceStepId,
        'MEMBER_OF',
        row.chainId,
      ),
      stepId: row.inferenceStepId,
      chainId: row.chainId,
      sourceTable: 'argument_chain_steps',
      membershipSource: 'argument_chain_steps',
      role: row.role,
      ordinal: row.ordinal,
      depth,
    }),
  )
}

/**
 * Project one step-to-chain attachment as a `MEMBER_OF` edge.
 *
 * Authored direction is step → chain regardless of which frontier discovered it: the
 * membership row says a step *belongs to* a chain, and the reverse discovery is a
 * traversal detail (every v1 family is bidirectional anyway).
 *
 * @param input Edge id, endpoints, which attachment path produced it, and its membership
 * data — `role`/`ordinal` from the join row, or null on the direct path.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function chainMemberCandidate(input: {
  id: string
  stepId: string
  chainId: string
  sourceTable: 'argument_chain_steps' | 'inference_steps'
  membershipSource: 'argument_chain_steps' | 'inference_steps_argument_chain_id'
  role: InferenceStepRoleValue | null
  ordinal: number | null
  depth: number
}): CandidateEdge {
  return authored({
    id: input.id,
    type: { family: 'inference', value: 'MEMBER_OF' },
    sourceTable: input.sourceTable,
    from: { type: 'inference_step', id: input.stepId },
    to: { type: 'argument_chain', id: input.chainId },
    attributes: {
      role: input.role,
      ordinal: input.ordinal,
      membershipSource: input.membershipSource,
    },
    depth: input.depth,
  })
}

/**
 * Project one `inference_step_relations` row.
 *
 * @param row The authored step-to-step relation.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function stepRelationCandidate(
  row: InferenceStepRelationRow,
  depth: number,
): CandidateEdge {
  return authored({
    // Prefixed so a step-to-step relation can never collide with a premise or conclusion edge
    // whose relation word happens to match.
    id: buildEdgeId(
      'inference',
      row.sourceInferenceStepId,
      `STEP_${row.relationType}`,
      row.targetInferenceStepId,
    ),
    type: {
      family: 'inference',
      value: row.relationType,
      vocabulary: 'inference_step_relation_type',
    },
    sourceTable: 'inference_step_relations',
    from: { type: 'inference_step', id: row.sourceInferenceStepId },
    to: { type: 'inference_step', id: row.targetInferenceStepId },
    attributes: { description: row.description },
    depth,
  })
}

/**
 * Project one `claim_sources` row as the claim's authored attribution to a source.
 *
 * Direction is claim → source and never reverses: a claim is read from a source; a
 * bibliography entry does not assert a claim. Emitted byte-identically from both the claim
 * frontier and the source frontier, so the edges map folds the two discoveries into one edge.
 *
 * @param row The authored attribution.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function claimSourceCandidate(
  row: ClaimSourceRow,
  depth: number,
): CandidateEdge {
  return authored({
    id: buildEdgeId('source', row.claimId, row.relationship, row.sourceId),
    type: { family: 'source', value: row.relationship },
    sourceTable: 'claim_sources',
    from: { type: 'claim', id: row.claimId },
    to: { type: 'source', id: row.sourceId },
    attributes: {
      quoteOrExcerpt: row.quoteOrExcerpt,
      pageReference: row.pageReference,
      notes: row.notes,
    },
    depth,
  })
}

/**
 * Project one `evidence_claims` row: the evidential relation an evidence item asserts
 * about a claim.
 *
 * Direction is evidence → claim — the evidence item is the citing side in every row of
 * `evidence_claims`, and the edge never presents itself as a claim relation. 0 rows today.
 *
 * @param row The evidential relation.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function evidenceClaimCandidate(
  row: EvidenceClaimRow,
  depth: number,
): CandidateEdge {
  return authored({
    id: buildEdgeId('evidence', row.evidenceId, row.relation, row.claimId),
    type: { family: 'evidence', value: row.relation },
    sourceTable: 'evidence_claims',
    from: { type: 'evidence_item', id: row.evidenceId },
    to: { type: 'claim', id: row.claimId },
    attributes: { strength: row.strength, notes: row.notes },
    depth,
  })
}

/**
 * Project one `evidence_sources` row: where an evidence item was derived from.
 *
 * Direction is evidence → source (default relation `DERIVED_FROM`). Emitted byte-identically
 * from both the evidence frontier and the source frontier. 0 rows today.
 *
 * @param row The derivation row.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function evidenceSourceCandidate(
  row: EvidenceSourceRow,
  depth: number,
): CandidateEdge {
  return authored({
    id: buildEdgeId('evidence', row.evidenceId, row.relation, row.sourceId),
    type: { family: 'evidence', value: row.relation },
    sourceTable: 'evidence_sources',
    from: { type: 'evidence_item', id: row.evidenceId },
    to: { type: 'source', id: row.sourceId },
    attributes: {},
    depth,
  })
}

/**
 * Project one `evidence_inferences` row: an inference step citing an evidence item.
 *
 * Direction is evidence → step (default relation `USED_BY`) — the row is recorded from the
 * evidence item's side, and a step citing evidence is not a premise. 0 rows today.
 *
 * @param row The citation row.
 * @param depth Hop distance from the focus, for both endpoints.
 */
function evidenceInferenceCandidate(
  row: EvidenceInferenceRow,
  depth: number,
): CandidateEdge {
  return authored({
    id: buildEdgeId('evidence', row.evidenceId, row.relation, row.inferenceId),
    type: { family: 'evidence', value: row.relation },
    sourceTable: 'evidence_inferences',
    from: { type: 'evidence_item', id: row.evidenceId },
    to: { type: 'inference_step', id: row.inferenceId },
    attributes: {},
    depth,
  })
}

/**
 * Build the candidate edges reachable in one round from a set of source ids.
 *
 * A source frontier reaches back through the join rows that name it: `claim_sources`
 * (family `source`) and `evidence_sources` (family `evidence`). Both emit the same edge
 * ids as their counterpart frontiers, so a `claim_sources` row discovered from either side
 * folds into one edge rather than two.
 *
 * @param expansion Rows the reader returned for those sources.
 * @param view The view whose adjacency rules apply.
 * @param depth Hop distance from the focus, for every node discovered this round.
 */
function sourceCandidates(
  expansion: SourceExpansion,
  view: GraphViewRule,
  depth: number,
): CandidateEdge[] {
  const out: CandidateEdge[] = []
  if (viewTraversesFamily(view, 'source')) {
    for (const row of expansion.claimSources) {
      out.push(claimSourceCandidate(row, depth))
    }
  }
  if (viewTraversesFamily(view, 'evidence')) {
    for (const row of expansion.evidenceSources) {
      out.push(evidenceSourceCandidate(row, depth))
    }
  }
  return out
}

/**
 * Build the candidate edges reachable in one round from a set of evidence-item ids.
 *
 * Every row of the `evidence_*` join tables is family `evidence`, so the whole round is
 * gated on that one family. 0 rows today: the layer is unpopulated, and the view's
 * blocking gaps — not the absence of candidates — are what the UI reports.
 *
 * @param expansion Rows the reader returned for those evidence items.
 * @param view The view whose adjacency rules apply.
 * @param depth Hop distance from the focus, for every node discovered this round.
 */
function evidenceItemCandidates(
  expansion: EvidenceItemExpansion,
  view: GraphViewRule,
  depth: number,
): CandidateEdge[] {
  if (!viewTraversesFamily(view, 'evidence')) return []
  const out: CandidateEdge[] = []
  for (const row of expansion.evidenceClaims) {
    out.push(evidenceClaimCandidate(row, depth))
  }
  for (const row of expansion.evidenceSources) {
    out.push(evidenceSourceCandidate(row, depth))
  }
  for (const row of expansion.evidenceInferences) {
    out.push(evidenceInferenceCandidate(row, depth))
  }
  return out
}

/** The only `*_entity_type` discriminator the projection will follow in v1. */
const CARD_ENTITY_TYPE = 'CARD'

/** Traversal-bearing wrapper around an authored edge. */
function authored(input: {
  id: string
  type: GraphEdgeType
  sourceTable: string
  from: NodeRef
  to: NodeRef
  attributes: Readonly<Record<string, unknown>>
  depth: number
}): CandidateEdge {
  return {
    edge: {
      id: input.id,
      family: input.type.family,
      type: input.type,
      sourceTable: input.sourceTable,
      from: input.from.id,
      to: input.to.id,
      attributes: input.attributes,
      // Every v1 family is expanded bidirectionally, while `from`/`to` keep the authored
      // direction. A neighbourhood projection has to show both directions or it lies: a card
      // must see the relationships pointing *at* it, and a claim must be reachable from the
      // step that concludes it as well as the step it feeds. The field exists so a future
      // genuinely directed family can say so, and so a consumer never has to infer which it is
      // looking at.
      traversal: 'bidirectional',
    },
    from: input.from,
    to: input.to,
    depth: input.depth,
  }
}

/**
 * Normalise a `*_entity_type` discriminator for the Q5 whitelist.
 *
 * Compared case-insensitively after trimming: the column is free text, and a lowercase `card`
 * is a casing difference rather than an unknown type and should not be reported as a data
 * problem.
 */
function normaliseEntityType(raw: string): string {
  return raw.trim().toUpperCase()
}

// ---------------------------------------------------------------------------
// Node construction
// ---------------------------------------------------------------------------

/**
 * Normalise the `relationship` query filter into a set of match keys.
 *
 * A bare relation word becomes the wildcard `*:WORD`, so `relationship=CHALLENGES` matches
 * every family that uses the word. A `family:WORD` key matches exactly one family, which is
 * how a client asks for authored claim relations without also receiving card links — the
 * external expression of Q1's "keep the two visibly distinct".
 *
 * @param filter The requested edge types, if any.
 * @returns Match keys, or `undefined` when no filter was requested.
 * @example
 * ```ts
 * [...normaliseEdgeFilter(["SUPPORTS"])!]; // ["*:SUPPORTS"]
 * [...normaliseEdgeFilter(["claim_relation:SUPPORTS"])!]; // ["CLAIM_RELATION:SUPPORTS"]
 * ```
 */
export function normaliseEdgeFilter(
  filter: readonly string[] | undefined,
): Set<string> | undefined {
  if (!filter || filter.length === 0) return undefined
  const out = new Set<string>()
  for (const raw of filter) {
    const value = raw.trim()
    if (value.length === 0) continue
    const upper = value.toUpperCase()
    out.add(upper.includes(':') ? upper : `*:${upper}`)
  }
  return out
}

/** Whether an edge satisfies a normalised filter. */
function edgePassesFilter(
  edge: GraphEdge,
  allowed: ReadonlySet<string>,
): boolean {
  const qualified = edgeTypeKey(edge).toUpperCase()
  if (allowed.has(qualified)) return true
  return allowed.has(`*:${edge.type.value.toUpperCase()}`)
}

/** Build every emitted node from hydrated rows, in a deterministic order. */
function buildNodes(
  refs: NodeRefSet,
  distances: ReadonlyMap<string, number>,
  focus: NodeRef,
  hydration: NodeHydration,
  warnings: string[],
): GraphNode[] {
  const cardIds = new Set(refs.cardIds)
  const claimIds = new Set(refs.claimIds)
  const stepIds = new Set(refs.inferenceStepIds)
  const chainIds = new Set(refs.chainIds)
  const collectionIds = new Set(refs.collectionIds)
  const mechanismIds = new Set(refs.mechanismIds)
  const conceptIds = new Set(refs.conceptIds)
  const sourceIds = new Set(refs.sourceIds)
  const evidenceIds = new Set(refs.evidenceIds)

  const axesByCard = groupCardAxes(hydration.cardAxes)
  const suitsByCard = groupCardClassifications(
    hydration.cardCollections,
    (row) => row.collectionId,
  )
  const mechanismsByCard = groupCardClassifications(
    hydration.cardMechanisms,
    (row) => row.mechanismId,
  )
  const chainsByStep = groupChainsByStep(
    hydration.chainMemberships,
    hydration.inferenceSteps,
    hydration.chains,
  )

  const nodes: GraphNode[] = []

  for (const row of hydration.cards) {
    if (!cardIds.has(row.id)) continue
    const axes = axesByCard.get(row.id) ?? []
    if (axes.length === 0) {
      warnings.push(
        `Card ${row.slug} has no card_axes rows, so it exposes no axis. Axis is ` +
          'card_axes.ordinal = 0 and is never derived from primaryType, so this card reports ' +
          'nothing rather than reporting a wrong axis.',
      )
    }
    const classification: CardClassification = buildCardClassification(
      axes,
      suitsByCard.get(row.id) ?? [],
      mechanismsByCard.get(row.id) ?? [],
      groupCardClassifications(hydration.cardLocales, (l) => l.localeId).get(
        row.id,
      ) ?? [],
    )
    const metadata: CardNodeMetadata = {
      slug: row.slug,
      summary: row.summary,
      coreQuestion: row.coreQuestion,
      legacyPrimaryType: row.primaryType,
      legacyPrimaryTypeIsAxis: false,
    }
    const node: CardNode = {
      id: row.id,
      type: 'card',
      label: row.title,
      depth: distanceFor(distances, 'card', row.id),
      isFocus: focus.type === 'card' && focus.id === row.id,
      degree: 0,
      status: { source: 'epistemic_status', value: row.epistemicStatus },
      classification,
      metadata,
    }
    nodes.push(node)
  }

  for (const row of hydration.claims) {
    if (!claimIds.has(row.id)) continue
    const node: ClaimNode = {
      id: row.id,
      type: 'claim',
      label: row.statement,
      depth: distanceFor(distances, 'claim', row.id),
      isFocus: focus.type === 'claim' && focus.id === row.id,
      degree: 0,
      status: { source: 'epistemic_status', value: row.epistemicStatus },
      metadata: {
        claimType: row.claimType,
        description: row.description,
        cardId: row.cardId,
      },
    }
    nodes.push(node)
  }

  for (const row of hydration.inferenceSteps) {
    if (!stepIds.has(row.id)) continue
    const node: InferenceStepNode = {
      id: row.id,
      type: 'inference_step',
      label: row.label,
      depth: distanceFor(distances, 'inference_step', row.id),
      isFocus: false,
      degree: 0,
      // The text column, never the epistemic_status enum (Q4).
      status: {
        source: 'independent_inference_status',
        value: row.epistemicStatus,
        vocabulary: 'uncontrolled',
      },
      metadata: {
        description: row.description,
        inferenceType: row.inferenceType,
        notes: row.notes,
        isCanonical: row.isCanonical,
        cardId: row.cardId,
        chains: chainsByStep.get(row.id) ?? [],
        premises: rowsFor(hydration.premises, 'inferenceStepId', row.id).map(
          (premise) => ({
            claimId: premise.claimId,
            role: premise.role,
            ordinal: premise.ordinal,
          }),
        ),
        conclusions: rowsFor(
          hydration.conclusions,
          'inferenceStepId',
          row.id,
        ).map((conclusion) => ({
          claimId: conclusion.claimId,
          ordinal: conclusion.ordinal,
        })),
      },
    }
    nodes.push(node)
  }

  // Invert both step-to-chain attachment paths into the chain's own membership list, so a
  // chain's `stepIds` reports `inference_steps.argument_chain_id` attachments even when no
  // `argument_chain_steps` row exists — the same both-paths rule `groupChainsByStep` applies
  // when it reports chains from a step's point of view.
  const stepIdsByChain = new Map<string, Set<string>>()
  const attachStep = (chainId: string, stepId: string): void => {
    const set = stepIdsByChain.get(chainId) ?? new Set<string>()
    set.add(stepId)
    stepIdsByChain.set(chainId, set)
  }
  for (const row of hydration.chainMemberships) {
    attachStep(row.chainId, row.inferenceStepId)
  }
  for (const step of hydration.inferenceSteps) {
    if (step.argumentChainId) attachStep(step.argumentChainId, step.id)
  }

  for (const row of hydration.chains) {
    if (!chainIds.has(row.id)) continue
    const node: ArgumentChainNode = {
      id: row.id,
      type: 'argument_chain',
      label: row.label,
      depth: distanceFor(distances, 'argument_chain', row.id),
      isFocus: focus.type === 'argument_chain' && focus.id === row.id,
      degree: 0,
      // The text column, never the epistemic_status enum (Q4) — same rule as a step.
      status: {
        source: 'independent_inference_status',
        value: row.epistemicStatus,
        vocabulary: 'uncontrolled',
      },
      metadata: {
        label: row.label,
        description: row.description,
        kind: row.kind,
        cardId: row.cardId,
        stepIds: [...(stepIdsByChain.get(row.id) ?? [])].sort(),
      },
    }
    nodes.push(node)
  }

  for (const row of uniqueBy(
    hydration.cardCollections,
    (r) => r.collectionId,
  )) {
    if (!collectionIds.has(row.collectionId)) continue
    const node: CollectionNode = {
      id: row.collectionId,
      type: 'collection',
      label: row.name,
      depth: distanceFor(distances, 'collection', row.collectionId),
      isFocus: false,
      degree: 0,
      status: taxonomyStatus(),
      metadata: {
        slug: row.slug,
        description: row.description,
        definition: null,
      },
    }
    nodes.push(node)
  }

  for (const row of uniqueBy(hydration.cardMechanisms, (r) => r.mechanismId)) {
    if (!mechanismIds.has(row.mechanismId)) continue
    const node: MechanismNode = {
      id: row.mechanismId,
      type: 'mechanism',
      label: row.name,
      depth: distanceFor(distances, 'mechanism', row.mechanismId),
      isFocus: false,
      degree: 0,
      status: taxonomyStatus(),
      metadata: {
        slug: row.slug,
        description: row.description,
        definition: null,
      },
    }
    nodes.push(node)
  }

  for (const row of uniqueBy(hydration.cardConcepts, (r) => r.conceptId)) {
    if (!conceptIds.has(row.conceptId)) continue
    const node: ConceptNode = {
      id: row.conceptId,
      type: 'concept',
      label: row.name,
      depth: distanceFor(distances, 'concept', row.conceptId),
      isFocus: false,
      degree: 0,
      status: taxonomyStatus(),
      metadata: {
        slug: row.slug,
        // `concepts` stores `definition` where Mechanism and Collection store `description`.
        // Both metadata keys exist so one TaxonomyNodeMetadata can cover all three tables, so
        // `description` is null here rather than holding a copy of the definition.
        description: null,
        definition: row.definition,
      },
    }
    nodes.push(node)
  }

  for (const row of hydration.sources) {
    if (!sourceIds.has(row.id)) continue
    const node: SourceNode = {
      id: row.id,
      type: 'source',
      label: row.title,
      depth: distanceFor(distances, 'source', row.id),
      isFocus: focus.type === 'source' && focus.id === row.id,
      degree: 0,
      // A bibliography entry asserts nothing, so it carries no epistemic or lifecycle status.
      status: { source: 'none', value: null },
      metadata: {
        title: row.title,
        author: row.author,
        publisher: row.publisher,
        citation: row.citation,
        url: row.url,
        sourceType: row.sourceType,
      },
    }
    nodes.push(node)
  }

  for (const row of hydration.evidenceItems) {
    if (!evidenceIds.has(row.id)) continue
    const node: EvidenceItemNode = {
      id: row.id,
      type: 'evidence_item',
      label: row.title,
      depth: distanceFor(distances, 'evidence_item', row.id),
      isFocus: focus.type === 'evidence_item' && focus.id === row.id,
      degree: 0,
      // The item's own status, free text, never merged with any claim or step status (Q4).
      status: {
        source: 'evidence_status',
        value: row.evidenceStatus,
        vocabulary: 'uncontrolled',
      },
      metadata: {
        evidenceType: row.type,
        locator: row.locator,
        quoteOrExcerpt: row.content,
        // `evidence_claims.strength` is an edge attribute (it describes a relation, not an
        // item), so the node reports null rather than borrowing a joined row's value.
        strength: null,
      },
    }
    nodes.push(node)
  }

  return nodes
}

/** Taxonomy nodes carry no status: a Suit or Mechanism is a browse or analytical dimension, not a truth claim (Q3). */
function taxonomyStatus(): Extract<NodeStatus, { source: 'none' }> {
  return { source: 'none', value: null }
}

/** Filter rows by a string key, preserving order. */
function rowsFor<T, K extends string>(
  rows: readonly T[],
  key: K,
  value: string,
): T[] {
  return rows.filter((row) => (row as Record<K, string>)[key] === value)
}

/** Deduplicate rows by a derived key, preserving first-seen order. */
function uniqueBy<T>(rows: readonly T[], key: (row: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const id = key(row)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(row)
  }
  return out
}

/**
 * Group `card_axes` rows by card, in authored ordinal order.
 *
 * The `primary` marker comes from `ordinal === 0` and nothing else. This single expression is
 * the entirety of Issue #2's "axis is `card_axes.ordinal = 0`, never `primary_type`"
 * requirement, and `primaryType` appears nowhere near it. The whole multi-valued assignment
 * is preserved rather than collapsing to the primary value, because 9 of the 47 seeded cards
 * carry more than one axis and a card can legitimately be both a rhetorical tactic and a
 * theological dispute.
 */
function groupCardAxes(
  rows: NodeHydration['cardAxes'],
): Map<string, AxisAssignment[]> {
  const byCard = new Map<string, AxisAssignment[]>()
  const ordered = [...rows].sort((a, b) => a.ordinal - b.ordinal)
  for (const row of ordered) {
    const assignment: AxisAssignment = {
      axis: row.axis,
      ordinal: row.ordinal,
      primary: row.ordinal === 0,
    }
    const list = byCard.get(row.cardId)
    if (list) list.push(assignment)
    else byCard.set(row.cardId, [assignment])
  }
  return byCard
}

type ClassificationLink = {
  readonly linkId: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
}

/** The columns a classification link row contributes, whichever taxonomy it points at. */
type ClassificationSource = {
  readonly cardId: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
}

/**
 * Group classification link rows by card, sorted by slug.
 *
 * Takes the taxonomy id as a getter rather than a column name, because the two tables it
 * covers spell that column differently (`card_collections.collection_id` versus
 * `card_mechanisms.mechanism_id`) and a union key would need a runtime narrowing branch for a
 * difference the caller already knows.
 *
 * @param rows `card_collections` or `card_mechanisms` rows joined to their taxonomy row.
 * @param taxonomyId Extracts the taxonomy row's id from a link row.
 */
function groupCardClassifications<T extends ClassificationSource>(
  rows: readonly T[],
  taxonomyId: (row: T) => string,
): Map<string, ClassificationLink[]> {
  const byCard = new Map<string, ClassificationLink[]>()
  for (const row of rows) {
    const link: ClassificationLink = {
      linkId: taxonomyId(row),
      slug: row.slug,
      name: row.name,
      description: row.description,
    }
    const list = byCard.get(row.cardId)
    if (list) list.push(link)
    else byCard.set(row.cardId, [link])
  }
  for (const list of byCard.values()) {
    list.sort((a, b) => a.slug.localeCompare(b.slug))
  }
  return byCard
}

/**
 * Build a card's independent classification dimensions.
 *
 * Suits are reported by slug because a Suit is a human-facing browse dimension, and Q3 defers
 * any reconciliation with Issue #2's proposed vocabulary — so nothing here maps, renames, or
 * infers a Suit, and in particular epistemic `CONTESTED` is never surfaced as a Suit called
 * `contested`. Axis, Suit, Mechanism, Locale and Concept stay five separate dimensions.
 *
 * Locale is reported only from `card_locales`. It is not derived from Suit: a Suit is a
 * mutable curation bucket, so a card in the `south-africa` suit is not thereby about South
 * Africa. There is deliberately no default and no fallback here — a card with no locale rows
 * reports an empty list rather than a guess.
 *
 * Suits report ids alongside slugs for the same reason locales do: `collections` and
 * `locales` share the slug `south-africa`, and four cards are in both. A consumer comparing
 * the two lists needs the ids to tell the taxonomies apart, so slug equality between
 * `suits` and `localeSlugs` carries no meaning on its own.
 */
function buildCardClassification(
  axes: readonly AxisAssignment[],
  suits: readonly ClassificationLink[],
  mechanisms: readonly ClassificationLink[],
  locales: readonly ClassificationLink[],
): CardClassification {
  return {
    axes,
    suits: suits.map((suit) => suit.slug),
    suitIds: suits.map((suit) => suit.linkId),
    mechanismSlugs: mechanisms.map((mechanism) => mechanism.slug),
    mechanismIds: mechanisms.map((mechanism) => mechanism.linkId),
    localeSlugs: locales.map((locale) => locale.slug),
    localeIds: locales.map((locale) => locale.linkId),
  }
}

/**
 * Resolve each inference step's chain membership from both attachment paths (Q6).
 *
 * `argument_chain_steps` is preferred because it carries `role` and `ordinal`. A step may also
 * name a chain through `inference_steps.argument_chain_id`, and nothing keeps the two paths in
 * sync. Both are reported, tagged by source, rather than one silently winning, and the
 * disagreement is surfaced by {@link chainMembershipWarnings}.
 */
function groupChainsByStep(
  memberships: readonly ArgumentChainMembershipRow[],
  steps: readonly InferenceStepRow[],
  chains: readonly ArgumentChainRow[],
): Map<string, ArgumentChainMembership[]> {
  const chainsById = new Map<
    string,
    { label: string; kind: ArgumentChainMembership['kind'] }
  >()
  // Seeded from every chain the reader resolved, not just the ones with a membership row.
  // `inference_steps.argument_chain_id` attaches a step to a chain without an
  // `argument_chain_steps` row, and seeding only from memberships would make that second
  // attachment path silently invisible — which is the disagreement Q6 asks to make visible.
  for (const chain of chains) {
    chainsById.set(chain.id, { label: chain.label, kind: chain.kind })
  }
  for (const row of memberships) {
    chainsById.set(row.chainId, { label: row.label, kind: row.kind })
  }

  const byStep = new Map<string, ArgumentChainMembership[]>()
  const add = (stepId: string, entry: ArgumentChainMembership): void => {
    const list = byStep.get(stepId)
    if (list) list.push(entry)
    else byStep.set(stepId, [entry])
  }

  for (const row of memberships) {
    const chain = chainsById.get(row.chainId)
    if (!chain) continue
    add(row.inferenceStepId, {
      id: row.chainId,
      label: chain.label,
      kind: chain.kind,
      role: row.role,
      ordinal: row.ordinal,
      membershipSource: 'argument_chain_steps',
    })
  }

  for (const step of steps) {
    if (!step.argumentChainId) continue
    const list = byStep.get(step.id)
    if (list?.some((entry) => entry.id === step.argumentChainId)) continue
    const chain = chainsById.get(step.argumentChainId)
    if (!chain) continue
    add(step.id, {
      id: step.argumentChainId,
      label: chain.label,
      kind: chain.kind,
      role: null,
      ordinal: null,
      membershipSource: 'inference_steps_argument_chain_id',
    })
  }

  for (const list of byStep.values()) {
    list.sort(
      (a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
    )
  }

  return byStep
}

/**
 * Warn when the two step-to-chain attachment paths disagree.
 *
 * Both are legitimate schema paths and nothing keeps them consistent, so a disagreement is
 * reported rather than resolved.
 */
function chainMembershipWarnings(hydration: NodeHydration): string[] {
  const warnings: string[] = []
  const membershipChainIds = new Map<string, Set<string>>()
  for (const row of hydration.chainMemberships) {
    const set = membershipChainIds.get(row.inferenceStepId) ?? new Set<string>()
    set.add(row.chainId)
    membershipChainIds.set(row.inferenceStepId, set)
  }
  for (const step of hydration.inferenceSteps) {
    if (!step.argumentChainId) continue
    const declared = membershipChainIds.get(step.id)
    if (declared && !declared.has(step.argumentChainId)) {
      warnings.push(
        `Inference step ${step.id} names argument chain ${step.argumentChainId} via ` +
          'inference_steps.argument_chain_id but has no argument_chain_steps row for it. Both ' +
          'are reported; neither path was silently preferred.',
      )
    }
  }
  return warnings
}

/**
 * Warn when a data-blocked view's declared node types have no rows in the corpus.
 *
 * The check reads `readPopulation()` — whole-table row counts — rather than the hydrated
 * rows of this projection, so the warning says what is true of the corpus: a focused
 * projection over a populated table reports no warning just because the focus happened to
 * have no neighbours, and an unpopulated table is named with the exact gap string
 * {@link viewBlockingGaps} reports in the views catalogue, without an import cycle.
 *
 * A structurally valid view over an unpopulated corpus returns 200 with `nodes: []` and
 * this note, which is how `view=evidence` behaves today. Reporting it here rather than as
 * an error is what keeps an unpopulated layer distinguishable from a malformed request —
 * "0 rows in the corpus" versus "failed to load".
 *
 * @param reader Read-only port over `trope_graph`, for the corpus row counts.
 * @param view The view being projected.
 * @returns One note per blocked view with gaps; `[]` otherwise.
 */
async function populationWarnings(
  reader: TropeGraphReader,
  view: GraphViewRule,
): Promise<string[]> {
  if (view.status !== 'data_blocked') return []
  const population = await reader.readPopulation()
  const gaps = viewBlockingGaps(view, population)
  if (gaps.length === 0) return []
  return [
    `View "${view.name}" is data-blocked: ${gaps.join('; ')}. This is an ` +
      'empty projection, not an error; the schema for these types exists and the view becomes ' +
      'populated as the corpus lands.',
  ]
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Drop any edge whose endpoints are not both in the emitted node set, then deduplicate by id.
 *
 * This is the enforcement point for invariants 1 and 3 of `docs/GRAPH_PROJECTION_DESIGN.md`
 * §6 ("every edge endpoint id is present in nodes", "no edge references an excluded node"). It
 * is a safety net rather than the primary mechanism — the BFS admits an edge only after
 * registering both endpoints, and `include` filtering removes a node before hydration — but a
 * future change to either path would reintroduce a dangling edge, and this is where it would be
 * caught rather than shipped to a client.
 *
 * @param collected Edges admitted during the BFS, keyed by edge id.
 * @param allowedRefs `type|id` keys of the nodes actually emitted.
 * @returns Deduplicated edges whose endpoints are all emitted.
 * @example
 * ```ts
 * const edges = normaliseEdges(new Map(), new Set(["card|abc"]));
 * edges.length; // 0
 * ```
 */
export function normaliseEdges(
  collected: ReadonlyMap<string, CandidateEdge>,
  allowedRefs: ReadonlySet<string>,
  emittedNodeIds: ReadonlySet<string>,
  warnings: string[],
): GraphEdge[] {
  const allowed = new Set<string>()
  for (const key of allowedRefs) {
    allowed.add(key.slice(key.indexOf('|') + 1))
  }
  const out: GraphEdge[] = []
  const seen = new Set<string>()
  const dropped = new Set<string>()
  for (const candidate of collected.values()) {
    // Two different reasons an endpoint can be absent, and the distinction matters:
    //
    // - Not in `allowedRefs`: the view excludes the node type, or the caller's `include`
    //   filter removed it. The edge is correctly absent and there is nothing to report.
    // - In `allowedRefs` and in `discovered`, but no node was emitted for it: hydration found
    //   no row, so the reference does not resolve. This is a data problem and it is reported,
    //   because silently dropping it is how a broken pointer becomes invisible.
    for (const endpoint of [candidate.edge.from, candidate.edge.to]) {
      if (!allowed.has(endpoint)) continue
      if (emittedNodeIds.has(endpoint)) continue
      const note =
        `Edge ${candidate.edge.id} (${candidate.edge.family}:${candidate.edge.type.value} ` +
        `from ${candidate.edge.sourceTable}) references ${endpoint}, which does not ` +
        'resolve to a node in this projection. The edge was dropped rather than emitted ' +
        'with a missing endpoint.'
      if (dropped.has(note)) continue
      dropped.add(note)
      warnings.push(note)
    }
    if (!allowed.has(candidate.edge.from)) continue
    if (!allowed.has(candidate.edge.to)) continue
    if (!emittedNodeIds.has(candidate.edge.from)) continue
    if (!emittedNodeIds.has(candidate.edge.to)) continue
    if (seen.has(candidate.edge.id)) continue
    seen.add(candidate.edge.id)
    out.push(candidate.edge)
  }
  return out
}

/** Split a set of ref keys back into typed id lists for hydration. */
function splitRefs(
  allowed: ReadonlySet<string>,
  discovered: ReadonlyMap<string, NodeRef>,
): NodeRefSet {
  const cardIds: string[] = []
  const claimIds: string[] = []
  const inferenceStepIds: string[] = []
  const chainIds: string[] = []
  const collectionIds: string[] = []
  const mechanismIds: string[] = []
  const conceptIds: string[] = []
  const sourceIds: string[] = []
  const evidenceIds: string[] = []

  for (const key of allowed) {
    const ref = discovered.get(key)
    if (!ref) continue
    switch (ref.type) {
      case 'card':
        cardIds.push(ref.id)
        break
      case 'claim':
        claimIds.push(ref.id)
        break
      case 'inference_step':
        inferenceStepIds.push(ref.id)
        break
      case 'argument_chain':
        chainIds.push(ref.id)
        break
      case 'collection':
        collectionIds.push(ref.id)
        break
      case 'mechanism':
        mechanismIds.push(ref.id)
        break
      case 'concept':
        conceptIds.push(ref.id)
        break
      case 'source':
        sourceIds.push(ref.id)
        break
      case 'evidence_item':
        evidenceIds.push(ref.id)
        break
      default:
        // A view may declare a node type the reader cannot hydrate. Reaching this means the
        // view registry and the reader disagree, which `test/graph-projection.test.ts` asserts
        // cannot happen: every declared node type must be a type the reader can resolve.
        break
    }
  }

  return {
    cardIds,
    claimIds,
    inferenceStepIds,
    chainIds,
    collectionIds,
    mechanismIds,
    conceptIds,
    sourceIds,
    evidenceIds,
  }
}

/** Look up a node's hop distance from the focus. */
function distanceFor(
  distances: ReadonlyMap<string, number>,
  type: GraphNodeType,
  id: string,
): number {
  return distances.get(`${type}|${id}`) ?? 0
}

/** A minimal request for `view` at the default depth and cap. */
export function defaultRequest(
  focus: string,
  view: GraphViewRule,
): GraphProjectionRequest {
  return { focus, view, depth: DEFAULT_DEPTH, maxNodes: DEFAULT_MAX_NODES }
}

/**
 * The projection's hard limits, re-exported so the HTTP layer and the projection cannot drift.
 */
export const PROJECTION_LIMITS = {
  DEFAULT_DEPTH,
  DEFAULT_MAX_NODES,
  HARD_MAX_DEPTH,
  HARD_MAX_NODES,
} as const

/** An argument-chain node, exported for the argument view and its tests. */
/** An inference step row, exported for callers building argument views. */
/** A claim row, exported for callers that need to filter claims by card. */
export type {
  ArgumentChainNode,
  ArgumentChainRow,
  CardRow,
  ClaimExpansion as ClaimExpansionResult,
  ClaimRow,
  InferenceStepRow,
}
