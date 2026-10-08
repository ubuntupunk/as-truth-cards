/**
 * The read port the projection reads through.
 *
 * The projection does not import Drizzle and does not know it is talking to Postgres. That
 * separation is what makes the normalization invariants testable without a database: the
 * tests drive the BFS and the invariant checks with an in-memory fake, and the same code
 * runs against `trope_cards_dev` in the integration test.
 *
 * The port is shaped around breadth-first *rounds* rather than around tables. Each method
 * answers "given the ids discovered in the previous round, what is adjacent?" That keeps the
 * depth semantics of Q9 in one place — the projection decides what a round means, the reader
 * never decides what counts as a hop — and it avoids a single recursive SQL query whose
 * depth behaviour would be hard to reason about or cap.
 *
 * Every method must be read-only. Nothing here writes, and nothing here may read outside the
 * `trope_graph` schema: `public.cards` is a separate, transitional Prisma deck model and
 * issue #3 Q8 forbids the projection from bridging to it or reviving it as canonical.
 */

import type {
  ArgumentChainKindValue,
  CardAxisValue,
  CardTypeValue,
  ClaimRelationValue,
  ClaimTypeValue,
  EpistemicStatusValue,
  InferencePremiseRoleValue,
  InferenceStepRelationValue,
  InferenceStepRoleValue,
  InferenceTypeValue,
  RelationshipStatusValue,
  RelationshipValue,
} from './types'

/** One `cards` row, as the projection needs it. */
export type CardRow = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly summary: string | null
  readonly coreQuestion: string | null
  readonly primaryType: CardTypeValue
  readonly epistemicStatus: EpistemicStatusValue
}

/** A ranked card search hit, returned by {@link TropeGraphReader.searchCards}. */
export type CardSearchResult = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly summary: string | null
  /** Rank, higher is better. Semantics are implementation-defined but monotonic. */
  readonly rank: number
}

/** One `claims` row. */
export type ClaimRow = {
  readonly id: string
  readonly cardId: string
  readonly statement: string
  readonly claimType: ClaimTypeValue
  readonly description: string | null
  readonly epistemicStatus: EpistemicStatusValue
}

/** One `inference_steps` row. */
export type InferenceStepRow = {
  readonly id: string
  readonly cardId: string
  readonly label: string
  readonly description: string
  readonly inferenceType: InferenceTypeValue
  /** Free `text` by design. Never merged with a claim's enum status (Q4). */
  readonly epistemicStatus: string
  readonly notes: string | null
  readonly isCanonical: boolean
  /** `inference_steps.argument_chain_id`, the second of the two step-to-chain attachment paths. */
  readonly argumentChainId: string | null
}

/** One `inference_premises` row. */
export type InferencePremiseRow = {
  readonly inferenceStepId: string
  readonly claimId: string
  readonly role: InferencePremiseRoleValue
  readonly ordinal: number
}

/** One `inference_conclusions` row. */
export type InferenceConclusionRow = {
  readonly inferenceStepId: string
  readonly claimId: string
  readonly ordinal: number
}

/** One `inference_step_relations` row. */
export type InferenceStepRelationRow = {
  readonly sourceInferenceStepId: string
  readonly targetInferenceStepId: string
  readonly relationType: InferenceStepRelationValue
  readonly description: string | null
}

/** One `claim_relations` row. 0 rows today; Q1 keeps the table first-class and forbids deriving it. */
export type ClaimRelationRow = {
  readonly id: string
  readonly sourceClaimId: string
  readonly targetClaimId: string
  readonly relationType: ClaimRelationValue
  readonly description: string | null
}

/**
 * One `relationships` row.
 *
 * `fromEntityType` / `toEntityType` are free text with no foreign keys, so the reader returns
 * them verbatim and the projection decides what to do with an unrecognised value. Hiding that
 * decision inside the SQL would make it untestable and would hide the Q5 warnings.
 */
export type RelationshipRow = {
  readonly id: string
  readonly fromEntityType: string
  readonly fromEntityId: string
  readonly relationshipType: RelationshipValue
  readonly toEntityType: string
  readonly toEntityId: string
  readonly description: string | null
  readonly status: RelationshipStatusValue
}

/** One `card_axes` row. */
export type CardAxisRow = {
  readonly cardId: string
  readonly axis: CardAxisValue
  readonly ordinal: number
}

/** One `card_collections` row joined to its `collections` row. */
export type CardCollectionRow = {
  readonly cardId: string
  readonly collectionId: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
}

