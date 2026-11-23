/**
 * The authoring model for Compose/Decompose.
 *
 * Every function here is pure: `DraftPayload` in, new `DraftPayload` out. No hooks, no
 * fetch, no components. That is what lets the whole authoring contract — add/remove a step,
 * only-once claim references, dense ordinals, chains that reach only the draft's own steps,
 * and a save gate that mirrors the server — be tested under Node against a flat object.
 *
 * The model deliberately keeps the *drafting* invariants only, and nothing more:
 *
 * - A reasoning step reasons over at least one premise and at least one conclusion claim.
 * - A claim is referenced at most once per premise list (or conclusion list) of a step.
 * - Ordinals are a dense `0..n-1` sequence the model reassigns on every edit, so the edited
 *   state is always the shape the server will accept.
 * - A chain is built from the draft's own steps by key; it can never reach into the
 *   canonical corpus, which is what keeps the authoring surface non-canonical by
 *   construction.
 * - A chain needs at least one `MAIN` step and at least one actual step. A `COUNTER` step
 *   is advisory for drafts (M2), so a partial reconstruction can be saved honestly; no
 *   canonical validator is relaxed by that choice.
 *
 * Vocabulary values enter only through the callers (which feed them from
 * `GET /api/drafts/vocabularies`); the model never invents one.
 */

import type {
  ArgumentChainKindValue,
  InferencePremiseRoleValue,
  InferenceStepRoleValue,
  InferenceTypeValue,
} from '../../trope-cards/src/graph/types.ts'
import {
  canonicalRef,
  claimRefIdentity,
  type DraftChain,
  type DraftClaimRef,
  type DraftConclusion,
  type DraftPayload,
  type DraftPremise,
  type DraftStep,
  type DraftWorkingClaim,
  workingRef,
} from './draft-types'

/** A draft with nothing authored yet. Never saveable; the entry point for a blank card. */
export const EMPTY_DRAFT: DraftPayload = {
  steps: [],
  chains: [],
  workingClaims: [],
}

/** Field values the author may change on a step. */
export type StepPatch = {
  readonly label?: string
  readonly description?: string
  readonly inferenceType?: InferenceTypeValue
  readonly epistemicStatus?: string
  readonly notes?: string | null
}

/** Field values the author may change on a chain. */
export type ChainPatch = {
  readonly label?: string
  readonly description?: string
  readonly kind?: ArgumentChainKindValue
  readonly epistemicStatus?: string
}

/** Input for creating a step. Claims are the caller's selection from the card pool. */
export type StepInput = {
  readonly label: string
  readonly description: string
  readonly inferenceType: InferenceTypeValue
  readonly epistemicStatus: string
  readonly notes?: string | null
  readonly premises: readonly {
    readonly claimId: string
    readonly role: InferencePremiseRoleValue
  }[]
  readonly conclusions: readonly string[]
}

/** Input for creating a chain. Steps are attached afterwards. */
export type ChainInput = {
  readonly label: string
  readonly description: string
  readonly kind: ArgumentChainKindValue
  readonly epistemicStatus: string
}

/**
 * Input for creating a working claim.
 *
 * `epistemicStatus` is required: a working assertion is never silently established. The UI
 * seeds it with `WORKING`, which the author can change but must state explicitly.
 */
export type WorkingClaimInput = {
  readonly label: string
  readonly description?: string | null
  readonly epistemicStatus: string
  readonly source?: string | null
}

/** Keys are client-stable so chains and the save diff never renumber authorship. */
export type KeyFactory = () => string

/** Uniqueness-driven key generator for authoring, injectable and deterministic in tests. */
export function makeKeyFactory(prefix: string, fallback = 0): () => string {
  let counter = fallback
  return () => `${prefix}-${counter++}`
}

/**
 * Draw a key that is not already taken.
 *
 * @param makeKey A generator.
 * @param existing The keys already in use.
 * @returns The first generated key not present in `existing`.
 */
function uniqueKey(
  makeKey: () => string,
  existing: ReadonlySet<string>,
): string {
  let key = makeKey()
  while (existing.has(key)) key = makeKey()
  return key
}

/**
 * Clone a step with a replacement premise list, carrying the new ordinals.
 *
 * @param step The step to rewrite.
 * @param premises The new premise list.
 * @returns A new step object.
 */
