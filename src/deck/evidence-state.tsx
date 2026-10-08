/**
 * The featured card's evidence state (SPEC §6.2), kept separate from
 * provenance on purpose.
 *
 * Evidence is not provenance: a source says *where a claim came from*, an
 * evidence item says *what supports it*, and the ontology keeps them apart —
 * so the card keeps them in two regions (SPEC §15: "Title, summary,
 * classification, provenance, and evidence are separate regions").
 *
 * The readout is the honest {@link DimensionReadout} from `deck-model.ts`:
 *
 * - `count: 0` → "0 evidence items", a real zero (asked, found none).
 * - `count: null` → the server's reason instead of a number, because the view
 *   never carried evidence at all.
 * - `null` readout → the projection has not loaded; dashes, not a claim.
 */

import type { DimensionReadout } from './deck-model'

/** Props for {@link EvidenceState}. */
export type EvidenceStateProps = {
  /** The derived evidence readout, or `null` while the projection loads. */
  readonly readout: DimensionReadout | null
}

/**
 * The evidence region of the featured card.
 *
 * @param props See {@link EvidenceStateProps}.
 * @returns A `<section>` reporting evidence as count, reason, or pending.
 */
export function EvidenceState({ readout }: EvidenceStateProps) {
  // `count: null` with no note means the descriptor has not loaded, not that
  // the view has no evidence: that reads as pending, never as "not reported".
  const pending =
    readout === null || (readout.count === null && readout.note === null)
  const value = pending
    ? '—'
    : readout.count === null
      ? (readout.note ?? 'Not reported in this view.')
      : `${readout.count} evidence item${readout.count === 1 ? '' : 's'}`

  return (
    <section
      data-testid="evidence-state"
      aria-label="Evidence state"
      className="rounded-lg border border-graph-border/70 bg-graph-muted/40 p-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Evidence
      </h3>
      <p className="mt-2 text-sm font-medium text-foreground" data-value>
        {value}
      </p>
      {!pending && readout.count === null ? (
        <p className="mt-0.5 text-xs text-muted-foreground">Not counted here</p>
      ) : null}
      {pending ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Loading card details…
        </p>
      ) : null}
    </section>
  )
}
