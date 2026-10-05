/**
 * Domain-level types for Trope Graph projections.
 *
 * These are the wire types of `GET /api/graph`. They are deliberately *not* Graphology or
 * Cytoscape shapes: a Graphology `Graph` and a Cytoscape `Elements` collection are library
 * objects whose fields change between versions, and `docs/ADR_GRAPH_LAYER.md` §3 requires
 * that neither leak past the server. The invariant this module encodes is that a projection
 * is `{ nodes, edges, meta }` in the vocabulary of `trope_graph` and nothing else.
 *
 * Two ontology rules from issue #3 are enforced by the *type system* here rather than by
 * convention, because convention is what produced the bugs this projection was written to
 * avoid:
 *
 * 1. **Status is per node type and is never rolled up** (Q4). `cards.epistemic_status` and
 *    `claims.epistemic_status` are the `epistemic_status` enum, but `inference_steps` and
 *    `argument_chains` carry a same-named column that is free `text` with an independent
 *    vocabulary, and the lifecycle tables carry four more unrelated enums. {@link GraphNode}
 *    is a discriminated union whose `status` variants are not assignable to one another, so
 *    a projection that tried to sum, filter, or compare status across node types would not
 *    typecheck.
 *
 * 2. **A direct claim relation is not an inference** (Q1 and the "additional graph-semantic
 *    rule" in issue #3). `Claim A --SUPPORTS--> Claim B` is authored in `claim_relations`.
 *    `Claim A --PREMISE_OF--> Step --CONCLUDES--> Claim B` is reconstructed from
 *    `inference_premises` / `inference_conclusions`. Both use the word `SUPPORTS` in some
 *    form, and the schema has no cross-mapping between the vocabularies. {@link GraphEdge}
 *    therefore carries a mandatory {@link EdgeFamily}, and the edge `type` unions are keyed
 *    by family: a `claim_relation` edge and a `card_relationship` edge that both carry the
 *    word `SUPPORTS` are different types and cannot be merged by a consumer that narrows on
 *    `family`.
 *
 * Vocabulary unions are derived from the Drizzle `pgEnum` declarations rather than
 * restated as string literals, so adding an enum member is a compile error here instead of a
 * silently unprojectable value at runtime.
 */

import type {
  argumentChainKindEnum,
  inferenceStepRelationTypeEnum,
  inferenceStepRoleEnum,
} from '../db/schema/argumentChains'
import type {
  claimRelationTypeEnum,
  inferencePremiseRoleEnum,
  inferenceTypeEnum,
} from '../db/schema/claimDecomposition'
import type {
  cardAxis,
  cardType,
  caseStatus,
  claimType,
  epistemicStatus,
  questionStatus,
  relationshipStatus,
  relationshipType,
} from '../db/schema/tropeGraph'

// ---------------------------------------------------------------------------
// Vocabularies, derived from the canonical schema
// ---------------------------------------------------------------------------

/** The `card_axis` vocabulary: how a card is arguing. */
export type CardAxisValue = (typeof cardAxis)['enumValues'][number]

/** The `epistemic_status` enum, as used by `cards`, `claims` and `interpretations`. */
export type EpistemicStatusValue =
  (typeof epistemicStatus)['enumValues'][number]

/** The legacy `card_type` vocabulary carried by `cards.primary_type`. See {@link CardNodeMetadata}. */
export type CardTypeValue = (typeof cardType)['enumValues'][number]

/** The `claim_type` vocabulary. */
export type ClaimTypeValue = (typeof claimType)['enumValues'][number]

/** The `case_status` lifecycle vocabulary. */
export type CaseStatusValue = (typeof caseStatus)['enumValues'][number]

/** The `question_status` lifecycle vocabulary. */
export type QuestionStatusValue = (typeof questionStatus)['enumValues'][number]

/** The `relationship_status` vocabulary for `relationships`. */
export type RelationshipStatusValue =
  (typeof relationshipStatus)['enumValues'][number]

/** The `relationship_type` vocabulary for the polymorphic `relationships` table. */
export type RelationshipValue = (typeof relationshipType)['enumValues'][number]

