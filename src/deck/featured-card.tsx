/**
 * The featured research card (SPEC §6.2, §3.3) — an editorial panel, not a
 * 2:3 playing card and not a flip.
 *
 * Its regions are separate on purpose, because SPEC §15 requires title,
 * summary, classification, provenance and evidence to be individually
 * addressable: identity/status, title, summary, classification tags,
 * provenance & reasoning preview, evidence state, actions, and — only while
 * `Read front & back` is open — the full reading. Long titles and summaries
 * wrap (no fixed card width), so nothing clips on a narrow viewport.
 *
 * The projection-derived parts arrive as already-derived models
 * ({@link CardPreview} / {@link CardReading}), so this component renders and
 * never computes: when either is `null` (still loading) it shows a pending
 * state rather than a zero it has not earned.
 */

import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import { ApiErrorState, MalformedState } from '../graph/graph-states'
import { ProjectionShapeError } from '../graph/projection-guards'
import { CardActions } from './card-actions'
import { CardMetadata } from './card-metadata'
import { CardReadingPanel } from './card-reading'
import { ClassificationTags } from './classification-tags'
import type { CardPreview, CardReading } from './deck-model'
import { EvidenceState } from './evidence-state'
import { ProvenancePreview } from './provenance-preview'

/** Props for {@link FeaturedCard}. */
export type FeaturedCardProps = {
  readonly card: CardListingRow
  /** The composed identity label, e.g. `Card / ID-07`. */
  readonly idLabel: string
  /** Projection-derived preview, or `null` while the projection loads. */
  readonly preview: CardPreview | null
  /** Projection-derived reading, or `null` while the projection loads. */
  readonly reading: CardReading | null
  readonly readingOpen: boolean
  readonly onToggleRead: () => void
  /**
   * The projection query's rejection, or `null` when it has not rejected.
   *
   * The listing still has the card's title, summary and classification, so
   * those stay on screen and the *derived* half of the card — preview,
   * evidence, reading — is replaced by one error state rather than left to
   * render dashes that read as "still loading". The reading is omitted while
   * this is set: there is no projection to open, and a toggle that expands
   * into an error the card already shows would be two displays for one
   * failure.
   */
  readonly projectionError?: unknown | null
}

/**
 * The featured card panel.
 *
 * @param props See {@link FeaturedCardProps}.
 * @returns An `<article>` containing every §6.2 region.
 */
export function FeaturedCard({
  card,
  idLabel,
  preview,
  reading,
  readingOpen,
  onToggleRead,
  projectionError = null,
}: FeaturedCardProps) {
  const failed = projectionError !== null
  return (
    <article
      data-testid="featured-card"
      data-slug={card.slug}
      className="rounded-2xl border border-graph-border bg-card p-5 shadow-sm sm:p-6"
    >
      <CardMetadata idLabel={idLabel} status={card.epistemicStatus} />

      <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight text-foreground">
        {card.title}
      </h2>

      <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
        {card.summary ??
          card.coreQuestion ??
          'No summary recorded for this card.'}
      </p>

      <ClassificationTags classification={card.classification} />

      {failed ? (
        <div className="mt-4">
          {projectionError instanceof ProjectionShapeError ? (
            <MalformedState error={projectionError} />
          ) : (
            <ApiErrorState error={projectionError} />
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ProvenancePreview preview={preview} />
          <EvidenceState readout={preview?.evidence ?? null} />
        </div>
      )}

      <CardActions
        readingOpen={readingOpen}
        onToggleRead={onToggleRead}
        slug={card.slug}
        readingAvailable={!failed}
      />

      {readingOpen && !failed ? <CardReadingPanel reading={reading} /> : null}
    </article>
  )
}
