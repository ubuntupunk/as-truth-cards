/**
 * The featured card's actions (SPEC §6.2, §7.4).
 *
 * The three-stage model gives the row a different primary action per stage:
 *
 * - Cover → `Examine card` opens the Claim face.
 * - Claim → `Read analysis` opens the Analysis face, with `Back to deck` to
 *   close the card.
 * - Analysis → `Back to claim` and `Back to deck` (close/back-to-discovery).
 *
 * `Explore in graph` and `Save card` sit beside whatever the stage offers.
 * They are independent of the stage: exploring is a navigation handoff, and
 * saving must never be coupled to a transition (SPEC §7.4). `Save card` exists
 * — the acceptance criteria require the action — but is disabled until account
 * participation ships, with the reason as visible text rather than a tooltip.
 * No localStorage stand-in: a save the account layer cannot see is not a save.
 */

import type { CardStage } from './card-stage'

/** Props for {@link CardActions}. */
export type CardActionsProps = {
  /** Which face the row belongs to. */
  readonly stage: CardStage
  /** Opens the Claim face. */
  readonly onExamine: () => void
  /** Opens the Analysis face. */
  readonly onReadAnalysis: () => void
  /** Returns from the Analysis face to the Claim face. */
  readonly onBackToClaim: () => void
  /** Closes the card back to deck browsing. */
  readonly onClose: () => void
  /**
   * The featured card's slug, so the row can offer the transition into graph
   * exploration (ROADMAP Phase A: card detail must reach the graph without a
   * second data model — the same focus param the Graph page already reads).
   */
  readonly slug: string
  /**
   * Whether the analysis is available: it is derived from the card's
   * projection, so while that request has failed `Read analysis` is omitted
   * rather than left to open into nothing.
   */
  readonly readingAvailable?: boolean
}

/** The save note id, referenced by the disabled button via `aria-describedby`. */
const SAVE_CARD_NOTE_ID = 'save-card-note'

const PRIMARY =
  'min-h-[44px] rounded-lg border border-transparent bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90'
const SECONDARY =
  'min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted'

/**
 * The action row under the card's current face.
 *
 * @param props See {@link CardActionsProps}.
 * @returns A `<div>` with the stage's transition controls, the graph
 * transition, and the disabled save action.
 */
export function CardActions({
  stage,
  onExamine,
  onReadAnalysis,
  onBackToClaim,
  onClose,
  slug,
  readingAvailable = true,
}: CardActionsProps) {
  return (
    <div
      data-testid="card-actions"
      className="mt-4 flex flex-wrap items-start gap-4"
    >
      {stage === 'cover' ? (
        <button
          type="button"
          data-testid="examine-card"
          onClick={onExamine}
          className={PRIMARY}
        >
          Examine card
        </button>
      ) : null}

      {stage === 'claim' ? (
        <>
          {readingAvailable ? (
            <button
              type="button"
              data-testid="read-analysis"
              onClick={onReadAnalysis}
              className={PRIMARY}
            >
              Read analysis
            </button>
          ) : null}
          <button
            type="button"
            data-testid="close-card"
            onClick={onClose}
            className={SECONDARY}
          >
            Back to deck
          </button>
        </>
      ) : null}

      {stage === 'analysis' ? (
        <>
          <button
            type="button"
            data-testid="back-to-claim"
            onClick={onBackToClaim}
            className={SECONDARY}
          >
            Back to claim
          </button>
          <button
            type="button"
            data-testid="close-card"
            onClick={onClose}
            className={SECONDARY}
          >
            Back to deck
          </button>
        </>
      ) : null}

      <a
        href={`/graph?focus=${encodeURIComponent(slug)}`}
        data-testid="explore-in-graph"
        className={`${SECONDARY} inline-flex items-center`}
      >
        Explore in graph
      </a>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled
          aria-describedby={SAVE_CARD_NOTE_ID}
          data-testid="save-card"
          className="min-h-[44px] cursor-not-allowed rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-muted-foreground"
        >
          Save card
        </button>
        <p
          id={SAVE_CARD_NOTE_ID}
          className="max-w-xs text-xs text-muted-foreground"
        >
          Saving cards will be available when account participation is enabled.
        </p>
      </div>
    </div>
  )
}
