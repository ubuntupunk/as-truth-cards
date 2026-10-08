/**
 * The Compose/Decompose draft contract.
 *
 * A draft is user-authored analytical work — a claim decomposition and optional
 * argument chains — held in `public.decomposition_drafts`, never in the canonical
 * `trope_graph` schema. This module is the *only* place the draft shape is defined, and it
 * validates against the canonical vocabularies imported straight from the Drizzle `pgEnum`
 * declarations rather than restated as string literals. A draft therefore cannot carry an
 * `inference_type`, `inference_premise_role`, `argument_chain_kind`, or
 * `inference_step_role` value the ontology does not have, and adding an enum member cannot
 * silently leave drafts unvalidatable.
 *
 * The structural rules deliberately mirror the canonical seed validators
 * (`trope-cards/scripts/validate-claim-decomposition.mjs`,
 * `validate-argument-chains.mjs`): a reasoning step needs at least one premise and one
 * conclusion; an argument chain surfaces at least one `MAIN` and one `COUNTER` step. A
 * draft that could not be a valid decomposition is rejected here, at the boundary, before
 * it is ever stored — so it cannot become a deferred ontology problem.
 *
 * Referential integrity (that every `claimId` exists and belongs to the card) is *not*
 * Zod's job: it needs the graph reader and lives in the route. Keeping the two apart means
 * the structural contract is a pure, database-free unit under test.
 */

import { z } from 'zod'
import {
  argumentChainKindEnum,
  inferenceStepRoleEnum,
} from '../../trope-cards/src/db/schema/argumentChains.js'
import {
  inferencePremiseRoleEnum,
  inferenceTypeEnum,
} from '../../trope-cards/src/db/schema/claimDecomposition.js'

/** Hard caps. A draft is authored by hand; these bound storage and review effort. */
export const DRAFT_LIMITS = {
  steps: 50,
  chains: 20,
  premisesPerStep: 12,
  conclusionsPerStep: 12,
  chainSteps: 20,
  label: 200,
  description: 2000,
  epistemicStatus: 80,
  key: 64,
} as const

/**
 * The decomposition vocabularies, re-exported as plain arrays for
 * `GET /api/graph/vocabularies`.
 *
 * The client is served the vocabulary rather than hardcoding it, so a vocabulary change is
 * a server deploy and never a second, drifting ontology in the UI.
 */
export const DECOMPOSITION_VOCABULARIES = {
  inferenceTypes: inferenceTypeEnum.enumValues,
  premiseRoles: inferencePremiseRoleEnum.enumValues,
  chainKinds: argumentChainKindEnum.enumValues,
  stepRoles: inferenceStepRoleEnum.enumValues,
} as const

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const key = z.string().min(1).max(DRAFT_LIMITS.key)

const label = z.string().trim().min(1).max(DRAFT_LIMITS.label)
const description = z.string().trim().min(1).max(DRAFT_LIMITS.description)
const epistemicStatus = z
  .string()
  .trim()
  .min(1)
  .max(DRAFT_LIMITS.epistemicStatus)

const claimRef = z.string().uuid()

const premiseSchema = z.object({
  claimId: claimRef,
  role: z.enum(inferencePremiseRoleEnum.enumValues),
  ordinal: z.number().int().min(0),
})

const conclusionSchema = z.object({
  claimId: claimRef,
  ordinal: z.number().int().min(0),
})

/** No duplicate claim in one step's premises (the schema's unique index, restated). */
const hasDistinctClaims = (
  rows: readonly { claimId: string }[],
): boolean => new Set(rows.map((row) => row.claimId)).size === rows.length

/** Ordinals are a dense 0..n-1 sequence, matching the seeded decomposition convention. */
const isContiguous = (ordinals: readonly number[]): boolean =>
  [...ordinals].sort((a, b) => a - b).every((value, index) => value === index)

