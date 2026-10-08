/**
 * Projection-derived readouts for the Compose screen.
 *
 * Pure functions over a `GET /api/graph` projection. They answer three questions the editor
 * needs answered from the *canonical* corpus and only from it:
 *
 * - which claims belong to the featured card (they are the draft's premise/conclusion pool);
 * - how the canonical decomposition reasons over them (read-only, for the composer to study
 *   before or while authoring);
 * - which argument chains the canonical corpus already holds, so a draft chain is never
 *   mistaken for a canonical one.
 *
 * Scoping matters exactly as it does for the Deck: at depth 3 a projection also carries the
 * cards a claim relation or a step points at, and those neighbours' claims must not leak into
 * this card's pool or reading. Every selector filters `metadata.cardId` to the featured card.
 */

import type {
  ArgumentChainKindValue,
  EpistemicStatusValue,
  GraphProjection,
  InferencePremiseRoleValue,
  InferenceTypeValue,
} from '../../trope-cards/src/graph/types.ts'

/** One canonical claim, as the compose screen needs it. */
export type CanonicalClaim = {
  readonly id: string
  readonly statement: string
  readonly claimType: string
  readonly epistemicStatus: EpistemicStatusValue
  readonly description: string | null
}

/** One canonical reasoning step, with its claim references resolved for rendering. */
export type CanonicalStep = {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly inferenceType: InferenceTypeValue
  readonly epistemicStatus: string
  readonly isCanonical: boolean
  readonly premises: readonly {
    readonly id: string
    readonly role: InferencePremiseRoleValue
  }[]
  readonly conclusions: readonly { readonly id: string }[]
}

/** One canonical argument chain, with its steps resolved for rendering. */
export type CanonicalChain = {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly kind: ArgumentChainKindValue
  readonly epistemicStatus: string
  readonly stepIds: readonly string[]
}

/**
 * Everything the compose screen reads off the featured card's projection.
 *
 * The three lists stay separate because the ontology keeps them separate: claims are the
 * material, steps are reasoning over them, chains are named paths through the steps. A chain
 * is only ever built from the draft's own steps — a draft can never point at a canonical
 * step, which is what keeps the authoring surface non-canonical by construction.
 */
export type ComposeProjection = {
  readonly cardId: string
  readonly claims: readonly CanonicalClaim[]
  readonly steps: readonly CanonicalStep[]
  readonly chains: readonly CanonicalChain[]
}

/**
 * Select the featured card's own claims, steps and chains from its projection.
 *
 * @param projection The card-focused projection (`GET /api/graph?focus=…&view=argument&depth=3`).
 * @param cardId The featured card's uuid.
 * @returns The scoped readout, in projection order.
 */
export function selectComposeProjection(
  projection: GraphProjection,
  cardId: string,
): ComposeProjection {
  const claims: CanonicalClaim[] = []
  const steps: CanonicalStep[] = []
  const chains: CanonicalChain[] = []

  // Two passes: collect claims first, so a step can resolve its premise/conclusion references
  // no matter which order the projection emitted them in. A single pass would silently drop
  // references whenever a step appeared before the claims it reasons over.
  for (const node of projection.nodes) {
    if (node.type === 'claim' && node.metadata.cardId === cardId) {
      claims.push({
        id: node.id,
        statement: node.label,
        claimType: node.metadata.claimType,
        epistemicStatus: node.status.value,
        description: node.metadata.description,
      })
    }
  }

  const resolution = new Map(claims.map((claim) => [claim.id, claim]))

  for (const node of projection.nodes) {
    if (node.type === 'inference_step' && node.metadata.cardId === cardId) {
      const step = node as Extract<
        GraphProjection['nodes'][number],
        { type: 'inference_step' }
      >
      steps.push({
        id: step.id,
        label: step.label,
        description: step.metadata.description,
        inferenceType: step.metadata.inferenceType,
        epistemicStatus: step.status.value,
        isCanonical: step.metadata.isCanonical,
        premises: step.metadata.premises
          .filter((premise) => resolution.has(premise.claimId))
          .map((premise) => ({ id: premise.claimId, role: premise.role })),
        conclusions: step.metadata.conclusions
          .filter((conclusion) => resolution.has(conclusion.claimId))
          .map((conclusion) => ({ id: conclusion.claimId })),
      })
    } else if (
      node.type === 'argument_chain' &&
      node.metadata.cardId === cardId
    ) {
      const chain = node as Extract<
        GraphProjection['nodes'][number],
        { type: 'argument_chain' }
      >
      chains.push({
        id: chain.id,
        label: chain.metadata.label,
        description: chain.metadata.description,
        kind: chain.metadata.kind,
        epistemicStatus: chain.status.value,
        stepIds: [...chain.metadata.stepIds],
      })
    }
  }

  return { cardId, claims, steps, chains }
}

/**
 * The claim pool an author may reason over: the featured card's own claims.
 *
 * @param projection The card-focused projection.
 * @param cardId The featured card's uuid.
 * @returns One entry per own claim, keyed by claim id.
 */
export function claimPool(
  projection: GraphProjection,
  cardId: string,
): ReadonlyMap<string, CanonicalClaim> {
  const pool = new Map<string, CanonicalClaim>()
  for (const claim of selectComposeProjection(projection, cardId).claims) {
    pool.set(claim.id, claim)
  }
  return pool
}
