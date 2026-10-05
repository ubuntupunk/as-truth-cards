import type { InferInsertModel } from 'drizzle-orm'

import type {
  argumentChainKindEnum,
  argumentChainSteps,
  argumentChains,
  inferenceStepRelations,
  inferenceStepRelationTypeEnum,
} from '../schema/argumentChains'
import type {
  claimRelationTypeEnum,
  inferencePremiseRoleEnum,
  inferencePremises,
  inferenceSteps,
  inferenceTypeEnum,
} from '../schema/claimDecomposition'
import type {
  cardAxis,
  cardType,
  claimSources,
  claimType,
  epistemicStatus,
  relationshipStatus,
  relationshipType,
  sources,
  sourceType,
} from '../schema/tropeGraph'

/**
 * Seed-layer types, derived from the Drizzle schema rather than restated.
 *
 * Every controlled vocabulary below is inferred from the same `pgEnum` declaration that
 * the migration creates, so a value added to or removed from an enum is a compile error in
 * the seed files instead of a runtime failure halfway through a transaction. Hand-written
 * string unions duplicated the enums and had already drifted once during the v0.1-v0.9
 * consolidation; deriving them removes that failure mode.
 *
 * Note that chain and step `epistemicStatus` are plain `string`, not the
 * `epistemic_status` enum. That is deliberate: reasoning-step status is independent of
 * card, claim, and evidence status. See "epistemic separation" in
 * docs/CLAIM_DECOMPOSITION_ENGINE.md.
 */

/** Member type of a `pgEnum`, e.g. `"TACTIC" | "FACT"`. */
type Member<T extends { readonly enumValues: readonly string[] }> =
  T['enumValues'][number]

export type CardType = Member<typeof cardType>
export type CardAxis = Member<typeof cardAxis>
export type EpistemicStatus = Member<typeof epistemicStatus>
export type ClaimType = Member<typeof claimType>
export type RelationshipType = Member<typeof relationshipType>
export type RelationshipStatus = Member<typeof relationshipStatus>
export type InferenceType = Member<typeof inferenceTypeEnum>
export type PremiseRole = Member<typeof inferencePremiseRoleEnum>
export type ArgumentChainKind = Member<typeof argumentChainKindEnum>
export type InferenceStepRelationType = Member<
  typeof inferenceStepRelationTypeEnum
>
export type ClaimRelationType = Member<typeof claimRelationTypeEnum>
export type SourceType = Member<typeof sourceType>

/**
 * One inference step, referenced by the slug of the card it belongs to.
 *
 * `cardId` is replaced by `cardSlug` because the seed layer is authored against stable
 * editorial slugs; the runner resolves slugs to generated UUIDs.
 */
export type InferenceStepSeed = Omit<
  InferInsertModel<typeof inferenceSteps>,
  'cardId'
> & { cardSlug: string }

/** Claims consumed by an inference step, in argument order. */
export type PremiseBindingSeed = {
  inferenceLabel: string
  premises: Array<
    Omit<
      InferInsertModel<typeof inferencePremises>,
      'inferenceStepId' | 'claimId'
    > & {
      claimSlug: string
    }
  >
}

/** Claims concluded by an inference step, in argument order. */
export type ConclusionBindingSeed = {
  inferenceLabel: string
  conclusions: Array<{ claimSlug: string; ordinal: number }>
}

/** One argument chain, with its ordered steps and the steps' shared card slug. */
export type ArgumentChainSeed = Omit<
  InferInsertModel<typeof argumentChains>,
  'cardId'
> & {
  cardSlug: string
  steps: Array<
    Pick<InferInsertModel<typeof argumentChainSteps>, 'role' | 'ordinal'> & {
      inferenceLabel: string
    }
  >
}

/**
 * A typed relation between two inference steps, referenced by step label.
 *
 * `cardSlug` is the card the relation is documented under. The seed runner asserts that
 * both referenced steps actually belong to that card, so a mislabelled relation fails the
 * seed rather than quietly linking steps from different cards.
 */
export type StepRelationSeed = Omit<
  InferInsertModel<typeof inferenceStepRelations>,
  'sourceInferenceStepId' | 'targetInferenceStepId'
> & {
  source: string
  target: string
  cardSlug: string
}

