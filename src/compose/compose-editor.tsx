/**
 * The Compose/Decompose editor.
 *
 * Presentational, but not dumb: every handler is wired to the pure model
 * (`compose-model.ts`), so the page stays orchestration-only. The three exports —
 * `PermissionGate`, `SaveBar`, `ComposeEditor` — are each a small finite-state surface, and
 * each is rendered directly by the Node test suite. Everything here is non-canonical by
 * construction: option lists come from the served vocabulary and the card's own claims, and
 * the only write the surface can perform is to the user's own draft.
 */

import type { ComponentChildren } from 'preact'
import type {
  ArgumentChainKindValue,
  InferencePremiseRoleValue,
  InferenceStepRoleValue,
  InferenceTypeValue,
} from '../../trope-cards/src/graph/types.ts'
import {
  addChain,
  addChainStep,
  addConclusion,
  addPremise,
  addStep,
  type ChainPatch,
  type ComposeAuthState,
  type ComposeIssue,
  removeChain,
  removeChainStep,
  removeConclusion,
  removePremise,
  removeStep,
  type StepPatch,
  setChainStepRole,
  setPremiseRole,
  updateChain,
  updateStep,
} from './compose-model'
import type { CanonicalClaim } from './compose-projector'
import type {
  DraftChain,
  DraftPayload,
  DraftStep,
  DraftVocabulary,
} from './draft-types'

/** Props for {@link PermissionGate}. */
export type PermissionGateProps = {
  readonly auth: ComposeAuthState
  /** Invoked when the signed-out user accepts the invitation. Optional: some hosts sign in elsewhere. */
  readonly onSignIn?: () => void
  readonly children: ComponentChildren
}

/**
 * The editor's auth boundary.
 *
 * `signed-in` renders the children (the editor); anything else renders the reason the
 * editor is not there. The signed-out line is an invitation, not an error — drafts are
 * participation data, so they belong to a signed-in user.
 *
 * @param props See {@link PermissionGateProps}.
 * @returns The gated surface.
 */
export function PermissionGate({
  auth,
  onSignIn,
  children,
}: PermissionGateProps) {
  if (auth === 'signed-in') return <>{children}</>
  if (auth === 'signing-in') {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="compose-auth-checking"
      >
        Checking your session…
      </p>
    )
  }
  return (
    <div
      data-testid="compose-auth-required"
      className="rounded-lg border border-graph-border/70 bg-graph-muted/30 p-4"
    >
      <p className="text-sm text-foreground">
        Sign in to author your own decomposition of this card.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Your draft is stored to your account on this site and never becomes part
        of the canonical ontology.
      </p>
      {onSignIn !== undefined ? (
        <button
          type="button"
          onClick={onSignIn}
          className="mt-3 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Sign in
        </button>
      ) : null}
    </div>
  )
}

/** Props for {@link SaveBar}. */
export type SaveBarProps = {
  readonly auth: ComposeAuthState
  readonly dirty: boolean
  readonly canSave: boolean
  readonly issueCount: number
  readonly hasDraft: boolean
  readonly savedAt: string | null
  readonly saving: boolean
  readonly savingError: string | null
  readonly onSave: () => void
  readonly onDiscard: () => void
  readonly onDelete: () => void
}

/** `HH:MM` clock time, locale-neutral for the Node tests. */
function formatTime(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

/**
 * The save gate's voice: status + Save / Discard / Delete.
 *
 * The gate is honest about why a Save is disabled: "unsaveable" is spelled out as the
 * defect count, because a silently-grey button is how a broken draft looks like it saved.
 * The saved state shows the time and says nothing about canonicality — a draft cannot be
 * canonical, so there is nothing to claim about it.
 *
 * @param props See {@link SaveBarProps}.
 * @returns The save controls for the current state.
 */
export function SaveBar({
  auth,
  dirty,
  canSave,
  issueCount,
  hasDraft,
  savedAt,
  saving,
  savingError,
  onSave,
  onDiscard,
  onDelete,
}: SaveBarProps) {
  if (auth !== 'signed-in') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-graph-border/70 bg-graph-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Sign in to save your own decomposition.
        </p>
      </div>
    )
  }

  const blocker =
    dirty && !canSave
      ? `${issueCount} issue${issueCount === 1 ? '' : 's'} block saving`
      : null

  return (
    <div
      data-testid="compose-save-bar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-graph-border/70 bg-graph-muted/30 px-4 py-3"
    >
      <div className="min-w-0">
        <p
          className="text-sm text-foreground"
          data-testid="compose-save-status"
        >
          {saving
            ? 'Saving…'
            : dirty
              ? 'Unsaved changes'
              : hasDraft && savedAt !== null
                ? `Saved at ${formatTime(savedAt)}`
                : 'No draft saved yet.'}
        </p>
        {savingError !== null ? (
          <p
            className="mt-0.5 text-sm text-red-600 dark:text-red-400"
            data-testid="compose-save-error"
          >
            {savingError}
          </p>
        ) : null}
        {blocker !== null ? (
          <p
            className="mt-0.5 text-xs text-muted-foreground"
            data-testid="compose-save-blocker"
          >
            {blocker}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!dirty || !canSave || saving}
          onClick={onSave}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={onDiscard}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Discard changes
        </button>
        <button
          type="button"
          disabled={!hasDraft || saving}
          onClick={onDelete}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete saved draft
        </button>
      </div>
    </div>
  )
}