/** One `card_mechanisms` row joined to its `mechanisms` row. */
export type CardMechanismRow = {
  readonly cardId: string
  readonly mechanismId: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
}

/**
 * One `card_concepts` row joined to its `concepts` row.
 *
 * `relationship` is free authored text on the join table, nullable, and no vocabulary constrains
 * it. It is returned verbatim: it is the only place the editorial reason for a Card -> Concept
 * association is recorded, so normalising or dropping it would destroy the only authored
 * justification. Contrast `card_mechanisms`, which has no such column.
 */
export type CardConceptRow = {
  readonly cardId: string
  readonly conceptId: string
  readonly slug: string
  readonly name: string
  /** `concepts.definition`. Mechanism and Collection store `description` instead. */
  readonly definition: string | null
  readonly relationship: string | null
}

/** One `card_locales` row joined to its `locales` row. */
export type CardLocaleRow = {
  readonly cardId: string
  readonly localeId: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
}

/** One `argument_chains` row. */
export type ArgumentChainRow = {
  readonly id: string
  readonly cardId: string
  readonly label: string
  readonly description: string
  readonly kind: ArgumentChainKindValue
  /** Free `text`, independent of claim status (Q4). */
  readonly epistemicStatus: string
}

/** One `argument_chain_steps` row joined to its chain. */
export type ArgumentChainMembershipRow = {
  readonly chainId: string
  readonly inferenceStepId: string
  readonly role: InferenceStepRoleValue
  readonly ordinal: number
  readonly label: string
  readonly description: string
  readonly kind: ArgumentChainKindValue
}

/**
 * One `sources` row.
 *
 * A bibliographic object. Reaching one is never a property of this table —
 * every source enters the projection through an authored join row
 * (`claim_sources` or `evidence_sources`), so a row here alone implies nothing
 * about graph membership.
 */
export type SourceRow = {
  readonly id: string
  readonly title: string
  readonly author: string | null
  readonly publisher: string | null
  readonly citation: string | null
  readonly url: string | null
  /** pgEnum `source_type`, returned verbatim like other untrusted discriminators. */
  readonly sourceType: string
}

/**
 * One `claim_sources` row: a claim's authored attribution to a source.
 *
 * `relationship` is free `text` NOT NULL with no enum behind it; the seed only
 * ever writes `ATTRIBUTED_TO` today, but the reader returns whatever is stored
 * and the projection decides how to label an unrecognised value (Q5).
 */
export type ClaimSourceRow = {
  readonly claimId: string
  readonly sourceId: string
  readonly relationship: string
  readonly quoteOrExcerpt: string | null
  readonly pageReference: string | null
  readonly notes: string | null
}

/**
 * One `evidence_items` row: a located, inspectable portion of a source.
 *
 * `evidenceStatus` is free text (default `PRIMARY`) describing this item only —
 * deliberately never merged with claim or step status (Q4).
 */
export type EvidenceItemRow = {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly content: string
  readonly locator: string | null
  readonly evidenceStatus: string
}

/** One `evidence_claims` row: the evidential relation asserted between an item and a claim. */
export type EvidenceClaimRow = {
  readonly evidenceId: string
  readonly claimId: string
  readonly relation: string
  readonly strength: string
  readonly notes: string | null
}

/** One `evidence_sources` row: where an evidence item was derived from. */
export type EvidenceSourceRow = {
  readonly evidenceId: string
  readonly sourceId: string
  readonly relation: string
}

/** One `evidence_inferences` row: an inference step citing an evidence item. */
export type EvidenceInferenceRow = {
  readonly evidenceId: string
  readonly inferenceId: string
  readonly relation: string
}

/** What a card round discovers. */
export type CardExpansion = {
  readonly claims: readonly ClaimRow[]
  readonly inferenceSteps: readonly InferenceStepRow[]
  /** Rows from `relationships` where the card appears on *either* side. */
  readonly cardRelationships: readonly RelationshipRow[]
  readonly cardCollections: readonly CardCollectionRow[]
  readonly cardMechanisms: readonly CardMechanismRow[]
  readonly cardConcepts: readonly CardConceptRow[]
  readonly cardLocales: readonly CardLocaleRow[]
  readonly argumentChains: readonly ArgumentChainRow[]
  /** Chain membership rows, joined, for the steps on these cards. */
  readonly chainMemberships: readonly ArgumentChainMembershipRow[]
}