/** The `claim_relation_type` vocabulary: direct semantic claim-to-claim relations. */
export type ClaimRelationValue =
  (typeof claimRelationTypeEnum)['enumValues'][number]

/** The `inference_type` vocabulary for reasoning steps. */
export type InferenceTypeValue =
  (typeof inferenceTypeEnum)['enumValues'][number]

/** The `inference_premise_role` vocabulary for a claim's role in an inference. */
export type InferencePremiseRoleValue =
  (typeof inferencePremiseRoleEnum)['enumValues'][number]

/** The `inference_step_relation_type` vocabulary: relations between reasoning steps. */
export type InferenceStepRelationValue =
  (typeof inferenceStepRelationTypeEnum)['enumValues'][number]

/** The `argument_chain_kind` vocabulary. */
export type ArgumentChainKindValue =
  (typeof argumentChainKindEnum)['enumValues'][number]

/** The `inference_step_role` vocabulary for a step's role inside a chain. */
export type InferenceStepRoleValue =
  (typeof inferenceStepRoleEnum)['enumValues'][number]

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

/**
 * Every entity the graph model can represent.
 *
 * The union is wider than any single view emits. That is deliberate: `/api/graph/views`
 * reports a node type as `reserved` rather than forgetting it exists, so an empty
 * `evidence_items` table produces an empty graph with a warning rather than an ontology that
 * quietly forgets the evidence layer. Issue #3 Q2 is the precedent — Concept stays a
 * first-class member of this union (kept + populated) even though `card-argument-taxonomy`
 * emits no concept nodes yet (0 `card_concepts` rows).
 */
export type GraphNodeType =
  | 'card'
  | 'claim'
  | 'inference_step'
  | 'argument_chain'
  | 'collection'
  | 'mechanism'
  | 'concept'
  | 'source'
  | 'evidence_item'
  | 'case'
  | 'interpretation'
  | 'question'

/**
 * A node's status, tagged with where it came from.
 *
 * The variants are deliberately not interchangeable. A consumer that wants "is this
 * established?" must narrow to {@link EpistemicStatusNodeStatus}; a consumer that wants the
 * status of an inference step gets free text, because that is what the schema stores. There
 * is no operation on this union that yields a graph-wide status, which is the point of Q4.
 */
export type NodeStatus =
  /** `epistemic_status` enum: `cards`, `claims`, `interpretations`. */
  | {
      readonly source: 'epistemic_status'
      readonly value: EpistemicStatusValue
    }
  /**
   * `epistemic_status` declared as free `text`: `inference_steps`, `argument_chains`.
   *
   * Kept as a string rather than widened to the enum on purpose. See the "epistemic
   * separation" section of `docs/CLAIM_DECOMPOSITION_ENGINE.md` and Q4: the status of a
   * reasoning step is independent of the status of any claim it consumes.
   */
  | {
      readonly source: 'independent_inference_status'
      readonly value: string
      readonly vocabulary: 'uncontrolled'
    }
  /** `evidence_items.evidence_status`: text, and the only part of the ontology with no vocabulary at all. */
  | {
      readonly source: 'evidence_status'
      readonly value: string
      readonly vocabulary: 'uncontrolled'
    }
  /** A lifecycle enum (`case_status`, `question_status`, `relationship_status`). */
  | {
      readonly source: 'lifecycle_status'
      readonly value: string
      readonly vocabulary: string
    }
  /** Taxonomy nodes carry no status: Suit, Mechanism and Concept are browse/analytical dimensions, not truth claims. */
  | { readonly source: 'none'; readonly value: null }

/**
 * The authored axis classification of a card, in order.
 *
 * Multi-axis is the modelled reality, not an edge case: 9 of the 47 seeded cards carry more
 * than one axis, and the unique index on `(card_id, ordinal)` is what makes "exactly one
 * primary axis" a schema invariant. `ordinal` is therefore always carried, and `primary` is
 * always derived from `ordinal === 0` — never from `cards.primary_type`, which is legacy,
 * write-only, and disagrees with axis on real cards (Q3 and Issue #2).
 */
export type AxisAssignment = {
  readonly axis: CardAxisValue
  readonly ordinal: number
  readonly primary: boolean
}