function withPremises(
  step: DraftStep,
  premises: readonly DraftPremise[],
): DraftStep {
  return {
    ...step,
    premises: premises.map((premise, index) => ({
      ...premise,
      ordinal: index,
    })),
  }
}

/**
 * Clone a step with a replacement conclusion list, carrying the new ordinals.
 *
 * @param step The step to rewrite.
 * @param conclusions The new conclusion list.
 * @returns A new step object.
 */
function withConclusions(
  step: DraftStep,
  conclusions: readonly DraftConclusion[],
): DraftStep {
  return {
    ...step,
    conclusions: conclusions.map((conclusion, index) => ({
      ...conclusion,
      ordinal: index,
    })),
  }
}

/** The steps the draft holds today, for key uniqueness. */
function stepKeys(draft: DraftPayload): ReadonlySet<string> {
  return new Set(draft.steps.map((step) => step.key))
}

/** The chains the draft holds today, for key uniqueness. */
function chainKeys(draft: DraftPayload): ReadonlySet<string> {
  return new Set(draft.chains.map((chain) => chain.key))
}

/** The working local ids the draft holds today, for ref resolution and uniqueness. */
function workingIds(draft: DraftPayload): ReadonlySet<string> {
  return new Set(draft.workingClaims.map((claim) => claim.localId))
}

/**
 * A draft-local id that cannot be mistaken for a canonical claim uuid.
 *
 * @param value The proposed id.
 * @returns `true` when the value is non-empty and not uuid-shaped.
 */
