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
 * Two kinds of claim reference exist, and they are deliberately tagged:
 *
 * - `canonical` points at a real `trope_graph` claim uuid. The route checks that it exists
 *   and belongs to the card; it is the only kind that ever reaches the graph.
 * - `working` points at a `localId` in this draft's own `workingClaims` array. It resolves
 *   only inside this draft, can never be a uuid, and never reaches the graph or any canonical
 *   surface. This is how a researcher starts on a card with no recorded canonical claims.
 *
 * Older drafts stored plain `{ claimId, role, ordinal }` references. Those are normalised
 * to tagged canonical refs on read, so no migration is needed and saved work stays valid.
 *
 * The structural rules deliberately mirror the canonical seed validators
 * (`trope-cards/scripts/validate-claim-decomposition.mjs`,
 * `validate-argument-chains.mjs`): a reasoning step needs at least one premise and one
 * conclusion; an argument chain surfaces at least one `MAIN` step and at least one actual
 * step. CHALLENGE/COUNTER steps are *advisory* for drafts (M2): a partial reconstruction that
 * shows only the main line is honest work and may be saved. No canonical validator is
 * relaxed by that choice — this contract governs participation data only.
 *
 * Referential integrity against the corpus (that every canonical claimId exists and belongs
 * to the card) is *not* Zod's job: it needs the graph reader and lives in the route. Keeping
 * the two apart means the structural contract is a pure, database-free unit under test.
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
  workingClaims: 50,
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

/** `true` when a string is a uuid — working local ids must never look canonical. */
const isUuid = (value: string): boolean => claimRef.safeParse(value).success

/** A draft-local identifier: stable, non-uuid, unique within the owning draft. */
const localId = z
  .string()
  .trim()
  .min(1)
  .max(DRAFT_LIMITS.key)
  .refine((value) => !isUuid(value), {
    message: 'a working local id cannot be a canonical claim uuid',
  })

/**
 * One working claim, authored by the researcher and stored only in this draft's JSON.
 *
 * `epistemicStatus` is required: a working assertion is explicitly *not* assumed established,
 * and the author must name its standing. `source` is optional and is not evidence — it is a
 * pointer for the researcher, never a canonical source relation.
 */
const workingClaimSchema = z.object({
  localId,
  label,
  description: z.string().trim().max(DRAFT_LIMITS.description).nullish(),
  epistemicStatus,
  source: z.string().trim().max(DRAFT_LIMITS.label).nullish(),
})

/** A reference to a canonical claim on the card; the only ref kind the graph sees. */
const canonicalRefFields = {
  kind: z.literal('canonical'),
  claimId: claimRef,
} as const

/** A reference to a claim owned by this draft; resolved only against `workingClaims`. */
const workingRefFields = {
  kind: z.literal('working'),
  localId,
} as const

/**
 * Normalise a legacy plain `{ claimId, role, ordinal }` ref into a tagged canonical ref.
 *
 * Tagged refs pass through untouched. Untagged refs with a string `claimId` are treated as
 * canonical; the uuid check below still applies, so a malformed legacy ref is rejected rather
 * than silently repaired. This is a read-time normalisation, not a data migration.
 *
 * @param value The stored ref value.
 * @returns The ref with a `kind` tag when it was missing.
 */
function tagLegacyRef(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  if ('kind' in value) return value
  const { claimId } = value as { claimId?: unknown }
  return typeof claimId === 'string' ? { ...value, kind: 'canonical' } : value
}

const premiseSchema = z.preprocess(
  tagLegacyRef,
  z.discriminatedUnion('kind', [
    z.object({ ...canonicalRefFields, role: z.enum(inferencePremiseRoleEnum.enumValues), ordinal: z.number().int().min(0) }),
    z.object({ ...workingRefFields, role: z.enum(inferencePremiseRoleEnum.enumValues), ordinal: z.number().int().min(0) }),
  ]),
)

const conclusionSchema = z.preprocess(
  tagLegacyRef,
  z.discriminatedUnion('kind', [
    z.object({ ...canonicalRefFields, ordinal: z.number().int().min(0) }),
    z.object({ ...workingRefFields, ordinal: z.number().int().min(0) }),
  ]),
)

/** A reference used by a step, either canonical or working. */
export type DraftClaimRef = z.infer<typeof premiseSchema> | z.infer<typeof conclusionSchema>