/**
 * Classification attached to a card node.
 *
 * Suit/Collection, Axis, Mechanism, Locale and Concept are five independent dimensions
 * (`ADR_GRAPH_LAYER.md` §7). This bag groups them for transport only; nothing in the
 * projection reads one to infer another.
 */
export type CardClassification = {
  /** Bilingual: a card can be argued both as a rhetorical tactic and as a theological dispute. */
  readonly axes: readonly AxisAssignment[]
  /**
   * Slugs of the `collections` a card belongs to, sorted.
   *
   * Slugs rather than ids because a Suit is a human-facing browse dimension and the live
   * vocabulary (`classic`, `zionism-coded`, `south-africa`, `fact-rebuttal`, `foundational`)
   * is what consumers filter and display on. Q3 explicitly defers reconciling this
   * vocabulary against Issue #2's proposed five values; the projection reports what the
   * database holds and invents no mapping. In particular it never maps epistemic
   * `CONTESTED` onto a Suit called `contested`.
   *
   * Display-only. Consumers that need to act on a Suit — resolving it, comparing it, or
   * curating with it — must use {@link suitIds}, because `locales` legitimately contains a
   * slug of the same name.
   */
  readonly suits: readonly string[]
  /**
   * `collections.id` for each entry of {@link suits}, in the same order.
   *
   * Present because `locales` and `collections` are separate taxonomies that share at least
   * one slug (`south-africa` names both, and four cards are in both). Slug equality across
   * those two lists therefore means nothing on its own, so a client that cannot ask the
   * database which `south-africa` was meant has no way to tell a Suit from a Locale.
   */
  readonly suitIds: readonly string[]
  readonly mechanismSlugs: readonly string[]
  readonly mechanismIds: readonly string[]
  /**
   * Slugs of the `locales` a card is set in, sorted.
   *
   * Read only from `card_locales`, never inferred from Suit: a card curated into the
   * `south-africa` collection is not thereby a South Africa card. A card with no locale rows
   * reports an empty list.
   */
  readonly localeSlugs: readonly string[]
  /** `locales.id` for each entry of {@link localeSlugs}, in the same order. */
  readonly localeIds: readonly string[]
}

/** Card-specific metadata. Every field here is card-owned; none is derived from another. */
export type CardNodeMetadata = {
  readonly slug: string
  readonly summary: string | null
  readonly coreQuestion: string | null
  /**
   * `cards.primary_type`, reported verbatim and explicitly marked as non-classificatory.
   *
   * Exposed because the column is authored data and dropping it would be silent loss, and
   * flagged because nothing may read it as an axis. `deriveAxisFromPrimaryType` does not
   * exist; `test/graph-projection.test.ts` asserts the projection emits the same axes as the
   * `card_axes` rows even when `primary_type` disagrees.
   */
  readonly legacyPrimaryType: CardTypeValue
  readonly legacyPrimaryTypeIsAxis: false
}

/** Claim-specific metadata. */
export type ClaimNodeMetadata = {
  readonly claimType: ClaimTypeValue
  readonly description: string | null
  /** `claims.card_id`: the research entry point that carries the claim. Never the claim's identity. */
  readonly cardId: string
}

/**
 * Chain membership carried as metadata on an inference step.
 *
 * Issue #3 Q6: `argument_chains` is grouping metadata in a general card graph and a
 * first-class node only in the argument view. Both read the same rows.
 *
 * `role` and `ordinal` come from `argument_chain_steps`. The schema also lets a step name a
 * chain directly through `inference_steps.argument_chain_id` (ON DELETE SET NULL), and the
 * two attachment paths can disagree — `membershipSource` records which one produced this
 * entry so a disagreement is visible rather than silently resolved.
 */
export type ArgumentChainMembership = {
  readonly id: string
  readonly label: string
  readonly kind: ArgumentChainKindValue
  readonly role: InferenceStepRoleValue | null
  readonly ordinal: number | null
  readonly membershipSource:
    | 'argument_chain_steps'
    | 'inference_steps_argument_chain_id'
}

