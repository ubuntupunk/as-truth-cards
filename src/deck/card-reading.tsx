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
  /** Authored narrative/analysis text for the card, if present. */
  readonly narrative?: string | null
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
 * Renders the authored narrative with the repo's plain-text conventions.
 *
 * The corpus stores card prose as plain text (no markdown pipeline exists and
 * issue #14 forbids introducing a parallel format), so the convention here is
 * minimal and documented rather than a second content system:
 *
 * - blocks are separated by one blank line;
 * - a single-line block whose first token is `#` renders as a section
 *   heading, with the hashes stripped — everything else is a paragraph.
 *
 * @param narrative Trimmed, non-empty narrative text.
 * @returns Headings and paragraphs for the narrative region.
 * @example
 * ```tsx
 * <NarrativeContent narrative={'# The category problem\n\nAnachronism maps the present onto the past.'} />
 * ```
 */
function NarrativeContent({ narrative }: { narrative: string }) {
  const blocks = narrative
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)

  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block, index) =>
        /^#{1,4}\s+/.test(block) && !block.includes('\n') ? (
          <h4
            // biome-ignore lint/suspicious/noArrayIndexKey: narrative blocks are positional prose — the list is rebuilt from immutable authored text and never reorders, so the index is the stable identity; content-derived keys would collide on repeated paragraphs.
            key={index}
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            {block.replace(/^#{1,4}\s+/, '')}
          </h4>
        ) : (
          <p
            // biome-ignore lint/suspicious/noArrayIndexKey: as above — positional prose, stable because the text is authored and immutable.
            key={index}
            className="max-w-prose break-words text-sm leading-relaxed text-foreground"
          >
            {block}
          </p>
        ),
      )}
    </div>
  )
}

/**
 * The Analysis face — how the claim is examined (SPEC §7.3).
 *
 * The authored narrative leads the face (issue #14): it is the readable
 * explanation of the issue, reported as authored editorial prose and never as
 * evidence. The structural readouts — provenance, evidence state, the three
 * reading lists, counterevidence — follow it unchanged.
 *
 * @param props See {@link CardAnalysisProps}.
 * @returns A `<div>` with the narrative region, the provenance/evidence
 * readouts, the reading lists, and an honest note about counterevidence.
 */
export function CardAnalysis({
  reading,
  preview,
  narrative,
}: CardAnalysisProps) {
  const narrativeContent =
    typeof narrative === 'string' && narrative.trim().length > 0
      ? narrative.trim()
      : null

  return (
    <div data-testid="card-analysis">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Analysis
      </h3>

      <section
        aria-label="Narrative analysis"
        className="mt-3 rounded-lg border border-graph-border/70 bg-background p-4"
        data-testid="analysis-narrative"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Narrative analysis
        </h4>
        {narrativeContent === null ? (
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            No narrative analysis has been supplied for this card. What follows
            — claims, reasoning, sources, and evidence readouts — is the
            structured record, not a narrative; the absence reported here is
            about prose, not about the record.
          </p>
        ) : (
          <>
            <NarrativeContent narrative={narrativeContent} />
            <p className="mt-3 text-xs text-muted-foreground">
              Authored editorial analysis. It is narrative prose — not evidence,
              not a claim, not a source, and not a reasoning step.
            </p>
          </>
        )}
      </section>

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