export function isWorkingLocalId(value: string): boolean {
  return (
    value.trim().length > 0 &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

/**
 * The next free `wc-N` id, so removing a middle claim cannot make Add appear to do nothing.
 *
 * @param draft The current draft.
 * @returns A non-uuid id not already used in this draft.
 */
export function nextWorkingLocalId(draft: DraftPayload): string {
  const used = workingIds(draft)
  let index = 1
  while (used.has(`wc-${index}`)) index += 1
  return `wc-${index}`
}

/**
 * Add a working claim to the draft. The caller supplies a stable local id; duplicates are
 * ignored so an accidental double-click cannot produce two claims with the same id.
 *
 * @param draft The current draft.
 * @param localId The draft-local identifier, unique within this draft.
 * @param input The authored fields.
 * @returns The draft with the working claim appended.
 */
export function addWorkingClaim(
  draft: DraftPayload,
  localId: string,
  input: WorkingClaimInput,
): DraftPayload {
  if (!isWorkingLocalId(localId) || workingIds(draft).has(localId)) return draft
  const claim: DraftWorkingClaim = {
    localId,
    label: input.label,
    description: input.description ?? null,
    epistemicStatus: input.epistemicStatus,
    source: input.source ?? null,
  }
  return { ...draft, workingClaims: [...draft.workingClaims, claim] }
}

/**
 * Replace a working claim's authored fields, keeping its local id and refs intact.
 *
 * @param draft The current draft.
 * @param localId The working claim to edit.
 * @param input The replacement fields.
 * @returns The draft with the claim patched.
 */
export function updateWorkingClaim(
  draft: DraftPayload,
  localId: string,
  input: WorkingClaimInput,
): DraftPayload {
  return {
    ...draft,
    workingClaims: draft.workingClaims.map((claim) =>
      claim.localId === localId
        ? {
            ...claim,
            label: input.label,
            description: input.description ?? null,
            epistemicStatus: input.epistemicStatus,
            source: input.source ?? null,
          }
        : claim,
    ),
  }
}

/**
 * Remove a working claim and every reference to it from the draft's steps.
 *
 * Chains reference steps, not claims, so they need no cascade: a step that loses its last
 * premise is reported by {@link draftIssues} rather than silently deleted.
 *
 * @param draft The current draft.
 * @param localId The working claim to remove.
 * @returns The draft without the claim and its refs.
 */
export function removeWorkingClaim(
  draft: DraftPayload,
  localId: string,
): DraftPayload {
  return {
    ...draft,
    workingClaims: draft.workingClaims.filter(
      (claim) => claim.localId !== localId,
    ),
    steps: draft.steps.map((step) => ({
      ...step,
      premises: step.premises.filter((ref) => !isWorkingRefTo(ref, localId)),
      conclusions: step.conclusions.filter(
        (ref) => !isWorkingRefTo(ref, localId),
      ),
    })),
  }
}

/** `true` when a ref is a working ref to `localId`. */
function isWorkingRefTo(ref: DraftClaimRef, localId: string): boolean {
  return ref.kind === 'working' && ref.localId === localId
}

/**
 * Build a step object from input, with dense ordinals already applied.
 *
 * @param key The step's client-stable key.
 * @param input The authored fields plus the chosen claims.
 * @returns A draft-ready step.
 */
export function buildStep(key: string, input: StepInput): DraftStep {
  return {
    key,
    label: input.label,
    description: input.description,
    inferenceType: input.inferenceType,
    epistemicStatus: input.epistemicStatus,
    notes: input.notes ?? null,
    premises: input.premises.map((premise, index) => ({
      ...canonicalRef(premise.claimId),
      role: premise.role,
      ordinal: index,
    })),
    conclusions: input.conclusions.map((claimId, index) => ({
      ...canonicalRef(claimId),
      ordinal: index,
    })),
  }
}

/** Add a step to a draft and return the new draft. */
export function addStep(
  draft: DraftPayload,
  input: StepInput,
  makeKey: KeyFactory = makeKeyFactory('step'),
): DraftPayload {
  return {
    ...draft,
    steps: [
      ...draft.steps,
      buildStep(uniqueKey(makeKey, stepKeys(draft)), input),
    ],
  }
}

/** Replace a step's authored fields, keeping its claims intact. */
export function updateStep(
  draft: DraftPayload,
  key: string,
  patch: StepPatch,
): DraftPayload {
  return {
    ...draft,
    steps: draft.steps.map((step) =>
      step.key === key ? { ...step, ...patch } : step,
    ),
  }
}

/**
 * Remove a step, together with every chain that named it.
 *
 * A chain cannot reference a step that no longer exists — the server rejects that — so the
 * cascade removes the derived references, never wire them, and never leaves a dangling key
 * the next save would trip on.
 *
 * @param draft The current draft.
 * @param key The step to remove.
 * @returns The draft with the step and any referencing chains gone.
 */
export function removeStep(draft: DraftPayload, key: string): DraftPayload {
  return {
    workingClaims: draft.workingClaims,
    steps: draft.steps.filter((step) => step.key !== key),
    chains: draft.chains
      .filter((chain) => !chain.steps.some((step) => step.stepKey === key))
      .map(reindexChainSteps),
  }
}

/** Add a canonical premise claim to a step. An already-used ref is ignored (once-only). */
export function addPremise(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
  role: InferencePremiseRoleValue,
): DraftPayload {
  return addPremiseRef(draft, stepKey, canonicalRef(claimId), role)
}

/**
 * Add a working-claim premise to a step. Dangling or duplicate refs are ignored so the model
 * never creates a ref the server would reject.
 *
 * @param draft The current draft.
 * @param stepKey The step to change.
 * @param localId A working claim in this draft.
 * @param role The premise's epistemic role.
 * @returns The draft with the premise appended when valid.
 */
export function addWorkingPremise(
  draft: DraftPayload,
  stepKey: string,
  localId: string,
  role: InferencePremiseRoleValue,
): DraftPayload {
  if (!workingIds(draft).has(localId)) return draft
  return addPremiseRef(draft, stepKey, workingRef(localId), role)
}

/** Add a typed claim ref as a premise. */
function addPremiseRef(
  draft: DraftPayload,
  stepKey: string,
  ref: DraftClaimRef,
  role: InferencePremiseRoleValue,
): DraftPayload {
  const identity = claimRefIdentity(ref)
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      if (
        step.premises.some((premise) => claimRefIdentity(premise) === identity)
      )
        return step
      return withPremises(step, [
        ...step.premises,
        { ...ref, role, ordinal: 0 } as DraftPremise,
      ])
    }),
  }
}

/** Remove a canonical premise from a step, reindexing the survivors. */
export function removePremise(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
): DraftPayload {
  return removePremiseRef(draft, stepKey, canonicalRef(claimId))
}

/** Remove a working-claim premise from a step, reindexing the survivors. */
export function removeWorkingPremise(
  draft: DraftPayload,
  stepKey: string,
  localId: string,
): DraftPayload {
  return removePremiseRef(draft, stepKey, workingRef(localId))
}