export type InferenceStepNodeMetadata = {
  readonly description: string
  readonly inferenceType: InferenceTypeValue
  readonly notes: string | null
  /**
   * `inference_steps.is_canonical`. A boolean lifecycle-ish flag that is deliberately *not*
   * folded into the step's free-text status: the schema keeps them apart and so does this.
   */
  readonly isCanonical: boolean
  readonly cardId: string
  /** Present in the argument view; in a general card view the chains are described here instead. */
  readonly chains: readonly ArgumentChainMembership[]
  readonly premises: readonly {
    readonly claimId: string
    readonly role: InferencePremiseRoleValue
    readonly ordinal: number
  }[]
  readonly conclusions: readonly {
    readonly claimId: string
    readonly ordinal: number
  }[]
}

/** A named path through one or more inference steps. First-class node only in the argument view. */
export type ArgumentChainNodeMetadata = {
  readonly label: string
  readonly description: string
  readonly kind: ArgumentChainKindValue
  readonly cardId: string
  readonly stepIds: readonly string[]
}

export type TaxonomyNodeMetadata = {
  readonly slug: string
  readonly description: string | null
  /** Concept rows store `definition`; Mechanism and Collection store `description`. */
  readonly definition: string | null
}

/** Source nodes exist in the model; `sources` has 0 rows, so no view emits one yet. */
export type SourceNodeMetadata = {
  readonly title: string
  readonly author: string | null
  readonly publisher: string | null
  readonly citation: string | null
  readonly url: string | null
  readonly sourceType: string | null
}

/** Evidence nodes exist in the model; the whole `evidence_*` layer is schema-only today. */
export type EvidenceItemNodeMetadata = {
  readonly evidenceType: string
  readonly locator: string | null
  readonly quoteOrExcerpt: string | null
  readonly strength: string | null
}

export type CaseNodeMetadata = {
  readonly title: string
  readonly description: string | null
  readonly dateStart: string | null
  readonly dateEnd: string | null
  readonly location: string | null
}

export type InterpretationNodeMetadata = {
  readonly title: string
  readonly description: string
  readonly cardId: string
}

export type QuestionNodeMetadata = {
  readonly question: string
  readonly description: string | null
}

/**
 * Fields every node has regardless of type.
 *
 * @typeParam T The node's entity type, which selects the `status` and `metadata` variants.
 */
type GraphNodeBase<T extends GraphNodeType> = {
  /**
   * Canonical identity: the `trope_graph` primary-key uuid.
   *
   * Issue #3 Q7. Never a slug, a title, or a `claim.statement`: `claims` has no slug at all,
   * and text identity would change whenever an author rewrites a sentence. Slugs appear only
   * as `metadata.slug` on the node types that have one, and as a `focus` alias.
   */
  readonly id: string
  readonly type: T
  /** Display label. `card.title`, `claim.statement`, `inference_steps.label`, taxonomy `name`. */
  readonly label: string
  /** Hop distance from the focus node, within the requested view's adjacency rules (Q9). */
  readonly depth: number
  readonly isFocus: boolean
  /** Cardinality: how many asserted edges reference this node within the projection. */
  readonly degree: number
}

/** A research card. The editorial entry point into the graph, not the atomic unit of truth. */
export type CardNode = GraphNodeBase<'card'> & {
  readonly status: Extract<NodeStatus, { source: 'epistemic_status' }>
  readonly classification: CardClassification
  readonly metadata: CardNodeMetadata
}

/** An assertion made by a card. Never a card, never evidence. */
export type ClaimNode = GraphNodeBase<'claim'> & {
  readonly status: Extract<NodeStatus, { source: 'epistemic_status' }>
  readonly metadata: ClaimNodeMetadata
}

/** A reasoning bridge. Its status is independent text, not the `epistemic_status` enum. */
export type InferenceStepNode = GraphNodeBase<'inference_step'> & {
  readonly status: Extract<
    NodeStatus,
    { source: 'independent_inference_status' }
  >
  readonly metadata: InferenceStepNodeMetadata
}

/** Argument chain status is likewise independent text. */
export type ArgumentChainNode = GraphNodeBase<'argument_chain'> & {
  readonly status: Extract<
    NodeStatus,
    { source: 'independent_inference_status' }
  >
  readonly metadata: ArgumentChainNodeMetadata
}