/**
 * A card, with its collection, axis, and mechanism memberships as slugs.
 *
 * `axis` is required and non-empty by construction of its type. It was `string[]` and
 * ignored by the seeder until migration 0008, which is how 47 cards lost their
 * rhetorical classification on every seed run. Typing it against the `card_axis` enum
 * means an out-of-vocabulary value is now a compile error rather than a value that
 * vanishes at insert time.
 *
 * Order is meaningful: the first entry is the card's primary axis and is persisted as
 * `card_axes.ordinal = 0`.
 */
export type CardSeed = {
  slug: string
  title: string
  /**
   * LEGACY content-shape classification. Not rhetorical function, and not a projection of
   * `axis`; the two vocabularies overlap only by accident. Nothing reads this column yet.
   * Do not derive a primary axis from it.
   */
  primaryType: CardType
  status: EpistemicStatus
  /** Browse suits. See `collections` in schema/tropeGraph.ts. */
  collection: string[]
  /** Rhetorical axes, primary first. At least one is required. */
  axis: [CardAxis, ...CardAxis[]]
  mechanisms?: string[]
  locales?: string[]
  summary?: string
  editorialNotes?: string
  /** Added by the v0.6 addendum; see drizzle/0006_card_core_question.sql. */
  coreQuestion?: string
}

/**
 * A claim, referenced by the slug of the card it belongs to.
 *
 * `status` is required rather than defaulted. A claim's epistemic status is an editorial
 * decision about how well the claim is supported, and silently defaulting it would record
 * a judgement nobody made.
 */
export type ClaimSeed = {
  cardSlug: string
  statement: string
  claimType: ClaimType
  status: EpistemicStatus
  /** Stable label used by premise and conclusion bindings. */
  slug?: string
  evidenceRequirement?: string
  description?: string
}

/**
 * A bibliographic source, referenced by a stable seed-local label.
 *
 * `sources` is a bibliographic object: a thing that exists, with the metadata needed to
 * find it again. It is deliberately NOT an excerpt. Recording what a source *contains*
 * belongs to `evidence_items`, which requires a located passage — see the seed
 * `sourceLayer.ts` for why this increment stops at the bibliographic layer.
 *
 * The `label` is a seed-local identifier only; `sources` has no slug column, so the runner
 * resolves labels to ids in memory, the same way claim labels work.
 */
export type SourceSeed = Omit<
  InferInsertModel<typeof sources>,
  'id' | 'createdAt' | 'updatedAt'
> & {
  /** Stable seed-local label, resolved to a source id by the runner. */
  label: string
}

/**
 * A claim's attribution to a source.
 *
 * `relationship` is asserted by the editor and is deliberately not the `sourceType` or any
 * `evidence_claims.relation`: it records *why this claim names this document*, not what the
 * document says about the claim. `quoteOrExcerpt` is nullable because attaching a document
 * the claim names does not require asserting a quotation from it — and asserting one without
 * a verified locator is exactly the fabrication this seed refuses.
 */
export type ClaimSourceSeed = Omit<
  InferInsertModel<typeof claimSources>,
  'claimId' | 'sourceId'
> & {
  claimSlug: string
  /** Resolved to a source id via `SourceSeed.label`. */
  sourceLabel: string
}

/** A typed graph edge between two cards. */
export type CardRelationshipSeed = {
  fromCardSlug: string
  relationshipType: RelationshipType
  toCardSlug: string
  description?: string
  /**
   * The edge's own lifecycle status, from the `relationship_status` enum
   * (CANONICAL / PROPOSED / REJECTED / SUPERSEDED). This is deliberately not
   * `epistemicStatus`: whether an edge is a canonical editorial position is separate from
   * how well-supported the claims on either side are.
   */
  status?: RelationshipStatus
}

/** The v0.7 claim-decomposition payload: steps plus their premise/conclusion bindings. */
export type ClaimDecompositionPayload = {
  inferenceSteps: InferenceStepSeed[]
  premiseBindings: PremiseBindingSeed[]
  conclusionBindings: ConclusionBindingSeed[]
}

/**
 * The v0.8 argument-chain payload.
 *
 * v0.8 repeats the v0.7 inference steps because the chain is expressed over the same
 * steps. Both files list them, so the runner merges by (card, label) and the seed runner
 * reports any step whose two definitions disagree.
 */
export type ArgumentChainPayload = {
  inferenceSteps: InferenceStepSeed[]
  chains: ArgumentChainSeed[]
  stepRelations: StepRelationSeed[]
}