/** What a claim round discovers. */
export type ClaimExpansion = {
  /** Direct semantic relations between these claims, either direction. 0 rows today (Q1). */
  readonly claimRelations: readonly ClaimRelationRow[]
  /** Steps touching these claims through a premise or a conclusion. */
  readonly inferenceSteps: readonly InferenceStepRow[]
  readonly premises: readonly InferencePremiseRow[]
  readonly conclusions: readonly InferenceConclusionRow[]
  /** `claim_sources` rows where these claims are attributed to a source. */
  readonly claimSources: readonly ClaimSourceRow[]
  /** `evidence_claims` rows where these claims are cited as evidence targets. */
  readonly evidenceClaims: readonly EvidenceClaimRow[]
}

/** A step naming its chain through `inference_steps.argument_chain_id`, the direct path. */
export type DeclaredChainLink = {
  readonly stepId: string
  readonly chainId: string
}

/** What an inference-step round discovers. */
export type InferenceStepExpansion = {
  readonly stepRelations: readonly InferenceStepRelationRow[]
  /** `inference_premises` rows where these steps take the premise: the claims they reason from. */
  readonly premises: readonly InferencePremiseRow[]
  /** `inference_conclusions` rows where these steps conclude: the claims they arrive at. */
  readonly conclusions: readonly InferenceConclusionRow[]
  /** `argument_chain_steps` join rows for these steps, the authored membership path. */
  readonly chainMemberships: readonly ArgumentChainMembershipRow[]
  /** Steps naming a chain directly, with no join row to carry `role` or `ordinal`. */
  readonly declaredChainLinks: readonly DeclaredChainLink[]
  /** `evidence_inferences` rows citing these steps. 0 rows today (evidence layer). */
  readonly evidenceInferences: readonly EvidenceInferenceRow[]
}

/** What an argument-chain round discovers. */
export type ArgumentChainExpansion = {
  /** `argument_chain_steps` join rows for these chains, carrying the steps they order. */
  readonly chainMemberships: readonly ArgumentChainMembershipRow[]
}

/** What a source round discovers: join rows that name these sources as an endpoint. */
export type SourceExpansion = {
  /** `claim_sources` rows where these sources are cited by a claim. */
  readonly claimSources: readonly ClaimSourceRow[]
  /** `evidence_sources` rows where these sources are derived from. 0 rows today. */
  readonly evidenceSources: readonly EvidenceSourceRow[]
}

/** What an evidence-item round discovers. 0 rows today: the `evidence_*` layer is unpopulated. */
export type EvidenceItemExpansion = {
  /** `evidence_claims` rows where these items cite a claim. */
  readonly evidenceClaims: readonly EvidenceClaimRow[]
  /** `evidence_sources` rows where these items were derived from a source. */
  readonly evidenceSources: readonly EvidenceSourceRow[]
  /** `evidence_inferences` rows where these items are cited by a step. */
  readonly evidenceInferences: readonly EvidenceInferenceRow[]
}

/** Every node reference the projection has discovered, ready to be hydrated with metadata. */
export type NodeRefSet = {
  readonly cardIds: readonly string[]
  readonly claimIds: readonly string[]
  readonly inferenceStepIds: readonly string[]
  readonly chainIds: readonly string[]
  readonly collectionIds: readonly string[]
  readonly mechanismIds: readonly string[]
  readonly conceptIds: readonly string[]
  readonly sourceIds: readonly string[]
  readonly evidenceIds: readonly string[]
}

/** Hydrated rows for a set of node references. Absent ids simply have no row. */
export type NodeHydration = {
  readonly cards: readonly CardRow[]
  readonly cardAxes: readonly CardAxisRow[]
  readonly cardCollections: readonly CardCollectionRow[]
  readonly cardMechanisms: readonly CardMechanismRow[]
  readonly cardConcepts: readonly CardConceptRow[]
  readonly cardLocales: readonly CardLocaleRow[]
  readonly claims: readonly ClaimRow[]
  readonly inferenceSteps: readonly InferenceStepRow[]
  readonly chains: readonly ArgumentChainRow[]
  readonly chainMemberships: readonly ArgumentChainMembershipRow[]
  readonly premises: readonly InferencePremiseRow[]
  readonly conclusions: readonly InferenceConclusionRow[]
  readonly sources: readonly SourceRow[]
  readonly evidenceItems: readonly EvidenceItemRow[]
}