/** Remove a typed claim ref from a step's premises. */
function removePremiseRef(
  draft: DraftPayload,
  stepKey: string,
  ref: DraftClaimRef,
): DraftPayload {
  const identity = claimRefIdentity(ref)
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      return withPremises(
        step,
        step.premises.filter(
          (premise) => claimRefIdentity(premise) !== identity,
        ),
      )
    }),
  }
}

/** Change the role of a canonical premise claim. */
export function setPremiseRole(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
  role: InferencePremiseRoleValue,
): DraftPayload {
  return setPremiseRefRole(draft, stepKey, canonicalRef(claimId), role)
}

/** Change the role of a working-claim premise. */
export function setWorkingPremiseRole(
  draft: DraftPayload,
  stepKey: string,
  localId: string,
  role: InferencePremiseRoleValue,
): DraftPayload {
  return setPremiseRefRole(draft, stepKey, workingRef(localId), role)
}

/** Change the role of a typed claim ref used as a premise. */
function setPremiseRefRole(
  draft: DraftPayload,
  stepKey: string,
  ref: DraftClaimRef,
  role: InferencePremiseRoleValue,
): DraftPayload {
  const identity = claimRefIdentity(ref)
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      return withPremises(
        step,
        step.premises.map((premise) =>
          claimRefIdentity(premise) === identity
            ? { ...premise, role }
            : premise,
        ),
      )
    }),
  }
}

/** Add a canonical conclusion to a step. An already-used ref is ignored (once-only). */
export function addConclusion(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
): DraftPayload {
  return addConclusionRef(draft, stepKey, canonicalRef(claimId))
}

/** Add a working-claim conclusion to a step, when that claim exists in this draft. */
export function addWorkingConclusion(
  draft: DraftPayload,
  stepKey: string,
  localId: string,
): DraftPayload {
  if (!workingIds(draft).has(localId)) return draft
  return addConclusionRef(draft, stepKey, workingRef(localId))
}

/** Add a typed claim ref as a conclusion. */
function addConclusionRef(
  draft: DraftPayload,
  stepKey: string,
  ref: DraftClaimRef,
): DraftPayload {
  const identity = claimRefIdentity(ref)
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      if (
        step.conclusions.some(
          (conclusion) => claimRefIdentity(conclusion) === identity,
        )
      )
        return step
      return withConclusions(step, [
        ...step.conclusions,
        { ...ref, ordinal: 0 } as DraftConclusion,
      ])
    }),
  }
}

/** Remove a canonical conclusion from a step, reindexing the survivors. */
export function removeConclusion(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
): DraftPayload {
  return removeConclusionRef(draft, stepKey, canonicalRef(claimId))
}

/** Remove a working-claim conclusion from a step, reindexing the survivors. */
export function removeWorkingConclusion(
  draft: DraftPayload,
  stepKey: string,
  localId: string,
): DraftPayload {
  return removeConclusionRef(draft, stepKey, workingRef(localId))
}

/** Remove a typed claim ref from a step's conclusions. */
function removeConclusionRef(
  draft: DraftPayload,
  stepKey: string,
  ref: DraftClaimRef,
): DraftPayload {
  const identity = claimRefIdentity(ref)
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      return withConclusions(
        step,
        step.conclusions.filter(
          (conclusion) => claimRefIdentity(conclusion) !== identity,
        ),
      )
    }),
  }
}

/** Build a chain object with no steps attached yet. */
export function buildChain(key: string, input: ChainInput): DraftChain {
  return {
    key,
    label: input.label,
    description: input.description,
    kind: input.kind,
    epistemicStatus: input.epistemicStatus,
    steps: [],
  }
}

/** Add a new (empty) chain to a draft. */
export function addChain(
  draft: DraftPayload,
  input: ChainInput,
  makeKey: KeyFactory = makeKeyFactory('chain'),
): DraftPayload {
  return {
    ...draft,
    chains: [
      ...draft.chains,
      buildChain(uniqueKey(makeKey, chainKeys(draft)), input),
    ],
  }
}

