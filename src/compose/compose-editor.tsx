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

import type { ComponentChildren, Ref } from 'preact'
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
  addWorkingClaim,
  addWorkingConclusion,
  addWorkingPremise,
  type ChainPatch,
  type ComposeAuthState,
  type ComposeIssue,
  nextWorkingLocalId,
  removeChain,
  removeChainStep,
  removeConclusion,
  removePremise,
  removeStep,
  removeWorkingClaim,
  removeWorkingConclusion,
  removeWorkingPremise,
  type StepPatch,
  setChainStepRole,
  setPremiseRole,
  setWorkingPremiseRole,
  updateChain,
  updateStep,
  updateWorkingClaim,
  type WorkingClaimInput,
} from './compose-model'
import type { CanonicalClaim } from './compose-projector'
import {
  claimRefIdentity,
  type DraftChain,
  type DraftClaimRef,
  type DraftPayload,
  type DraftStep,
  type DraftVocabulary,
  type DraftWorkingClaim,
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
  /** Whether the host wants the bar pinned below the site header. Signed-out bars stay flat. */
  readonly sticky?: boolean
  /** Lets the host restore focus to Save after the native `disabled` saving state blurs it. */
  readonly saveRef?: Ref<HTMLButtonElement>
  readonly onSave: () => void
  readonly onDiscard: () => void
  readonly onDelete: () => void
  /** Focuses the authoritative issue list; presentation only, never touches the draft. */
  readonly onReviewIssues: () => void
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
 * The bar is the *summary*, not the full issue list: it says how many issues block a save
 * and offers a review action that focuses the one authoritative banner in the editor.
 * Blockers are guidance (`aria-disabled`, still focusable); a real server failure is an
 * assertive alert carrying the server's exact message. A sticky opt-in pins the opaque
 * bar below the site header, so status and actions survive a long draft's scroll.
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
  sticky = false,
  saveRef,
  onSave,
  onDiscard,
  onDelete,
  onReviewIssues,
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

  const issuesLabel = `${issueCount} issue${issueCount === 1 ? '' : 's'}`
  const blocked = !saving && dirty && !canSave && issueCount > 0
  const savedInvalid = !saving && !dirty && hasDraft && issueCount > 0
  const showReview = blocked || savedInvalid
  const status = saving
    ? 'Saving…'
    : dirty
      ? 'Unsaved changes'
      : hasDraft && savedAt !== null
        ? `Saved at ${formatTime(savedAt)}`
        : 'No draft saved yet.'
  const detail =
    saving || savingError !== null
      ? null
      : blocked
        ? `${issuesLabel} to fix before saving`
        : savedInvalid
          ? `This saved draft has ${issuesLabel} to fix before it can be saved again.`
          : dirty && canSave
            ? 'Ready to save.'
            : null
  const saveInert = saving || !dirty || !canSave
  const describedBy =
    savingError !== null
      ? 'compose-save-error'
      : showReview
        ? 'compose-save-blocker'
        : undefined
  const barClass = [
    'flex flex-wrap items-center justify-between gap-1 rounded-lg border border-graph-border/70 bg-background px-3 py-1.5 shadow-sm sm:gap-3 sm:px-4 sm:py-3',
    sticky ? 'compose-sticky-bar' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div data-testid="compose-save-bar" className={barClass}>
      <div
        className="min-w-0"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p
          className="text-xs leading-tight text-foreground sm:text-sm sm:leading-normal"
          data-testid="compose-save-status"
        >
          {status}
        </p>
        {detail !== null ? (
          <p
            id={showReview ? 'compose-save-blocker' : undefined}
            className="text-[11px] leading-tight text-amber-700 dark:text-amber-300 sm:mt-0.5 sm:text-xs sm:leading-normal"
            data-testid="compose-save-blocker"
          >
            {detail}
          </p>
        ) : null}
      </div>
      {savingError !== null ? (
        <p
          id="compose-save-error"
          role="alert"
          className="w-full text-xs leading-tight text-red-600 dark:text-red-400 sm:mt-0.5 sm:text-sm sm:leading-normal"
          data-testid="compose-save-error"
        >
          {savingError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {showReview ? (
          <button
            type="button"
            data-testid="compose-save-review"
            onClick={onReviewIssues}
            className="rounded-md border border-amber-600/40 bg-amber-500/10 px-2 py-[3px] text-xs font-medium text-amber-800 hover:bg-amber-500/20 dark:text-amber-200 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            Review {issuesLabel}
          </button>
        ) : null}
        <button
          ref={saveRef}
          type="button"
          aria-disabled={saveInert}
          aria-describedby={describedBy}
          disabled={saving ? true : undefined}
          onClick={() => {
            if (saveInert) return
            onSave()
          }}
          className={`rounded-md border border-border bg-background px-2 py-[3px] text-xs font-medium text-foreground sm:px-3 sm:py-1.5 sm:text-sm ${
            saveInert ? 'cursor-not-allowed opacity-40' : 'hover:bg-muted'
          }`}
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={onDiscard}
          className="rounded-md border border-border bg-background px-2 py-[3px] text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          Discard changes
        </button>
        <button
          type="button"
          disabled={!hasDraft || saving}
          onClick={onDelete}
          className="rounded-md border border-border bg-background px-2 py-[3px] text-xs font-medium text-red-600 dark:text-red-400 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-1.5 sm:text-sm"
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
  /** Whether the author has edits that are not yet saved. Gates the issue banner. */
  readonly dirty?: boolean
  /** Whether a saved draft exists; keeps a saved-but-now-invalid issue list discoverable. */
  readonly hasDraft?: boolean
  /** Optional focus target for the sticky bar's `Review issues` action. */
  readonly issuesRef?: Ref<HTMLDivElement>
  readonly onChange: (next: DraftPayload) => void
}

/** One options list from the served vocabulary. */
function VocabSelect({
  value,
  options,
  label,
  ariaLabel,
  onSelect,
}: {
  value: string
  options: readonly string[]
  label: string
  /** Accessible name for selects whose visual label is deliberately omitted. */
  ariaLabel?: string
  onSelect: (value: string) => void
}) {
  const accessibleName = ariaLabel ?? label
  return (
    <label className="block">
      {label !== '' ? (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      ) : null}
      <select
        value={value}
        aria-label={accessibleName !== '' ? accessibleName : undefined}
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

/** Pick one of this draft's working claims. */
function WorkingClaimSelect({
  claims,
  label,
  onSelect,
}: {
  claims: readonly DraftWorkingClaim[]
  label: string
  onSelect: (localId: string) => void
}) {
  return (
    <select
      value={claims[0].localId}
      onChange={(event) => onSelect((event.target as HTMLSelectElement).value)}
      aria-label={label}
      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
    >
      {claims.map((claim) => (
        <option key={claim.localId} value={claim.localId}>
          {claim.label}
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
  stepKey,
}: {
  title: string
  badge?: string
  children: ComponentChildren
  onRemove: () => void
  removeLabel: string
  stepKey?: string
}) {
  return (
    <li
      data-step-key={stepKey}
      className="rounded-lg border border-graph-border/60 bg-background p-4"
    >
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

/** A human label for either kind of claim ref; working claims are named from this draft. */
function refLabel(
  ref: DraftClaimRef,
  pool: ReadonlyMap<string, CanonicalClaim>,
  workingClaims: readonly DraftWorkingClaim[],
): string {
  if (ref.kind === 'canonical') {
    return (
      pool.get(ref.claimId)?.statement ?? `Claim ${ref.claimId.slice(0, 8)}…`
    )
  }
  return (
    workingClaims.find((claim) => claim.localId === ref.localId)?.label ??
    `Working ${ref.localId}`
  )
}

/**
 * One step card.
 *
 * @param props The step plus pool/vocab/working claims and the model callbacks it mutates.
 * @returns A step card.
 */
function StepCard({
  step,
  pool,
  workingClaims,
  vocab,
  onPatch,
  onRemove,
  onAddPremise,
  onRemovePremise,
  onSetPremiseRole,
  onAddWorkingPremise,
  onRemoveWorkingPremise,
  onSetWorkingPremiseRole,
  onAddConclusion,
  onRemoveConclusion,
  onAddWorkingConclusion,
  onRemoveWorkingConclusion,
}: {
  step: DraftStep
  pool: ReadonlyMap<string, CanonicalClaim>
  workingClaims: readonly DraftWorkingClaim[]
  vocab: DraftVocabulary
  onPatch: (patch: StepPatch) => void
  onRemove: () => void
  onAddPremise: (claimId: string, role: InferencePremiseRoleValue) => void
  onRemovePremise: (claimId: string) => void
  onSetPremiseRole: (claimId: string, role: InferencePremiseRoleValue) => void
  onAddWorkingPremise: (
    localId: string,
    role: InferencePremiseRoleValue,
  ) => void
  onRemoveWorkingPremise: (localId: string) => void
  onSetWorkingPremiseRole: (
    localId: string,
    role: InferencePremiseRoleValue,
  ) => void
  onAddConclusion: (claimId: string) => void
  onRemoveConclusion: (claimId: string) => void
  onAddWorkingConclusion: (localId: string) => void
  onRemoveWorkingConclusion: (localId: string) => void
}) {
  const label = (ref: DraftClaimRef): string =>
    refLabel(ref, pool, workingClaims)

  const used = new Set([
    ...step.premises.map(claimRefIdentity),
    ...step.conclusions.map(claimRefIdentity),
  ])
  const addable = [...pool.values()].filter(
    (claim) => !used.has(`canonical:${claim.id}`),
  )
  const addableWorking = workingClaims.filter(
    (claim) => !used.has(`working:${claim.localId}`),
  )

  return (
    <CardFrame
      title={step.label.trim() === '' ? 'Unlabelled step' : step.label}
      badge={step.inferenceType}
      onRemove={onRemove}
      removeLabel={`Remove step ${step.label || 'without a label'}`}
      stepKey={step.key}
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
                <li
                  key={claimRefIdentity(premise)}
                  className="flex items-center gap-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {label(premise)}
                    {premise.kind === 'working' ? (
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                        working
                      </span>
                    ) : null}
                  </span>
                  <span className="w-36 shrink-0">
                    <VocabSelect
                      value={premise.role}
                      options={vocab.premiseRoles}
                      label=""
                      ariaLabel="Premise role"
                      onSelect={(value) => {
                        const role = value as InferencePremiseRoleValue
                        if (premise.kind === 'working') {
                          onSetWorkingPremiseRole(premise.localId, role)
                        } else {
                          onSetPremiseRole(premise.claimId, role)
                        }
                      }}
                    />
                  </span>
                  <button
                    type="button"
                    aria-label="Remove premise"
                    onClick={() => {
                      if (premise.kind === 'working') {
                        onRemoveWorkingPremise(premise.localId)
                      } else {
                        onRemovePremise(premise.claimId)
                      }
                    }}
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
          {addableWorking.length > 0 ? (
            <div className="mt-2">
              <WorkingClaimSelect
                claims={addableWorking}
                label="Add a working premise"
                onSelect={(localId) => onAddWorkingPremise(localId, 'PRIMARY')}
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
                  key={claimRefIdentity(conclusion)}
                  className="flex items-center gap-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {label(conclusion)}
                    {conclusion.kind === 'working' ? (
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                        working
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove conclusion"
                    onClick={() => {
                      if (conclusion.kind === 'working') {
                        onRemoveWorkingConclusion(conclusion.localId)
                      } else {
                        onRemoveConclusion(conclusion.claimId)
                      }
                    }}
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
          {addableWorking.length > 0 ? (
            <div className="mt-2">
              <WorkingClaimSelect
                claims={addableWorking}
                label="Add a working conclusion"
                onSelect={onAddWorkingConclusion}
              />
            </div>
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
                    ariaLabel="Role in chain"
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
/** A working assertion is never assumed established: the author must name its standing. */
const FALLBACK_WORKING_STATUS = 'WORKING'
/** Shared styling for the three step presets so they read as one control group. */
const STEP_PRESET_BUTTON_CLASS =
  'rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted'

/** The control each preset puts the caret in once its step card appears. */
type AddedStepFocus = 'label' | 'inference' | 'premise'

/**
 * Move focus into the step card that was just added.
 *
 * @param stepKey The client-stable key of the new step.
 * @param focus Which control to focus: label, inference select or premise select.
 * @returns Nothing; focus moves on the next frame so the card exists first.
 */
function focusAddedStep(
  stepKey: string | undefined,
  focus: AddedStepFocus,
): void {
  if (stepKey === undefined || typeof document === 'undefined') return

  const moveFocus = () => {
    const card = document.querySelector<HTMLElement>(
      `[data-step-key="${stepKey}"]`,
    )
    if (card === null) return

    const select =
      focus === 'inference'
        ? card.querySelector<HTMLSelectElement>(
            'select[aria-label="Inference type"]',
          )
        : focus === 'premise'
          ? (card.querySelector<HTMLSelectElement>(
              'select[aria-label="Add a premise claim"]',
            ) ??
            card.querySelector<HTMLSelectElement>(
              'select[aria-label="Add a working premise"]',
            ))
          : null
    const control =
      select ?? card.querySelector<HTMLInputElement>('input[type="text"]')
    control?.focus()
  }

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(moveFocus)
  } else {
    queueMicrotask(moveFocus)
  }
}

/**
 * One researcher-authored working claim. Never a canonical claim, source or fact.
 *
 * @param props The claim and its model callbacks.
 * @returns A working-claim card.
 */
function WorkingClaimCard({
  claim,
  onPatch,
  onRemove,
}: {
  claim: DraftWorkingClaim
  onPatch: (input: WorkingClaimInput) => void
  onRemove: () => void
}) {
  return (
    <CardFrame
      title={
        claim.label.trim() === '' ? 'Unlabelled working assertion' : claim.label
      }
      badge="working"
      onRemove={onRemove}
      removeLabel={`Remove working assertion ${claim.label || claim.localId}`}
    >
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          Assertion
        </span>
        <input
          type="text"
          value={claim.label}
          onInput={(event) =>
            onPatch({
              ...claim,
              label: (event.target as HTMLInputElement).value,
            })
          }
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-muted-foreground">
          Notes (not evidence)
        </span>
        <textarea
          value={claim.description ?? ''}
          onInput={(event) =>
            onPatch({
              ...claim,
              description: (event.target as HTMLTextAreaElement).value,
            })
          }
          rows={2}
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Epistemic status (free text)
          </span>
          <input
            type="text"
            value={claim.epistemicStatus}
            onInput={(event) =>
              onPatch({
                ...claim,
                epistemicStatus: (event.target as HTMLInputElement).value,
              })
            }
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Source pointer (optional; not evidence)
          </span>
          <input
            type="text"
            value={claim.source ?? ''}
            onInput={(event) =>
              onPatch({
                ...claim,
                source: (event.target as HTMLInputElement).value,
              })
            }
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </div>
    </CardFrame>
  )
}

/**
 * A plain-language question with its formal term visible and a concrete example on demand.
 *
 * @param label The researcher-facing question.
 * @param formal The ontology term behind it, always visible as help text.
 * @param example A concrete illustration disclosed under "Example".
 * @returns A labelled heading with visible help text and a collapsed example.
 */
function QuestionHeading({
  label,
  formal,
  example,
}: {
  label: string
  formal: string
  example: string
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h3 className="text-base font-semibold text-foreground">{label}</h3>
      <span className="text-xs text-muted-foreground">
        formal term: {formal}
      </span>
      <details
        className="text-xs text-muted-foreground"
        data-testid="question-example"
      >
        <summary className="cursor-pointer">Example</summary>
        <blockquote className="mt-1 border-l-2 border-muted-foreground/40 pl-3 italic text-muted-foreground">
          Example: “{example}”
        </blockquote>
        <p className="mt-0.5">
          Illustration only — not pre-filled, and not drawn from this card.
        </p>
      </details>
    </div>
  )
}

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
  dirty = false,
  hasDraft = false,
  issuesRef,
  onChange,
}: ComposeEditorProps) {
  const apply = (next: DraftPayload) => onChange(next)
  // A pristine empty draft is a neutral starting point, not an error state. A saved
  // draft that has since become invalid still needs its full issue list discoverable.
  const showIssues = issues.length > 0 && (dirty || hasDraft)

  const addStepPreset = (
    seedLabel: string,
    inferenceType: InferenceTypeValue,
    focus: AddedStepFocus,
  ) => {
    const next = addStep(draft, {
      label: seedLabel,
      description: '',
      inferenceType,
      epistemicStatus: '',
      notes: null,
      premises: [],
      conclusions: [],
    })
    apply(next)
    focusAddedStep(next.steps[next.steps.length - 1]?.key, focus)
  }

  return (
    <div data-testid="compose-editor" className="space-y-6">
      <p className="text-sm text-muted-foreground">
        A draft for you, on this card only. It can never become canonical.
      </p>

      <section className="compose-scroll-target space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <QuestionHeading
              label="What is the assertion?"
              formal="working claim"
              example="The new rule reduced waiting times because it made the application process simpler."
            />
            <p className="mt-0.5 text-sm text-muted-foreground">
              Write the claim you are examining, and state its status. A source
              pointer is optional and is not evidence.
            </p>
          </div>
          <button
            type="button"
            data-testid="add-working-claim"
            onClick={() =>
              apply(
                addWorkingClaim(draft, nextWorkingLocalId(draft), {
                  label: '',
                  description: null,
                  epistemicStatus: FALLBACK_WORKING_STATUS,
                  source: null,
                }),
              )
            }
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Add working assertion
          </button>
        </div>
        {draft.workingClaims.length === 0 ? (
          <p
            className="rounded-lg border border-dashed border-graph-border/70 bg-graph-muted/30 p-4 text-sm text-muted-foreground"
            data-testid="no-working-claims"
          >
            Start with an assertion. It stays in your draft.
          </p>
        ) : (
          <ul className="space-y-3">
            {draft.workingClaims.map((claim) => (
              <WorkingClaimCard
                key={claim.localId}
                claim={claim}
                onPatch={(input) =>
                  apply(updateWorkingClaim(draft, claim.localId, input))
                }
                onRemove={() => apply(removeWorkingClaim(draft, claim.localId))}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="compose-scroll-target space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <QuestionHeading
              label="What reasons are offered?"
              formal="premises"
              example="Applications now pass through two review stages instead of four."
            />
            <QuestionHeading
              label="How does the reasoning work?"
              formal="inference step"
              example="Fewer review stages mean faster decisions; this rule removed two stages, so waiting times should fall."
            />
            <QuestionHeading
              label="What challenges or qualifies it?"
              formal="counterpremise / challenge"
              example="Longer waiting times may reflect staffing levels rather than the number of form stages."
            />
            <p
              className="mt-0.5 text-sm text-muted-foreground"
              data-testid="challenge-guidance"
            >
              A premise may be marked COUNTERPREMISE, or a COUNTER step may be
              attached in a chain. Add challenge seeds a labelled step; the role
              is still yours to choose. A challenge is optional in a draft.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                addStepPreset(
                  '',
                  vocab.inferenceTypes[0] ?? FALLBACK_INFERENCE_TYPE,
                  'label',
                )
              }
              className={STEP_PRESET_BUTTON_CLASS}
            >
              Add step
            </button>
            <button
              type="button"
              onClick={() =>
                addStepPreset('Inference step', 'UNSPECIFIED', 'inference')
              }
              className={STEP_PRESET_BUTTON_CLASS}
            >
              Add inference step
            </button>
            <button
              type="button"
              onClick={() =>
                addStepPreset('Challenge', 'UNSPECIFIED', 'premise')
              }
              className={STEP_PRESET_BUTTON_CLASS}
            >
              Add challenge
            </button>
          </div>
        </div>

        {draft.steps.length === 0 ? (
          <p
            className="rounded-lg border border-dashed border-graph-border/70 bg-graph-muted/30 p-4 text-sm text-muted-foreground"
            data-testid="no-steps"
          >
            Add a step to connect reasons to a conclusion.
          </p>
        ) : (
          <ul className="space-y-3">
            {draft.steps.map((step) => (
              <StepCard
                key={step.key}
                step={step}
                pool={pool}
                workingClaims={draft.workingClaims}
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
                onAddWorkingPremise={(localId, role) =>
                  apply(addWorkingPremise(draft, step.key, localId, role))
                }
                onRemoveWorkingPremise={(localId) =>
                  apply(removeWorkingPremise(draft, step.key, localId))
                }
                onSetWorkingPremiseRole={(localId, role) =>
                  apply(setWorkingPremiseRole(draft, step.key, localId, role))
                }
                onAddConclusion={(claimId) =>
                  apply(addConclusion(draft, step.key, claimId))
                }
                onRemoveConclusion={(claimId) =>
                  apply(removeConclusion(draft, step.key, claimId))
                }
                onAddWorkingConclusion={(localId) =>
                  apply(addWorkingConclusion(draft, step.key, localId))
                }
                onRemoveWorkingConclusion={(localId) =>
                  apply(removeWorkingConclusion(draft, step.key, localId))
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="compose-scroll-target space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div>
            <QuestionHeading
              label="Construct an argument"
              formal="argument chain"
              example="Simplification → fewer review stages → faster decisions → shorter waiting times."
            />
            <p className="mt-0.5 text-sm text-muted-foreground">
              Name a path through your own steps. A chain needs at least one
              actual step and a MAIN step; a COUNTER or CHALLENGE is optional in
              a draft. Paths and names are yours to confirm.
            </p>
          </div>
          <button
            type="button"
            disabled={draft.steps.length === 0}
            aria-disabled={draft.steps.length === 0}
            data-testid="add-chain"
            onClick={() => {
              if (draft.steps.length === 0) return
              const withChain = addChain(draft, {
                label: '',
                description: '',
                kind: vocab.chainKinds[0] ?? FALLBACK_CHAIN_KIND,
                epistemicStatus: '',
              })
              const newKey = withChain.chains[withChain.chains.length - 1].key
              apply(addChainStep(withChain, newKey, draft.steps[0].key, 'MAIN'))
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted disabled:text-muted-foreground"
          >
            Add chain
          </button>
        </div>

        {draft.chains.length === 0 ? (
          <p
            className="rounded-lg border border-dashed border-graph-border/70 bg-graph-muted/30 p-4 text-sm text-muted-foreground"
            data-testid="no-chains"
          >
            Add a reasoning step first, then construct a chain.
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
      </section>

      {showIssues ? (
        <div
          id="compose-issues"
          ref={issuesRef}
          tabIndex={-1}
          data-testid="compose-issues"
          className="compose-scroll-target rounded-lg border border-amber-600/40 bg-amber-500/10 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
