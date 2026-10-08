/**
 * The featured card's provenance/reasoning preview (SPEC §6.2).
 *
 * Every row is a {@link DimensionReadout}, and the three rows are not the same
 * kind of claim:
 *
 * - **Claims and reasoning steps** count the featured card's own rows in the
 *   projection. A zero here is a real zero: the request reached the dimension,
 *   the card has none.
 * - **Sources** can instead report that no count is honest — the view excludes
 *   `source`, or the request stopped before attribution is reachable. Then the
 *   server's reason is shown in place of a number, because `0 sources` would
 *   say "checked and found none" about a dimension that was never checked.
 *
 * A `count` of `null` with no note means *nothing has loaded yet* — the
 * descriptor is still in flight — and renders as dashes with a caption,
 * because "Not reported in this view." would be a claim about a view nobody
 * has read.
 */

import type { CardPreview, DimensionReadout } from './deck-model'

/** Props for {@link ProvenancePreview}. */
export type ProvenancePreviewProps = {
  /** The derived preview, or `null` while the projection loads. */
  readonly preview: CardPreview | null
}

/** One preview row: a label and the value (or note) that answers it. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

/** `1 claim` / `3 claims`, with no plural lie on the boundary. */
function countNoun(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * What one row should say: a count, the reason there is none, or nothing yet.
 *
 * @param readout The row's readout, or `null` while the whole preview loads.
 * @param noun The singular noun to pluralise a count with.
 * @returns The rendered value, `—` for pending.
 */
function valueFor(readout: DimensionReadout | null, noun: string): string {
  if (readout === null) return '—'
  if (readout.count === null) {
    return readout.note ?? 'Not reported in this view.'
  }
  return countNoun(readout.count, noun)
}

/**
 * The provenance and reasoning half of the card's readout region.
 *
 * @param props See {@link ProvenancePreviewProps}.
 * @returns A `<section>` with claims, reasoning steps and sources rows.
 */
export function ProvenancePreview({ preview }: ProvenancePreviewProps) {
  // Nothing has loaded when the preview itself is absent; a row with no count
  // and no note is the descriptor still in flight, which the caption explains
  // rather than leaving three unexplained dashes.
  const pending =
    preview === null ||
    [preview.claims, preview.reasoningSteps, preview.provenance].some(
      (readout) => readout.count === null && readout.note === null,
    )
  const claims = preview === null ? null : valueFor(preview.claims, 'claim')
  const steps =
    preview === null ? null : valueFor(preview.reasoningSteps, 'step')
  const sources =
    preview === null ? null : valueFor(preview.provenance, 'source')

  return (
    <section
      data-testid="provenance-preview"
      aria-label="Provenance and reasoning preview"
      className="rounded-lg border border-graph-border/70 bg-graph-muted/40 p-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Provenance &amp; reasoning
      </h3>
      <dl className="mt-2 space-y-1.5">
        <Row label="Claims" value={claims ?? '—'} />
        <Row label="Reasoning steps" value={steps ?? '—'} />
        <Row label="Sources" value={sources ?? '—'} />
      </dl>
      {pending ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {preview === null ? 'Loading card details…' : 'Loading view details…'}
        </p>
      ) : null}
    </section>
  )
}