/** Row counts backing `/api/graph/views`, so a view can report whether it has data. */
export type ViewPopulation = {
  readonly cards: number
  readonly claims: number
  readonly inferenceSteps: number
  readonly relationships: number
  readonly collections: number
  readonly mechanisms: number
  readonly concepts: number
  readonly cardConcepts: number
  readonly locales: number
  readonly cardLocales: number
  readonly sources: number
  readonly evidenceItems: number
  readonly cases: number
  readonly interpretations: number
  readonly questions: number
  readonly argumentChains: number
  readonly claimRelations: number
  /** `claim_sources` join rows — the source layer's live signal (6 rows seeded). */
  readonly claimSources: number
}

/**
 * The read port.
 *
 * Implementations must return only rows whose endpoints exist in `trope_graph`, and must not
 * filter by depth or by view — those are the projection's decisions.
 */
export interface TropeGraphReader {
  /**
   * Resolve a `focus` reference to a card.
   *
   * Q7: uuid is canonical identity, slug is a human-facing lookup alias. Both must resolve;
   * neither becomes the other's stored identity.
   *
   * @param ref A card slug or uuid.
   */
  findCardByRef(ref: string): Promise<CardRow | undefined>

  /**
   * Resolve a `focus` reference to a claim.
   *
   * Claims carry no slug — uuid is their only canonical identity — so a
   * non-uuid reference resolves to `undefined`.
   *
   * @param ref A claim uuid.
   */
  findClaimByRef(ref: string): Promise<ClaimRow | undefined>

  /**
   * Resolve a `focus` reference to an argument chain.
   *
   * Chains carry no slug either; like claims, they are addressed by uuid.
   *
   * @param ref An argument chain uuid.
   */
  findArgumentChainByRef(ref: string): Promise<ArgumentChainRow | undefined>

  /**
   * Resolve a `focus` reference to a source.
   *
   * Sources carry no slug; like claims they answer to their uuid alone, so a
   * non-uuid reference resolves to `undefined`.
   *
   * @param ref A source uuid.
   */
  findSourceByRef(ref: string): Promise<SourceRow | undefined>

  /**
   * Resolve a `focus` reference to an evidence item.
   *
   * Evidence items carry no slug; uuid is their only identity.
   *
   * @param ref An evidence item uuid.
   */
  findEvidenceItemByRef(ref: string): Promise<EvidenceItemRow | undefined>

  /**
   * Search cards by a free-text query.
   *
   * Read-only discovery: returns ranked matches across title, slug, summary, core
   * question and mechanism summary. This is a suggestion service — it never changes
   * what `focus` resolves and never widens a projection. The caller bounds results
   * with `limit`.
   *
   * @param query The user's search term.
   * @param limit Maximum number of results to return.
   */
  searchCards(query: string, limit: number): Promise<CardSearchResult[]>

  /** Expand a round of card ids. */
  expandCards(cardIds: readonly string[]): Promise<CardExpansion>

  /** Expand a round of claim ids. */
  expandClaims(claimIds: readonly string[]): Promise<ClaimExpansion>

  /**
   * Expand a round of inference-step ids.
   *
   * Returns the step-to-step relations, the premise and conclusion rows tying
   * these steps to their claims (a step frontier must be able to discover the
   * claims it reasons from and arrives at — otherwise a chain focus dead-ends
   * at its steps), both chain-membership paths, and any `evidence_inferences`
   * rows citing these steps.
   */
  expandInferenceSteps(
    inferenceStepIds: readonly string[],
  ): Promise<InferenceStepExpansion>

  /** Expand a round of argument-chain ids. */
  expandChains(chainIds: readonly string[]): Promise<ArgumentChainExpansion>

  /**
   * Expand a round of source ids.
   *
   * Discovers the claims attributed to these sources and the evidence items
   * derived from them — a source's adjacency is entirely its join rows.
   */
  expandSources(sourceIds: readonly string[]): Promise<SourceExpansion>

  /** Expand a round of evidence-item ids. */
  expandEvidenceItems(
    evidenceIds: readonly string[],
  ): Promise<EvidenceItemExpansion>

  /** Hydrate every discovered node reference with its typed metadata rows. */
  hydrate(refs: NodeRefSet): Promise<NodeHydration>

  /** Read the row counts behind `/api/graph/views`. */
  readPopulation(): Promise<ViewPopulation>

  /** List cards (read-only) for Explore/curation surfaces. */
  listCards(params?: {
    localeSlug?: string
    limit?: number
    offset?: number
  }): Promise<{
    items: readonly CardRow[]
    total: number
  }>

  /** List sources (read-only) with basic attribution signal if present. */
  listSources(params?: { limit?: number; offset?: number }): Promise<{
    items: readonly (SourceRow & { claimSourceCount: number })[]
    total: number
  }>
}