/** Replace a chain's authored fields, keeping its step list intact. */
export function updateChain(
  draft: DraftPayload,
  key: string,
  patch: ChainPatch,
): DraftPayload {
  return {
    ...draft,
    chains: draft.chains.map((chain) =>
      chain.key === key ? { ...chain, ...patch } : chain,
    ),
  }
}

/** Remove a chain entirely. */
export function removeChain(draft: DraftPayload, key: string): DraftPayload {
  return { ...draft, chains: draft.chains.filter((chain) => chain.key !== key) }
}

/** Reassign dense ordinals across a chain's step list. */
function reindexChainSteps(chain: DraftChain): DraftChain {
  return {
    ...chain,
    steps: chain.steps.map((step, index) => ({ ...step, ordinal: index })),
  }
}

/** Attach a draft step to a chain, once per step, with a role. */
export function addChainStep(
  draft: DraftPayload,
  chainKey: string,
  stepKey: string,
  role: InferenceStepRoleValue,
): DraftPayload {
  const ownKeys = stepKeys(draft)
  if (!ownKeys.has(stepKey)) return draft
  return {
    ...draft,
    chains: draft.chains.map((chain) => {
      if (chain.key !== chainKey) return chain
      if (chain.steps.some((step) => step.stepKey === stepKey)) return chain
      return reindexChainSteps({
        ...chain,
        steps: [...chain.steps, { stepKey, role, ordinal: 0 }],
      })
    }),
  }
}

/** Change the role a chain gives a step. */
export function setChainStepRole(
  draft: DraftPayload,
  chainKey: string,
  stepKey: string,
  role: InferenceStepRoleValue,
): DraftPayload {
  return {
    ...draft,
    chains: draft.chains.map((chain) => {
      if (chain.key !== chainKey) return chain
      return reindexChainSteps({
        ...chain,
        steps: chain.steps.map((step) =>
          step.stepKey === stepKey ? { ...step, role } : step,
        ),
      })
    }),
  }
}

/** Detach a step from a chain, reindexing the survivors. */
export function removeChainStep(
  draft: DraftPayload,
  chainKey: string,
  stepKey: string,
): DraftPayload {
  return {
    ...draft,
    chains: draft.chains.map((chain) => {
      if (chain.key !== chainKey) return chain
      return reindexChainSteps({
        ...chain,
        steps: chain.steps.filter((step) => step.stepKey !== stepKey),
      })
    }),
  }
}

/** An equivalence check over the draft shape, order-sensitive but field-by-field. */
function equalsShape(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((value, index) => equalsShape(value, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) => equalsShape(a[key], b[key]))
  }
  return false
}

/** `true` when `value` is a plain object (not null, not an array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Whether two drafts are the same authored work.
 *
 * The save bar uses this for its dirty check. Compared structurally, not by reference, so
 * a freshly-loaded draft equals a freshly-edited one that has not actually changed.
 *
 * @param a One draft.
 * @param b Another draft.
 * @returns `true` when the two drafts are identical.
 */
export function draftsEqual(a: DraftPayload, b: DraftPayload): boolean {
  return equalsShape(a, b)
}

/** Instance of the "signed-out" blocker so the editor never renders without a user. */
export type ComposeAuthState = 'signing-in' | 'signed-out' | 'signed-in'

/** One defect the save gate or the author should hear about. */
export type ComposeIssue = {
  /** Where the defect lives: the draft as a whole, one step, or one chain. */
  readonly subject: 'draft' | 'step' | 'chain'
  /** The step or chain key the defect is about, when scoped. */
  readonly key: string | null
  readonly message: string
}

/**
 * The save gate: every defect that would make the server reject this draft.
 *
 * Mirrors `draft-contract.ts` client-side so the author is told *before* hitting save —
 * but the server remains the authority, and this list is guidance, never a parallel schema
 * a hostile request can hide behind.
 *
 * @param draft The draft under authoring.
 * @returns The defects, stable-ordered: draft-level, then steps, then chains.
 */