/**
 * Identity of a ref for duplicate checks.
 *
 * The kind is part of the identity so a canonical uuid and a (hypothetically identical)
 * working local id can never be conflated.
 *
 * @param ref A premise or conclusion ref.
 * @returns A stable identity string.
 */
function refIdentity(ref: DraftClaimRef): string {
  return ref.kind === 'canonical' ? `canonical:${ref.claimId}` : `working:${ref.localId}`
}

/** No duplicate claim in one step's premises (the schema's unique index, restated). */
const hasDistinctRefs = (rows: readonly DraftClaimRef[]): boolean =>
  new Set(rows.map(refIdentity)).size === rows.length

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
  .refine((step) => hasDistinctRefs(step.premises), {
    message: 'a step cannot reuse the same claim twice in its premises',
    path: ['premises'],
  })
  .refine((step) => hasDistinctRefs(step.conclusions), {
    message: 'a step cannot reuse the same claim twice in its conclusions',
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
  .refine(
    (chain) => new Set(chain.steps.map((step) => step.stepKey)).size === chain.steps.length,
    {
      message: 'a chain cannot reference the same step twice',
      path: ['steps'],
    },
  )
  .refine((chain) => isContiguous(chain.steps.map((s) => s.ordinal)), {
    message: 'chain step ordinals must be a dense 0..n-1 sequence',
    path: ['steps'],
  })
  // A chain that shows no side of an argument is not a reconstruction of it. MAIN is
  // required; COUNTER/CHALLENGE is advisory for drafts (M2) and deliberately not required.
  .refine((chain) => chain.steps.some((s) => s.role === 'MAIN'), {
    message: 'a chain must surface at least one MAIN step',
    path: ['steps'],
  })

/**
 * The full draft payload.
 *
 * Step keys are unique within a draft (they are what chains reference), every chain step
 * must resolve to one of the draft's own steps, working local ids are unique, and every
 * working ref resolves to a working claim in *this* draft. An entirely empty payload cannot
 * be saved: M3 requires at least one working claim or one reasoning step.
 */
export const draftPayloadSchema = z
  .object({
    steps: z.array(stepSchema).max(DRAFT_LIMITS.steps),
    chains: z.array(chainSchema).max(DRAFT_LIMITS.chains),
    workingClaims: z.array(workingClaimSchema).max(DRAFT_LIMITS.workingClaims).default([]),
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
  .refine(
    (draft) =>
      new Set(draft.workingClaims.map((claim) => claim.localId)).size ===
      draft.workingClaims.length,
    { message: 'working local ids must be unique within a draft', path: ['workingClaims'] },
  )
  .refine(
    (draft) => {
      const known = new Set(draft.workingClaims.map((claim) => claim.localId))
      return draft.steps.every((step) =>
        [...step.premises, ...step.conclusions].every(
          (ref) => ref.kind !== 'working' || known.has(ref.localId),
        ),
      )
    },
    {
      message: 'a working ref must resolve to a working claim in the same draft',
      path: ['workingClaims'],
    },
  )
  .refine(
    (draft) => draft.steps.length > 0 || draft.workingClaims.length > 0,
    {
      message: 'a draft needs at least one working claim or one reasoning step',
      path: ['steps'],
    },
  )

/** A validated draft payload. */
export type DraftPayload = z.infer<typeof draftPayloadSchema>
/** One reasoning step in a draft. */
export type DraftStep = z.infer<typeof stepSchema>
/** One argument chain in a draft. */
export type DraftChain = z.infer<typeof chainSchema>
/** One researcher-authored claim, owned by this draft. */
export type DraftWorkingClaim = z.infer<typeof workingClaimSchema>

/**
 * Every *canonical* claim id a payload references, premises and conclusions together.
 *
 * Working refs are deliberately excluded: they are draft-local, resolve only within
 * `workingClaims`, and must never reach the graph, canonical counts, or a read panel.
 * The route uses this list to check canonical referential integrity in one pass.
 *
 * @param payload A structurally valid draft payload.
 * @returns The distinct canonical claim uuids the draft reasons over.
 */
export function referencedClaimIds(payload: DraftPayload): string[] {
  const ids = new Set<string>()
  for (const step of payload.steps) {
    for (const premise of step.premises) {
      if (premise.kind === 'canonical') ids.add(premise.claimId)
    }
    for (const conclusion of step.conclusions) {
      if (conclusion.kind === 'canonical') ids.add(conclusion.claimId)
    }
  }
  return [...ids]
}
