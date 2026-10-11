/**
 * The card's Analysis face — how the claim is examined (SPEC §7.3), plus the
 * three reading lists it presents.
 *
 * Three lists, never one: claims, reasoning steps, and sources. A source is
 * provenance *for* a claim — not evidence, not a claim, not a step — and the
 * one place they could collapse into a single "references" list is exactly the
 * collapse the ontology forbids (SPEC §8), so the section headers say which is
 * which and the sources list says so in words.
 *
 * Every list reports an empty result as an empty result ("No sources in this
 * projection."), which is a real fact about the projection rather than a
 * missing region. Counterevidence and limitations are not carried by the deck
 * projection at all, so that section says so instead of implying none exist.
 */

import type { CardPreview, CardReading, ReadingEntry } from './deck-model'
import { cardStatusLabel } from './deck-status'
import { EvidenceState } from './evidence-state'
import { ProvenancePreview } from './provenance-preview'

/** Props for {@link CardAnalysis}. */
export type CardAnalysisProps = {
  /** The derived reading, or `null` while the projection loads. */
  readonly reading: CardReading | null
  /** The derived provenance/evidence preview, or `null` while it loads. */
  readonly preview: CardPreview | null
}

/** Props for {@link CardReadingPanel}. */
export type CardReadingPanelProps = {
  /** The derived reading, or `null` while the projection loads. */
  readonly reading: CardReading | null
}

/** One entry: its label, its status token when it has one, its detail. */
function Entry({ entry }: { entry: ReadingEntry }) {
  return (
    <li className="rounded-lg border border-graph-border/60 bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {entry.label}
        </span>
        {entry.status !== null ? (
          <span
            className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground"
            data-claim-status={entry.status}
          >
            {cardStatusLabel(entry.status)}
          </span>
        ) : null}
      </div>
      {entry.detail !== null ? (
        <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
      ) : null}
    </li>
  )
}

/** One of the three lists, with its own empty state. */
function ReadingList({
  title,
  entries,
  empty,
}: {
  title: string
  entries: readonly ReadingEntry[]
  empty: string
}) {
  return (
    <section aria-label={title}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {entries.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {entries.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * The three reading lists, revealed by `Read analysis`.
 *
 * @param props See {@link CardReadingPanelProps}.
 * @returns The three lists, or a pending note while they load.
 */
export function CardReadingPanel({ reading }: CardReadingPanelProps) {
  return (
    <div
      data-testid="card-reading"
      className="mt-4 space-y-4 rounded-lg border border-graph-border/70 bg-graph-muted/30 p-4"
    >
      {reading === null ? (
        <p className="text-sm text-muted-foreground">Loading reading…</p>
      ) : (
        <>
          <ReadingList
            title="Claims"
            entries={reading.claims}
            empty="No claims in this projection."
          />
          <ReadingList
            title="Reasoning steps"
            entries={reading.steps}
            empty="No reasoning steps in this projection."
          />
          <ReadingList
            title="Sources"
            entries={reading.sources}
            empty="No sources in this projection."
          />
          <p className="text-xs text-muted-foreground">
            Sources document where a claim came from; they are not evidence and
            not claims.
          </p>
        </>
      )}
    </div>
  )
}

/**
 * The Analysis face — how the claim is examined (SPEC §7.3).
 *
 * @param props See {@link CardAnalysisProps}.
 * @returns A `<div>` with the provenance/evidence readouts, the reading
 * lists, and an honest note about counterevidence.
 */
export function CardAnalysis({ reading, preview }: CardAnalysisProps) {
  return (
    <div data-testid="card-analysis">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Analysis
      </h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ProvenancePreview preview={preview} />
        <EvidenceState readout={preview?.evidence ?? null} />
      </div>

      <CardReadingPanel reading={reading} />

      <section aria-label="Counterevidence and limitations" className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Counterevidence &amp; limitations
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Counterevidence, uncertainty, and unresolved questions are not carried
          by this deck projection, so none is reported here.
        </p>
      </section>
    </div>
  )
}