export function draftIssues(draft: DraftPayload): readonly ComposeIssue[] {
  const issues: ComposeIssue[] = []

  if (draft.steps.length === 0 && draft.workingClaims.length === 0) {
    issues.push({
      subject: 'draft',
      key: null,
      message:
        'Begin with a working assertion or a reasoning step before you can save.',
    })
  }

  const stepKeys = new Set(draft.steps.map((step) => step.key))
  const knownWorkingIds = new Set(
    draft.workingClaims.map((claim) => claim.localId),
  )

  for (const claim of draft.workingClaims) {
    if (!isWorkingLocalId(claim.localId)) {
      issues.push({
        subject: 'draft',
        key: claim.localId,
        message: 'A working claim needs a unique, non-uuid local id.',
      })
    }
    if (
      !knownWorkingIds.has(claim.localId) ||
      draft.workingClaims.filter((c) => c.localId === claim.localId).length > 1
    ) {
      issues.push({
        subject: 'draft',
        key: claim.localId,
        message: 'Working claim local ids must be unique in this draft.',
      })
    }
    if (claim.label.trim().length === 0) {
      issues.push({
        subject: 'draft',
        key: claim.localId,
        message: 'Give the working assertion a label.',
      })
    }
    if (claim.epistemicStatus.trim().length === 0) {
      issues.push({
        subject: 'draft',
        key: claim.localId,
        message: 'State the working claim’s epistemic status.',
      })
    }
  }

  for (const step of draft.steps) {
    if (step.label.trim().length === 0) {
      issues.push({
        subject: 'step',
        key: step.key,
        message: 'Give the step a label.',
      })
    }
    if (step.epistemicStatus.trim().length === 0) {
      issues.push({
        subject: 'step',
        key: step.key,
        message: 'State the step\u2019s epistemic status.',
      })
    }
    if (step.premises.length === 0) {
      issues.push({
        subject: 'step',
        key: step.key,
        message: 'The step needs at least one premise claim.',
      })
    }
    const premiseClaims = step.premises.map(claimRefIdentity)
    if (new Set(premiseClaims).size !== premiseClaims.length) {
      issues.push({
        subject: 'step',
        key: step.key,
        message: 'A step cannot reuse a premise claim twice.',
      })
    }
    if (step.conclusions.length === 0) {
      issues.push({
        subject: 'step',
        key: step.key,
        message: 'The step needs at least one conclusion claim.',
      })
    }
    const conclusionClaims = step.conclusions.map(claimRefIdentity)
    if (new Set(conclusionClaims).size !== conclusionClaims.length) {
      issues.push({
        subject: 'step',
        key: step.key,
        message: 'A step cannot reuse a conclusion claim twice.',
      })
    }
    for (const ref of [...step.premises, ...step.conclusions]) {
      if (ref.kind === 'working' && !knownWorkingIds.has(ref.localId)) {
        issues.push({
          subject: 'step',
          key: step.key,
          message: 'A working claim reference does not resolve in this draft.',
        })
      }
    }
  }

  for (const chain of draft.chains) {
    if (chain.label.trim().length === 0) {
      issues.push({
        subject: 'chain',
        key: chain.key,
        message: 'Give the chain a label.',
      })
    }
    if (chain.steps.length === 0) {
      issues.push({
        subject: 'chain',
        key: chain.key,
        message: 'Attach at least one step to the chain.',
      })
    }
    for (const chainStep of chain.steps) {
      if (!stepKeys.has(chainStep.stepKey)) {
        issues.push({
          subject: 'chain',
          key: chain.key,
          message: 'The chain references a step the draft no longer has.',
        })
      }
    }
    const referenced = chain.steps.map((step) => step.stepKey)
    if (new Set(referenced).size !== referenced.length) {
      issues.push({
        subject: 'chain',
        key: chain.key,
        message: 'A chain cannot reuse a step twice.',
      })
    }
    if (!chain.steps.some((step) => step.role === 'MAIN')) {
      issues.push({
        subject: 'chain',
        key: chain.key,
        message: 'The chain needs a MAIN step.',
      })
    }
    // A COUNTER/CHALLENGE step is advisory for drafts (M2): the researcher may save a
    // partial reconstruction. The canonical seed validators are unchanged.
  }

  return issues
}

/**
 * Whether the draft passes the save gate.
 *
 * The vocabulary is not consulted for the gate itself (structure, not vocabulary, decides
 * saveability — the vocabulary only feeds the editor's options), so this can live on the
 * draft alone.
 *
 * @param draft The draft under authoring.
 * @returns `true` when no defect is outstanding.
 */
export function canSaveDraft(draft: DraftPayload): boolean {
  return draftIssues(draft).length === 0
}