/**
 * A Suit/Collection. A curated browse/deck grouping with no truth claim attached, which is
 * why it has no epistemic status (Q3).
 */
export type CollectionNode = GraphNodeBase<'collection'> & {
  readonly status: Extract<NodeStatus, { source: 'none' }>
  readonly metadata: TaxonomyNodeMetadata
}

/** An analytical dimension. No truth claim attached. */
export type MechanismNode = GraphNodeBase<'mechanism'> & {
  readonly status: Extract<NodeStatus, { source: 'none' }>
  readonly metadata: TaxonomyNodeMetadata
}

/** First-class per Q2. Emitted only once `card_concepts` rows exist. */
export type ConceptNode = GraphNodeBase<'concept'> & {
  readonly status: Extract<NodeStatus, { source: 'none' }>
  readonly metadata: TaxonomyNodeMetadata
}

export type SourceNode = GraphNodeBase<'source'> & {
  readonly status: Extract<NodeStatus, { source: 'none' }>
  readonly metadata: SourceNodeMetadata
}

export type EvidenceItemNode = GraphNodeBase<'evidence_item'> & {
  readonly status: Extract<NodeStatus, { source: 'evidence_status' }>
  readonly metadata: EvidenceItemNodeMetadata
}

export type CaseNode = GraphNodeBase<'case'> & {
  readonly status: Extract<NodeStatus, { source: 'lifecycle_status' }>
  readonly metadata: CaseNodeMetadata
}

/** `interpretations.status` is the `epistemic_status` enum, unlike the inference tables' text column. */
export type InterpretationNode = GraphNodeBase<'interpretation'> & {
  readonly status: Extract<NodeStatus, { source: 'epistemic_status' }>
  readonly metadata: InterpretationNodeMetadata
}

export type QuestionNode = GraphNodeBase<'question'> & {
  readonly status: Extract<NodeStatus, { source: 'lifecycle_status' }>
  readonly metadata: QuestionNodeMetadata
}

/**
 * Any node the projection can emit.
 *
 * A discriminated union on `type`, so a consumer switching on `node.type` gets the correct
 * metadata shape and cannot read `card.classification` off a claim.
 */
export type GraphNode =
  | CardNode
  | ClaimNode
  | InferenceStepNode
  | ArgumentChainNode
  | CollectionNode
  | MechanismNode
  | ConceptNode
  | SourceNode
  | EvidenceItemNode
  | CaseNode
  | InterpretationNode
  | QuestionNode

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

/**
 * The vocabularies that reuse the same relation words with no cross-mapping.
 *
 * `SUPPORTS` alone appears as a `claim_relation_type`, a `relationship_type`, an
 * `evidence_claims.relation` string and an `inference_premise_role`-adjacent concept. The
 * design doc's §4.1 table lists five such vocabularies; the families below name the four
 * that participate in a v1 projection.
 */
export type EdgeFamily =
  /** `claims.card_id`: a card asserts a claim. The only assertion-direction edge in v1. */
  | 'domain'
  /** `claim_relations`: direct semantic claim-to-claim relations. Q1: kept, and never derived from inference steps. */
  | 'claim_relation'
  /** `inference_premises`, `inference_conclusions`, `inference_step_relations`: reconstructed reasoning structure. */
  | 'inference'
  /** `relationships`: the polymorphic table. Q5: whitelisted and endpoint-resolved, never trusted blind. */
  | 'card_relationship'
  /** `card_collections`, `card_mechanisms`: browse/analytical facets, semantically not argument edges. */
  | 'classification'

/**
 * The edge `type`, keyed by the family that produced it.
 *
 * The indirection is the whole design. `claim_relation: 'SUPPORTS'` and
 * `card_relationship: 'SUPPORTS'` are different types with different endpoints, different
 * provenance, and different authority; a consumer that wants one cannot accidentally receive
 * the other. Presenting them as a single `SUPPORTS` edge would be exactly the collapse issue
 * #3 forbids.
 */
