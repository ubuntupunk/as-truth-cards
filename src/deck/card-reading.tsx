/**
 * The expanded reading behind `Read front & back` (SPEC §7).
 *
 * Three lists, never one: claims, reasoning steps, and sources. A source is
 * provenance *for* a claim — not evidence, not a claim, not a step — and the
 * one place they could collapse into a single "references" list is exactly the
 * collapse the ontology forbids (SPEC §8), so the section headers say which is
 * which and the sources list says so in words.
 *
 * Every list reports an empty result as an empty result ("No sources in this
 * projection."), which is a real fact about the projection rather than a
 * missing region.
 */

import type { CardReading, ReadingEntry } from './deck-model'
import { cardStatusLabel } from './deck-status'

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
 * The complete card reading, revealed by `Read front & back`.
 *
 * @param props See {@link CardReadingPanelProps}.
 * @returns The three reading lists, or a pending note while they load.
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
            title="Front · Claims"
            entries={reading.claims}
            empty="No claims in this projection."
          />
          <ReadingList
            title="Back · Reasoning steps"
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
