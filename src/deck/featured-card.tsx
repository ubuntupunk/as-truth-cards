/**
 * The featured research card (SPEC §6.2, §7, §3.3) — an editorial panel with
 * two faces from the Figma "Card Detail — Front / Back" model.
 *
 * The **front** is the Cover — recognition and discovery: an optional,
 * rights-cleared cover image (or a designed typographic fallback), the title
 * as the primary identity, and a compact id marker.
 *
 * The **back** carries the reading faces of one canonical card:
 *
 * - **Claim** — what is asserted: the claim/core question, canonical
 *   classification, the human-readable status, and the research framing.
 * - **Analysis** — how it is examined: provenance/reasoning preview, evidence,
 *   the reading lists, and honest notes where a dimension is not carried.
 *
 * The flip between front and back is presentation-only (`data-flipped` on the
 * flip stage; the inactive face is `inert` + `aria-hidden`). The same `card`,
 * `preview` and `reading` arrive whatever the facing, so title, summary,
 * classification, provenance and evidence stay separately addressable (SPEC
 * §15) and the card's canonical identity, classification and epistemic status
 * never change with the facing (SPEC §7.4). In reduced-motion or non-3D
 * contexts the faces swap statefully with no transform (src/index.css).
 *
 * Close (flipping back to the front) returns to the deck (`cover`); the card,
 * its position and the active filters are owned by the page, not here. Saving
 * is an independent action and is never coupled to a facing transition (SPEC
 * §7.4).
 */

import type { Ref } from 'preact'
import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import { ApiErrorState, MalformedState } from '../graph/graph-states'
import { ProjectionShapeError } from '../graph/projection-guards'
import { CardActions } from './card-actions'
import { CardMetadata } from './card-metadata'
import { CardAnalysis } from './card-reading'
import { type CardStage, cardStageLabel } from './card-stage'
import { ClassificationTags } from './classification-tags'
import type { CardPreview, CardReading } from './deck-model'

/**
 * A cover image with the provenance SPEC §7.5 requires: descriptive alt text,
 * and an attribution line where one exists.
 *
 * Recognition imagery is not a Source or an Evidence item merely because it is
 * on the Cover, so this is a presentation-only descriptor — it is never fed
 * into the provenance/evidence model.
 */
export type CardCoverImage = {
  readonly src: string
  readonly alt: string
  /** Source/rights/attribution line, when one has been recorded. */
  readonly attribution?: string | null
}

/** Props for {@link FeaturedCard}. */
export type FeaturedCardProps = {
  readonly card: CardListingRow
  /** The composed identity label, e.g. `Card / ID-07`. */
  readonly idLabel: string
  /** Projection-derived preview, or `null` while the projection loads. */
  readonly preview: CardPreview | null
  /** Projection-derived reading, or `null` while the projection loads. */
  readonly reading: CardReading | null
  /** Which of the three §7 faces is on screen (front reads as `cover`). */
  readonly stage: CardStage
  /** Flips the card to its back at the Claim face (the `Read front & back`). */
  readonly onExamine: () => void
  /** Opens the Analysis face from the Claim face. */
  readonly onReadAnalysis: () => void
  /** Returns from the Analysis face to the Claim face. */
  readonly onBackToClaim: () => void
  /** Flipping back to the front — closes the card back to deck browsing. */
  readonly onClose: () => void
  /**
   * An optional, rights-cleared cover image. When absent, or when its alt text
   * is missing, the deliberate typographic fallback renders instead — a
   * missing image never changes the card's canonical identity (SPEC §7.1).
   */
  readonly coverImage?: CardCoverImage | null
  /**
   * The projection query's rejection, or `null` when it has not rejected.
   *
   * The listing still has the card's title, summary and classification, so
   * those stay on screen and the *derived* half of the card — preview,
   * evidence, reading — is replaced by one error state rather than left to
   * render dashes that read as "still loading".
   */
  readonly projectionError?: unknown | null
  /** The card element, so the page can move focus on a stage transition. */
  readonly articleRef?: Ref<HTMLElement>
  /**
   * Whether the viewer is signed in, threaded through to the action row. Read
   * by the owning page (which can hold hooks) rather than here, because the
   * deck tests invoke these presentational components as plain functions.
   */
  readonly isSignedIn?: boolean
}

