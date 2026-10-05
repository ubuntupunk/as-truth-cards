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
}

/** What an inference-step round discovers. */
export type InferenceStepExpansion = {
  readonly stepRelations: readonly InferenceStepRelationRow[]
}

/** Every node reference the projection has discovered, ready to be hydrated with metadata. */
export type NodeRefSet = {
  readonly cardIds: readonly string[]
  readonly claimIds: readonly string[]
  readonly inferenceStepIds: readonly string[]
  readonly collectionIds: readonly string[]
  readonly mechanismIds: readonly string[]
  readonly conceptIds: readonly string[]
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

  /** Expand a round of card ids. */
  expandCards(cardIds: readonly string[]): Promise<CardExpansion>

  /** Expand a round of claim ids. */
  expandClaims(claimIds: readonly string[]): Promise<ClaimExpansion>

  /** Expand a round of inference-step ids. */
  expandInferenceSteps(
    inferenceStepIds: readonly string[],
  ): Promise<InferenceStepExpansion>

  /** Hydrate every discovered node reference with its typed metadata rows. */
  hydrate(refs: NodeRefSet): Promise<NodeHydration>

  /** Read the row counts behind `/api/graph/views`. */
  readPopulation(): Promise<ViewPopulation>
}
