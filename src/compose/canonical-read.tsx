/**
 * The canonical decomposition, read-only, beside the compose editor.
 *
 * Everything in this panel comes from the `trope_graph` projection and nothing the author
 * types can reach it. It exists so the composer studies the corpus's own reasoning while
 * authoring non-canonical work, and so the two are visibly different surfaces: canonical
 * steps and chains are rendered here with their kinds and inference types; the editor's
 * draft below renders the author's own. Status is never colour alone — free-text status is
 * rendered as text, and claim status reuses {@link StatusBadge} (which always says the
 * status in words).
 */

import type { ComponentChildren } from 'preact'
import { StatusBadge } from '@/deck/status-badge'
import type { CanonicalClaim, ComposeProjection } from './compose-projector'

/** Props for {@link CanonicalDecomposition}. */
export type CanonicalDecompositionProps = {
  /** The featured card's scoped readout, or `null` while it loads. */
  readonly data: ComposeProjection | null
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {note ? (
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      ) : null}
      {children}
    </section>
  )
}

/**
 * The read-only canonical view: claim pool, canonical steps, canonical chains.
 *
 * @param props See {@link CanonicalDecompositionProps}.
 * @returns The panel, or a pending note while the projection loads.
 */
export function CanonicalDecomposition({ data }: CanonicalDecompositionProps) {
  if (data === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading the canonical decomposition…
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

  return (
    <div
      data-testid="canonical-decomposition"
      className="space-y-5 rounded-lg border border-graph-border/70 bg-graph-muted/30 p-4"
    >
      <ListSection
        title="Claims on this card"
        note="The authoring pool below is drawn from these claims, and only these."
      >
        {data.claims.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No claims in this projection.
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
        title="Canonical reasoning steps"
        note="The corpus's own decomposition. A step stores its status as free text, not a badge."
      >
        {data.steps.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No canonical steps in this projection.
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
                  Status: {step.epistemicStatus}
                  {step.isCanonical ? '' : ' · not canonical'}
                </p>
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
        note="Named paths through the canonical steps. Whatever you draft below is yours, never one of these."
      >
        {data.chains.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No argument chains in this projection.
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
        This canonical decomposition is read from the ontology. It cannot be
        edited here, and nothing you author below becomes part of it.
      </p>
    </div>
  )
}