const stepSchema = z
  .object({
    key,
    label,
    description,
    inferenceType: z.enum(inferenceTypeEnum.enumValues),
    epistemicStatus,
    notes: z.string().trim().max(DRAFT_LIMITS.description).nullish(),
    premises: z
      .array(premiseSchema)
      .min(1)
      .max(DRAFT_LIMITS.premisesPerStep),
    conclusions: z
      .array(conclusionSchema)
      .min(1)
      .max(DRAFT_LIMITS.conclusionsPerStep),
  })
  .refine((step) => hasDistinctClaims(step.premises), {
    message: 'a step cannot reuse the same premise claim twice',
    path: ['premises'],
  })
  .refine((step) => hasDistinctClaims(step.conclusions), {
    message: 'a step cannot reuse the same conclusion claim twice',
    path: ['conclusions'],
  })
  .refine((step) => isContiguous(step.premises.map((p) => p.ordinal)), {
    message: 'premise ordinals must be a dense 0..n-1 sequence',
    path: ['premises'],
  })
  .refine((step) => isContiguous(step.conclusions.map((c) => c.ordinal)), {
    message: 'conclusion ordinals must be a dense 0..n-1 sequence',
    path: ['conclusions'],
  })

const chainStepSchema = z.object({
  stepKey: key,
  role: z.enum(inferenceStepRoleEnum.enumValues),
  ordinal: z.number().int().min(0),
})

const chainSchema = z
  .object({
    key,
    label,
    description,
    kind: z.enum(argumentChainKindEnum.enumValues),
    epistemicStatus,
    steps: z.array(chainStepSchema).min(1).max(DRAFT_LIMITS.chainSteps),
  })
  .refine((chain) => hasDistinctClaims(chain.steps.map((s) => ({ claimId: s.stepKey }))), {
    message: 'a chain cannot reference the same step twice',
    path: ['steps'],
  })
  .refine((chain) => isContiguous(chain.steps.map((s) => s.ordinal)), {
    message: 'chain step ordinals must be a dense 0..n-1 sequence',
    path: ['steps'],
  })
  // Parity with `validate-argument-chains.mjs`: a chain that shows only one side of an
  // argument is not a reconstruction of it.
  .refine((chain) => chain.steps.some((s) => s.role === 'MAIN'), {
    message: 'a chain must surface at least one MAIN step',
    path: ['steps'],
  })
  .refine((chain) => chain.steps.some((s) => s.role === 'COUNTER'), {
    message: 'a chain must surface at least one COUNTER step',
    path: ['steps'],
  })

/**
 * The full draft payload.
 *
 * Step keys are unique within a draft (they are what chains reference), and every chain
 * step must resolve to one of the draft's own steps — a chain cannot name a step that was
 * never authored.
 */
export const draftPayloadSchema = z
  .object({
    steps: z.array(stepSchema).min(1).max(DRAFT_LIMITS.steps),
    chains: z.array(chainSchema).max(DRAFT_LIMITS.chains),
  })
  .refine(
    (draft) => new Set(draft.steps.map((step) => step.key)).size === draft.steps.length,
    { message: 'step keys must be unique within a draft', path: ['steps'] },
  )
  .refine(
    (draft) =>
      new Set(draft.chains.map((chain) => chain.key)).size === draft.chains.length,
    { message: 'chain keys must be unique within a draft', path: ['chains'] },
  )
  .refine(
    (draft) => {
      const stepKeys = new Set(draft.steps.map((step) => step.key))
      return draft.chains.every((chain) =>
        chain.steps.every((step) => stepKeys.has(step.stepKey)),
      )
    },
    {
      message: 'a chain step must reference a step in the same draft',
      path: ['chains'],
    },
  )

/** A validated draft payload. */
export type DraftPayload = z.infer<typeof draftPayloadSchema>
/** One reasoning step in a draft. */
export type DraftStep = z.infer<typeof stepSchema>
/** One argument chain in a draft. */
export type DraftChain = z.infer<typeof chainSchema>

/**
 * Every `claimId` a payload references, premises and conclusions together.
 *
 * The route uses this to check referential integrity against the graph in one pass rather
 * than walking the structure twice.
 *
 * @param payload A structurally valid draft payload.
 * @returns The distinct claim uuids the draft reasons over.
 */
export function referencedClaimIds(payload: DraftPayload): string[] {
  const ids = new Set<string>()
  for (const step of payload.steps) {
    for (const premise of step.premises) ids.add(premise.claimId)
    for (const conclusion of step.conclusions) ids.add(conclusion.claimId)
  }
  return [...ids]
}
