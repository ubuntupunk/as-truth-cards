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
 * - A chain surfaces a `MAIN` and a `COUNTER` step before it becomes saveable, mirroring
 *   `validate-argument-chains.mjs` — but the editor lets the author build toward that, and
 *   `draftIssues` reports it as a defect, not a crash.
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
import type {
  DraftChain,
  DraftConclusion,
  DraftPayload,
  DraftPremise,
  DraftStep,
} from './draft-types'

/** A draft with nothing authored yet. Never saveable; the entry point for a blank card. */
export const EMPTY_DRAFT: DraftPayload = { steps: [], chains: [] }

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
      claimId: premise.claimId,
      role: premise.role,
      ordinal: index,
    })),
    conclusions: input.conclusions.map((claimId, index) => ({
      claimId,
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
    steps: draft.steps.filter((step) => step.key !== key),
    chains: draft.chains
      .filter((chain) => !chain.steps.some((step) => step.stepKey === key))
      .map(reindexChainSteps),
  }
}

/** Add a premise claim to a step. A claim already premised is ignored (once-only). */
export function addPremise(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
  role: InferencePremiseRoleValue,
): DraftPayload {
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      if (step.premises.some((premise) => premise.claimId === claimId))
        return step
      return withPremises(step, [
        ...step.premises,
        { claimId, role, ordinal: 0 },
      ])
    }),
  }
}

/** Remove a premise claim from a step, reindexing the survivors. */
export function removePremise(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
): DraftPayload {
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      return withPremises(
        step,
        step.premises.filter((premise) => premise.claimId !== claimId),
      )
    }),
  }
}

/** Change the role of a premise claim. */
export function setPremiseRole(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
  role: InferencePremiseRoleValue,
): DraftPayload {
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      return withPremises(
        step,
        step.premises.map((premise) =>
          premise.claimId === claimId ? { ...premise, role } : premise,
        ),
      )
    }),
  }
}

/** Add a conclusion claim to a step. A claim already concluded is ignored (once-only). */
export function addConclusion(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
): DraftPayload {
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      if (step.conclusions.some((conclusion) => conclusion.claimId === claimId))
        return step
      return withConclusions(step, [
        ...step.conclusions,
        { claimId, ordinal: 0 },
      ])
    }),
  }
}

/** Remove a conclusion claim from a step, reindexing the survivors. */
export function removeConclusion(
  draft: DraftPayload,
  stepKey: string,
  claimId: string,
): DraftPayload {
  return {
    ...draft,
    steps: draft.steps.map((step) => {
      if (step.key !== stepKey) return step
      return withConclusions(
        step,
        step.conclusions.filter((conclusion) => conclusion.claimId !== claimId),
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

  if (draft.steps.length === 0) {
    issues.push({
      subject: 'draft',
      key: null,
      message: 'Create at least one reasoning step before you can save.',
    })
  }

  const stepKeys = new Set(draft.steps.map((step) => step.key))

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
    const premiseClaims = step.premises.map((premise) => premise.claimId)
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
    const conclusionClaims = step.conclusions.map(
      (conclusion) => conclusion.claimId,
    )
    if (new Set(conclusionClaims).size !== conclusionClaims.length) {
      issues.push({
        subject: 'step',
        key: step.key,
        message: 'A step cannot reuse a conclusion claim twice.',
      })
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
    if (!chain.steps.some((step) => step.role === 'COUNTER')) {
      issues.push({
        subject: 'chain',
        key: chain.key,
        message: 'The chain needs a COUNTER step.',
      })
    }
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