export type GraphEdgeType =
  /** A card makes a claim: `claims.card_id`. */
  | { readonly family: 'domain'; readonly value: 'ASSERTS' }
  /** A claim is a premise of a reasoning step: `inference_premises`, carrying `role` and `ordinal`. */
  | { readonly family: 'inference'; readonly value: 'PREMISE_OF' }
  /** A reasoning step concludes a claim: `inference_conclusions`, carrying `ordinal`. */
  | { readonly family: 'inference'; readonly value: 'CONCLUDES' }
  /** Relations between reasoning steps: `inference_step_relations`. */
  | {
      readonly family: 'inference'
      readonly value: InferenceStepRelationValue
      readonly vocabulary: 'inference_step_relation_type'
    }
  /** Direct semantic claim-to-claim relations: `claim_relations`. */
  | { readonly family: 'claim_relation'; readonly value: ClaimRelationValue }
  /** Card-to-card relations: `relationships`, after the Q5 endpoint checks. */
  | { readonly family: 'card_relationship'; readonly value: RelationshipValue }
  /** A card sits in a Suit: `card_collections`. */
  | { readonly family: 'classification'; readonly value: 'IN_SUIT' }
  /** A card uses a Mechanism: `card_mechanisms`. */
  | { readonly family: 'classification'; readonly value: 'HAS_MECHANISM' }

/**
 * A resolved edge.
 *
 * `id` is a deterministic composite (see `buildEdgeId`), not a database uuid, because two
 * families can relate the same pair of nodes and `relationships` can hold two rows for one
 * pair distinguished only by `status`. Determinism matters more than brevity here: the same
 * request against the same corpus must produce the same ids so a client can diff two
 * projections.
 */
export type GraphEdge = {
  readonly id: string
  readonly family: EdgeFamily
  readonly type: GraphEdgeType
  /**
   * The canonical table the relation word came from: `claim_relations`,
   * `inference_premises`, `relationships`, `card_collections`, and so on.
   *
   * Carried on every edge because the relation words have no cross-mapping; a consumer
   * rendering `SUPPORTS` needs to know whether it is reading an authored claim relation or a
   * presentation-class card link.
   */
  readonly sourceTable: string
  readonly from: string
  readonly to: string
  readonly attributes: Readonly<Record<string, unknown>>
  /**
   * Whether traversal may cross this edge in both directions.
   *
   * `from`/`to` always preserve the authored direction; this only governs expansion. A card
   * should see the relationships that point *at* it, so `relationships` and the
   * premise/conclusion edges expand bidirectionally, while the semantic assertion direction
   * is retained for anyone reading the edge.
   */
  readonly traversal: 'directed' | 'bidirectional'
}

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

/** `meta` is where truncation, counts and non-fatal data problems surface. */
export type GraphProjectionMeta = {
  readonly nodeCount: number
  readonly edgeCount: number
  /** True when `maxNodes` stopped expansion before the requested depth was exhausted. */
  readonly truncated: boolean
  /** Effective node cap, echoed so a client can tell a small graph from a capped one. */
  readonly maxNodes: number
  /** The depth actually reached, which is lower than `depth` when expansion ran out of nodes. */
  readonly reachedDepth: number
  /**
   * Non-fatal problems: unresolvable `relationships` rows (Q5), chain-attachment
   * disagreements, entity types outside the whitelist, and views whose data is not yet
   * populated.
   *
   * An empty-but-valid projection returns `200` with `nodes: []` and a warning here rather
   * than an error, so an unpopulated layer is distinguishable from a broken request.
   */
  readonly warnings: readonly string[]
}

/**
 * The `GET /api/graph` response body.
 *
 * This is the whole API contract. No library type appears in it, and nothing in it is
 * persisted: Q10 keeps projections computed on demand, and any future cache is derived data
 * that can never become canonical.
 */
export type GraphProjection = {
  readonly focus: {
    readonly id: string
    readonly type: GraphNodeType
    /** Present when the focus was addressed by slug. Absent for uuid-addressed focus and for types with no slug. */
    readonly slug: string | null
  }
  readonly view: string
  readonly depth: number
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly meta: GraphProjectionMeta
}
