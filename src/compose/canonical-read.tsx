/**
 * The recorded reasoning panel, read-only, beside the compose editor.
 *
 * Everything in this panel comes from the `trope_graph` projection and nothing the author
 * types can reach it. It exists so the composer studies the corpus's own reasoning while
 * authoring non-canonical work, and so the two are visibly different surfaces: recorded
 * steps and chains are rendered here with their kinds and inference types; the editor's
 * draft below renders the author's own. Section wording deliberately says *recorded*, not
 * *canonical*: a step row carries its own `is_canonical` flag, which is disclosed per row.
 * Empty states say claims are not currently recorded and point to working authoring, rather
 * than implying the projection or loader failed. Status is never colour alone — free-text
 * status is rendered as text, and claim status reuses {@link StatusBadge}.
 */

import type { ComponentChildren } from 'preact'
import { StatusBadge } from '@/deck/status-badge'
import type { ComposeAuthState } from './compose-model'
import type { CanonicalClaim, ComposeProjection } from './compose-projector'

/** Props for {@link CanonicalDecomposition}. */
export type CanonicalDecompositionProps = {
  /** The featured card's scoped readout, or `null` while it loads. */
  readonly data: ComposeProjection | null
  /** Drives the default disclosure state; only a signed-in author may start collapsed. */
  readonly auth: ComposeAuthState
}

/** One claim, as a reusable <li> in both the pool list and the premise/conclusion reads. */
function ClaimRow({ claim }: { claim: CanonicalClaim }) {
  return (
    <li className="rounded-lg border border-graph-border/60 bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {claim.statement}
        </span>
        <StatusBadge status={claim.epistemicStatus} />
      </div>
      {claim.description !== null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {claim.description}
        </p>
      ) : null}
    </li>
  )
}

/** A section list with a shared empty state. */
function ListSection({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: ComponentChildren
}) {
  return (
    <section aria-label={title}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {note ? (
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      ) : null}
      {children}
    </section>
  )
}

/**
 * A singular/plural count, e.g. `1 claim` or `0 steps`.
 *
 * @param count The number of recorded records.
 * @param noun The singular noun.
 * @returns The count phrase.
 */
function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * The read-only recorded reasoning view: claim pool, steps, and chains.
 *
 * A populated card is summarized in a native disclosure for a signed-in author, so the
 * draft workspace stays the active surface without skipping the recorded material. A
 * zero-claim card has no disclosure to hide behind: its honest empty notes stay visible.
 * Signed-out authors keep the panel open because it is the substantive read surface on
 * this route. Every recorded section is `h3` under the panel's single `h2`.
 *
 * @param props See {@link CanonicalDecompositionProps}.
 * @returns The panel, or a pending note while the projection loads.
 */
export function CanonicalDecomposition({
  data,
  auth,
}: CanonicalDecompositionProps) {
  if (data === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading the recorded reasoning…
      </p>
    )
  }

  const pool = new Map(data.claims.map((claim) => [claim.id, claim]))
  const claimStatement = (claimId: string): string => {
    const claim = pool.get(claimId)
    return claim !== undefined
      ? claim.statement
      : `Claim ${claimId.slice(0, 8)}…`
  }

  const counts = [
    countLabel(data.claims.length, 'claim'),
    countLabel(data.steps.length, 'step'),
    countLabel(data.chains.length, 'chain'),
  ].join(' · ')
  const populated =
    data.claims.length + data.steps.length + data.chains.length > 0
  const collapsible = auth === 'signed-in' && populated

  const heading = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 className="text-lg font-semibold text-foreground">
        Recorded reasoning
      </h2>
      <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
        READ ONLY · CORPUS
      </span>
      <span className="text-xs text-muted-foreground">{counts}</span>
      {collapsible || (populated && auth !== 'signed-in') ? (
        <>
          <span className="ml-auto text-xs font-medium text-foreground group-open:hidden">
            Read recorded
          </span>
          <span className="ml-auto hidden text-xs font-medium text-muted-foreground group-open:inline">
            Hide recorded reasoning
          </span>
        </>
      ) : null}
    </div>
  )

  const content = (
    <div className="mt-4 space-y-5">
      <ListSection
        title="Claims on this card"
        note="The authoring pool below is drawn from these claims, and only these."
      >
        {data.claims.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Canonical claims are not currently recorded for this card. You can
            begin with a working assertion below; it stays in your draft.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {data.claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} />
            ))}
          </ul>
        )}
      </ListSection>

      <ListSection
        title="Reasoning steps recorded for this card"
        note="Published corpus records. A step may or may not be canonical; each row says which."
      >
        {data.steps.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No reasoning steps are currently recorded for this card.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {data.steps.map((step) => (
              <li
                key={step.id}
                className="rounded-lg border border-graph-border/60 bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {step.label}
                  </span>
                  <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                    {step.inferenceType}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status: {step.epistemicStatus} ·{' '}
                  {step.isCanonical ? 'Canonical' : 'Not yet canonical'}
                </p>
                <details className="mt-0.5 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    Raw is_canonical flag
                  </summary>
                  <p className="mt-0.5 font-mono">
                    is_canonical: {step.isCanonical ? 'true' : 'false'}
                  </p>
                </details>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Premises
                    </p>
                    <ul className="mt-0.5 list-inside list-disc text-sm text-foreground">
                      {step.premises.map((premise) => (
                        <li key={`${premise.id}-${premise.role}`}>
                          {claimStatement(premise.id)}
                          <span className="text-xs text-muted-foreground">
                            {' '}
                            · {premise.role}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Conclusions
                    </p>
                    <ul className="mt-0.5 list-inside list-disc text-sm text-foreground">
                      {step.conclusions.map((conclusion) => (
                        <li key={conclusion.id}>
                          {claimStatement(conclusion.id)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListSection>

      <ListSection
        title="Argument chains"
        note="Named paths through the recorded steps. Whatever you draft below is yours, never one of these."
      >
        {data.chains.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No argument chains are currently recorded for this card. You can
            construct your own below; it stays in your draft.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {data.chains.map((chain) => (
              <li
                key={chain.id}
                className="rounded-lg border border-graph-border/60 bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {chain.label}
                  </span>
                  <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                    {chain.kind}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {chain.description}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {chain.stepIds.length} step
                  {chain.stepIds.length === 1 ? '' : 's'} · status{' '}
                  {chain.epistemicStatus}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ListSection>

      <p className="text-xs text-muted-foreground">
        This recorded reasoning comes from the corpus. It cannot be edited here,
        and nothing you author below becomes part of it.
      </p>
    </div>
  )

  return (
    <div
      data-testid="canonical-decomposition"
      className="compose-scroll-target rounded-lg border border-graph-border/70 bg-graph-muted/30 p-4"
    >
      {populated ? (
        <details
          data-testid="recorded-disclosure"
          className="group"
          open={!collapsible}
        >
          <summary className="cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {heading}
          </summary>
          {content}
        </details>
      ) : (
        <>
          {heading}
          {content}
        </>
      )}
    </div>
  )
}
