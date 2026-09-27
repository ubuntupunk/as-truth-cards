import type { InferInsertModel } from 'drizzle-orm'

import type {
  argumentChainKindEnum,
  argumentChainSteps,
  argumentChains,
  inferenceStepRelations,
  inferenceStepRelationTypeEnum,
} from '../schema/argumentChains'
import type {
  inferencePremiseRoleEnum,
  inferencePremises,
  inferenceSteps,
  inferenceTypeEnum,
} from '../schema/claimDecomposition'
import type {
  cardType,
  claimType,
  epistemicStatus,
  relationshipStatus,
  relationshipType,
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

/** A card, with its collection and mechanism memberships as slugs. */
export type CardSeed = {
  slug: string
  title: string
  primaryType: CardType
  status: EpistemicStatus
  collection: string[]
  axis: string[]
  mechanisms?: string[]
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