/** Props for {@link ComposeEditor}. */
export type ComposeEditorProps = {
  readonly draft: DraftPayload
  readonly vocab: DraftVocabulary
  /** The card's own claims (the only claims a draft may reason over). */
  readonly pool: ReadonlyMap<string, CanonicalClaim>
  readonly issues: readonly ComposeIssue[]
  readonly onChange: (next: DraftPayload) => void
}

/** One options list from the served vocabulary. */
function VocabSelect({
  value,
  options,
  label,
  onSelect,
}: {
  value: string
  options: readonly string[]
  label: string
  onSelect: (value: string) => void
}) {
  return (
    <label className="block">
      {label !== '' ? (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      ) : null}
      <select
        value={value}
        onChange={(event) =>
          onSelect((event.target as HTMLSelectElement).value)
        }
        className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Pick one of the pool's claims. */
function ClaimSelect({
  claims,
  value,
  label,
  onSelect,
}: {
  claims: readonly CanonicalClaim[]
  value: string
  label: string
  onSelect: (claimId: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(event) => onSelect((event.target as HTMLSelectElement).value)}
      aria-label={label}
      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
    >
      {claims.map((claim) => (
        <option key={claim.id} value={claim.id}>
          {claim.statement}
        </option>
      ))}
    </select>
  )
}

/** The card frame every step and chain shares: title, badge, Remove. */
function CardFrame({
  title,
  badge,
  children,
  onRemove,
  removeLabel,
}: {
  title: string
  badge?: string
  children: ComponentChildren
  onRemove: () => void
  removeLabel: string
}) {
  return (
    <li className="rounded-lg border border-graph-border/60 bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge !== undefined ? (
            <span className="ml-2 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Remove
        </button>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </li>
  )
}

/** The claims of the pool a step does not use yet, for its "add" selects. */
function unusedPoolClaims(
  pool: ReadonlyMap<string, CanonicalClaim>,
  used: readonly string[],
): CanonicalClaim[] {
  const usedSet = new Set(used)
  return [...pool.values()].filter((claim) => !usedSet.has(claim.id))
}

/**
 * One step card.
 *
 * @param props The step plus pool/vocab and the model callbacks it mutates.
 * @returns A step card.
 */
function StepCard({
  step,
  pool,
  vocab,
  onPatch,
  onRemove,
  onAddPremise,
  onRemovePremise,
  onSetPremiseRole,
  onAddConclusion,
  onRemoveConclusion,
}: {
  step: DraftStep
  pool: ReadonlyMap<string, CanonicalClaim>
  vocab: DraftVocabulary
  onPatch: (patch: StepPatch) => void
  onRemove: () => void
  onAddPremise: (claimId: string, role: InferencePremiseRoleValue) => void
  onRemovePremise: (claimId: string) => void
  onSetPremiseRole: (claimId: string, role: InferencePremiseRoleValue) => void
  onAddConclusion: (claimId: string) => void
  onRemoveConclusion: (claimId: string) => void
}) {
  const statement = (claimId: string): string =>
    pool.get(claimId)?.statement ?? `Claim ${claimId.slice(0, 8)}…`

  const addable = unusedPoolClaims(pool, [
    ...step.premises.map((premise) => premise.claimId),
    ...step.conclusions.map((conclusion) => conclusion.claimId),
  ])

  return (
    <CardFrame
      title={step.label.trim() === '' ? 'Unlabelled step' : step.label}
      badge={step.inferenceType}
      onRemove={onRemove}
      removeLabel={`Remove step ${step.label || 'without a label'}`}
    >
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Label</span>
        <input
          type="text"
          value={step.label}
          onInput={(event) =>
            onPatch({ label: (event.target as HTMLInputElement).value })
          }
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          Description
        </span>
        <textarea
          value={step.description}
          onInput={(event) =>
            onPatch({
              description: (event.target as HTMLTextAreaElement).value,
            })
          }
          rows={2}
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <VocabSelect
          value={step.inferenceType}
          options={vocab.inferenceTypes}
          label="Inference type"
          onSelect={(value) =>
            onPatch({ inferenceType: value as InferenceTypeValue })
          }
        />
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">
            Epistemic status (free text)
          </span>
          <input
            type="text"
            value={step.epistemicStatus}
            onInput={(event) =>
              onPatch({
                epistemicStatus: (event.target as HTMLInputElement).value,
              })
            }
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Premises · {step.premises.length}
          </p>
          {step.premises.length === 0 ? (
            <p
              className="mt-1 text-sm text-muted-foreground"
              data-testid="no-premises"
            >
              No premises yet.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {step.premises.map((premise) => (
                <li key={premise.claimId} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {statement(premise.claimId)}
                  </span>
                  <span className="w-36 shrink-0">
                    <VocabSelect
                      value={premise.role}
                      options={vocab.premiseRoles}
                      label=""
                      onSelect={(value) =>
                        onSetPremiseRole(
                          premise.claimId,
                          value as InferencePremiseRoleValue,
                        )
                      }
                    />
                  </span>
                  <button
                    type="button"
                    aria-label="Remove premise"
                    onClick={() => onRemovePremise(premise.claimId)}
                    className="shrink-0 rounded border border-border px-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {addable.length > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <ClaimSelect
                claims={addable}
                value={addable[0].id}
                label="Add a premise claim"
                onSelect={(claimId) => onAddPremise(claimId, 'PRIMARY')}
              />
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conclusions · {step.conclusions.length}
          </p>
          {step.conclusions.length === 0 ? (
            <p
              className="mt-1 text-sm text-muted-foreground"
              data-testid="no-conclusions"
            >
              No conclusions yet.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {step.conclusions.map((conclusion) => (
                <li
                  key={conclusion.claimId}
                  className="flex items-center gap-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {statement(conclusion.claimId)}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove conclusion"
                    onClick={() => onRemoveConclusion(conclusion.claimId)}
                    className="shrink-0 rounded border border-border px-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {addable.length > 0 ? (
            <ClaimSelect
              claims={addable}
              value={addable[0].id}
              label="Add a conclusion claim"
              onSelect={onAddConclusion}
            />
          ) : null}
        </div>
      </div>
    </CardFrame>
  )
}

/**
 * One chain card.
 *
 * @param props The chain plus the draft steps it may attach, vocabulary, and model callbacks.
 * @returns A chain card.
 */
function ChainCard({
  chain,
  steps,
  vocab,
  onPatch,
  onRemove,
  onAttachStep,
  onRemoveStep,
  onSetRole,
}: {
  chain: DraftChain
  steps: readonly DraftStep[]
  vocab: DraftVocabulary
  onPatch: (patch: ChainPatch) => void
  onRemove: () => void
  onAttachStep: (stepKey: string, role: InferenceStepRoleValue) => void
  onRemoveStep: (stepKey: string) => void
  onSetRole: (stepKey: string, role: InferenceStepRoleValue) => void
}) {
  const stepLabel = (stepKey: string): string =>
    steps.find((step) => step.key === stepKey)?.label ?? `Step ${stepKey}`

  const attachable = steps.filter(
    (step) => !chain.steps.some((chainStep) => chainStep.stepKey === step.key),
  )

  return (
    <CardFrame
      title={chain.label.trim() === '' ? 'Unlabelled chain' : chain.label}
      badge={chain.kind}
      onRemove={onRemove}
      removeLabel={`Remove chain ${chain.label || 'without a label'}`}
    >
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Label</span>
        <input
          type="text"
          value={chain.label}
          onInput={(event) =>
            onPatch({ label: (event.target as HTMLInputElement).value })
          }
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          Description
        </span>
        <textarea
          value={chain.description}
          onInput={(event) =>
            onPatch({
              description: (event.target as HTMLTextAreaElement).value,
            })
          }
          rows={2}
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <VocabSelect
          value={chain.kind}
          options={vocab.chainKinds}
          label="Kind"
          onSelect={(value) =>
            onPatch({ kind: value as ArgumentChainKindValue })
          }
        />
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">
            Epistemic status (free text)
          </span>
          <input
            type="text"
            value={chain.epistemicStatus}
            onInput={(event) =>
              onPatch({
                epistemicStatus: (event.target as HTMLInputElement).value,
              })
            }
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Steps · {chain.steps.length}
        </p>
        {chain.steps.length === 0 ? (
          <p
            className="mt-1 text-sm text-muted-foreground"
            data-testid="no-chain-steps"
          >
            No steps attached yet.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {chain.steps.map((chainStep) => (
              <li key={chainStep.stepKey} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {stepLabel(chainStep.stepKey)}
                </span>
                <span className="w-32 shrink-0">
                  <VocabSelect
                    value={chainStep.role}
                    options={vocab.stepRoles}
                    label=""
                    onSelect={(value) =>
                      onSetRole(
                        chainStep.stepKey,
                        value as InferenceStepRoleValue,
                      )
                    }
                  />
                </span>
                <button
                  type="button"
                  aria-label="Remove step from chain"
                  onClick={() => onRemoveStep(chainStep.stepKey)}
                  className="shrink-0 rounded border border-border px-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {attachable.length > 0 ? (
          <div className="mt-2 flex items-center gap-2">
            <select
              value={attachable[0].key}
              onChange={(event) =>
                onAttachStep((event.target as HTMLSelectElement).value, 'MAIN')
              }
              aria-label="Attach a step to the chain"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {attachable.map((step) => (
                <option key={step.key} value={step.key}>
                  {step.label === '' ? `Step ${step.key}` : step.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              attach · defaults to MAIN
            </span>
          </div>
        ) : null}
      </div>
    </CardFrame>
  )
}

/** The default vocabulary members a brand-new step/chain falls back to before the fetch lands. */
const FALLBACK_INFERENCE_TYPE = 'UNSPECIFIED'
const FALLBACK_CHAIN_KIND = 'EDITORIAL_RECONSTRUCTION'

/**
 * The authoring surface.
 *
 * @param props See {@link ComposeEditorProps}.
 * @returns Steps then chains, then add buttons and the issue list that explains a blocked save.
 */
export function ComposeEditor({
  draft,
  vocab,
  pool,
  issues,
  onChange,
}: ComposeEditorProps) {
  const apply = (next: DraftPayload) => onChange(next)

  return (
    <div data-testid="compose-editor" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Your decomposition
          </h3>
          <p className="text-sm text-muted-foreground">
            A draft for you, on this card only. It can never become canonical.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            apply(
              addStep(draft, {
                label: '',
                description: '',
                inferenceType:
                  vocab.inferenceTypes[0] ?? FALLBACK_INFERENCE_TYPE,
                epistemicStatus: '',
                notes: null,
                premises: [],
                conclusions: [],
              }),
            )
          }
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Add step
        </button>
      </div>

      {draft.steps.length === 0 ? (
        <p
          className="rounded-lg border border-dashed border-graph-border/70 bg-graph-muted/30 p-4 text-sm text-muted-foreground"
          data-testid="no-steps"
        >
          Start by adding a reasoning step over the card's claims.
        </p>
      ) : (
        <ul className="space-y-3">
          {draft.steps.map((step) => (
            <StepCard
              key={step.key}
              step={step}
              pool={pool}
              vocab={vocab}
              onPatch={(patch) => apply(updateStep(draft, step.key, patch))}
              onRemove={() => apply(removeStep(draft, step.key))}
              onAddPremise={(claimId, role) =>
                apply(addPremise(draft, step.key, claimId, role))
              }
              onRemovePremise={(claimId) =>
                apply(removePremise(draft, step.key, claimId))
              }
              onSetPremiseRole={(claimId, role) =>
                apply(setPremiseRole(draft, step.key, claimId, role))
              }
              onAddConclusion={(claimId) =>
                apply(addConclusion(draft, step.key, claimId))
              }
              onRemoveConclusion={(claimId) =>
                apply(removeConclusion(draft, step.key, claimId))
              }
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Argument chains
          </h3>
          <p className="text-sm text-muted-foreground">
            Named paths through your own steps. A chain surfaces a MAIN and a
            COUNTER.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            apply(
              addChain(draft, {
                label: '',
                description: '',
                kind: vocab.chainKinds[0] ?? FALLBACK_CHAIN_KIND,
                epistemicStatus: '',
              }),
            )
          }
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Add chain
        </button>
      </div>

      {draft.chains.length === 0 ? (
        <p
          className="rounded-lg border border-dashed border-graph-border/70 bg-graph-muted/30 p-4 text-sm text-muted-foreground"
          data-testid="no-chains"
        >
          Chains are optional. A card needs at least one step to exist.
        </p>
      ) : (
        <ul className="space-y-3">
          {draft.chains.map((chain) => (
            <ChainCard
              key={chain.key}
              chain={chain}
              steps={draft.steps}
              vocab={vocab}
              onPatch={(patch) => apply(updateChain(draft, chain.key, patch))}
              onRemove={() => apply(removeChain(draft, chain.key))}
              onAttachStep={(stepKey, role) =>
                apply(addChainStep(draft, chain.key, stepKey, role))
              }
              onRemoveStep={(stepKey) =>
                apply(removeChainStep(draft, chain.key, stepKey))
              }
              onSetRole={(stepKey, role) =>
                apply(setChainStepRole(draft, chain.key, stepKey, role))
              }
            />
          ))}
        </ul>
      )}

      {issues.length > 0 ? (
        <div
          data-testid="compose-issues"
          className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-4"
        >
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            The draft is not saveable yet.
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-amber-800 dark:text-amber-200">
            {issues.map((issue) => (
              <li
                key={`${issue.subject}-${issue.key ?? 'draft'}-${issue.message}`}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