/**
 * A cover image that satisfies the guardrails, or `null` to fall back.
 *
 * @param image The candidate image, if any.
 * @returns The image when it is usable, otherwise `null`.
 */
function usableCoverImage(
  image: CardCoverImage | null | undefined,
): CardCoverImage | null {
  if (image === null || image === undefined) return null
  if (image.src.length === 0) return null
  // No descriptive alt text → an informative image would be unreadable and a
  // decorative one dishonest, so the honest fallback renders instead.
  if (image.alt.trim().length === 0) return null
  return image
}

/**
 * The two failure shapes the graph layer distinguishes (malformed vs. failed),
 * kept apart rather than both landing on a generic "Network error".
 *
 * @param props The rejection to display.
 * @returns The matching error state.
 */
function ProjectionFailure({ error }: { error: unknown }) {
  return error instanceof ProjectionShapeError ? (
    <MalformedState error={error} />
  ) : (
    <ApiErrorState error={error} />
  )
}

/** Cover — recognition and discovery, the card's front (SPEC §7.1). */
function CardCover({
  card,
  idLabel,
  coverImage,
}: {
  card: CardListingRow
  idLabel: string
  coverImage: CardCoverImage | null | undefined
}) {
  const image = usableCoverImage(coverImage)
  // A short folio for the designed fallback band, e.g. `ID-07` from
  // `Card / ID-07`, so the graphic reads as the card's own mark.
  const folio = idLabel.includes('/')
    ? idLabel.slice(idLabel.lastIndexOf('/') + 1).trim()
    : idLabel
  return (
    <div data-testid="card-cover">
      {image === null ? (
        <div
          data-testid="card-cover-fallback"
          aria-hidden="true"
          className="deck-cover-grid relative flex min-h-[7rem] items-end overflow-hidden rounded-xl border border-graph-border bg-graph-surface p-4"
        >
          <span
            data-testid="card-cover-folio"
            className="rounded-md border border-graph-border/70 bg-graph-muted/40 px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            {folio}
          </span>
          <span className="absolute right-4 top-3 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-muted-foreground/60">
            Research card
          </span>
          <span className="pointer-events-none absolute -bottom-8 -right-5 select-none font-mono text-[6.5rem] font-bold leading-none tracking-tighter text-graph-border/50">
            {folio.slice(0, 2)}
          </span>
        </div>
      ) : (
        <figure
          data-testid="card-cover-image"
          className="overflow-hidden rounded-xl border border-graph-border"
        >
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            className="h-48 w-full object-cover"
          />
          {image.attribution ? (
            <figcaption className="border-t border-graph-border bg-graph-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              {image.attribution}
            </figcaption>
          ) : null}
        </figure>
      )}
      <p
        data-testid="card-cover-id"
        className="mt-3 text-xs font-medium tracking-wide text-muted-foreground"
      >
        {idLabel}
      </p>
      <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight text-foreground">
        {card.title}
      </h2>
    </div>
  )
}

/** Claim — what is being asserted (SPEC §7.2). */
function CardClaim({
  card,
  idLabel,
  failed,
  projectionError,
}: {
  card: CardListingRow
  idLabel: string
  failed: boolean
  projectionError: unknown
}) {
  // The claim formulation prefers the authored core question; the summary is
  // the research framing. When it would duplicate the claim, framing is
  // omitted rather than repeated.
  const coreQuestion = card.coreQuestion?.trim()
  const summary = card.summary?.trim()
  const claim =
    coreQuestion && coreQuestion.length > 0
      ? coreQuestion
      : summary && summary.length > 0
        ? summary
        : 'No claim formulation recorded for this card.'
  const framing =
    summary !== undefined && summary.length > 0 && summary !== claim
      ? summary
      : null

  return (
    <div data-testid="card-claim">
      <CardMetadata idLabel={idLabel} status={card.epistemicStatus} />

      <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight text-foreground">
        {card.title}
      </h2>

      <section aria-label="What is asserted" className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What is asserted
        </h3>
        <p className="mt-1.5 max-w-prose break-words text-lg leading-relaxed text-foreground">
          {claim}
        </p>
      </section>

      <ClassificationTags classification={card.classification} />

      {framing !== null ? (
        <section aria-label="Research framing" className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Research framing
          </h3>
          <p className="mt-1.5 max-w-prose break-words text-sm leading-relaxed text-muted-foreground">
            {framing}
          </p>
        </section>
      ) : null}

      {failed ? (
        <div className="mt-4">
          <ProjectionFailure error={projectionError} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Open the analysis for the narrative, provenance, reasoning, and
          evidence.
        </p>
      )}
    </div>
  )
}

/**
 * The featured card panel — one card, two faces (SPEC §7.4).
 *
 * @param props See {@link FeaturedCardProps}.
 * @returns An `<article>` showing the card's front (Cover) or its back
 * (Claim then Analysis), with the action row always visible beneath.
 */
export function FeaturedCard({
  card,
  idLabel,
  preview,
  reading,
  stage,
  onExamine,
  onReadAnalysis,
  onBackToClaim,
  onClose,
  coverImage = null,
  projectionError = null,
  articleRef,
  isSignedIn = false,
}: FeaturedCardProps) {
  const failed = projectionError !== null
  // The flip is presentation-only: any face other than the Cover is the card's
  // back. `data-flipped` drives the CSS transform (or the stateful swap).
  const flipped = stage !== 'cover'
  return (
    <article
      ref={articleRef}
      tabIndex={-1}
      data-testid="featured-card"
      data-slug={card.slug}
      data-stage={stage}
      className="scroll-mt-24 rounded-2xl border border-graph-border bg-card p-5 shadow-sm focus:outline-none sm:p-6"
    >
      {/*
        Issue #14: the three faces are reachable by controls, so their names
        must reach assistive technology too — `data-stage` is a test hook, and
        an unexplained flip leaves a screen reader between faces. Announced as
        text (not a live region): every transition is a button activation the
        reader initiates, and the buttons themselves say what they open.
      */}
      <p className="sr-only" data-testid="card-face-announcement">
        Current face: {cardStageLabel(stage)}. Faces: Cover, Claim, Analysis.
      </p>
      <div className="deck-card-scene">
        <div
          data-testid="card-flip-stage"
          data-flipped={flipped ? 'true' : 'false'}
          className="deck-card-stage"
        >
          <div
            data-testid="card-face-front"
            // The front face is inert whenever the card shows its back.
            inert={flipped || undefined}
            aria-hidden={flipped ? 'true' : undefined}
            className="deck-card-face deck-card-face--front"
          >
            {stage === 'cover' ? (
              <CardCover
                card={card}
                idLabel={idLabel}
                coverImage={coverImage}
              />
            ) : null}
          </div>

          <div
            data-testid="card-face-back"
            // The back face is inert while the card shows its front.
            inert={!flipped || undefined}
            aria-hidden={!flipped ? 'true' : undefined}
            className="deck-card-face deck-card-face--back"
          >
            {stage === 'claim' ? (
              <CardClaim
                card={card}
                idLabel={idLabel}
                failed={failed}
                projectionError={projectionError}
              />
            ) : null}

            {stage === 'analysis' ? (
              failed ? (
                <ProjectionFailure error={projectionError} />
              ) : (
                <CardAnalysis
                  reading={reading}
                  preview={preview}
                  narrative={card.editorialNotes ?? null}
                />
              )
            ) : null}
          </div>
        </div>
      </div>

      <CardActions
        stage={stage}
        slug={card.slug}
        readingAvailable={!failed}
        onExamine={onExamine}
        onReadAnalysis={onReadAnalysis}
        onBackToClaim={onBackToClaim}
        onClose={onClose}
        isSignedIn={isSignedIn}
      />
    </article>
  )
}
