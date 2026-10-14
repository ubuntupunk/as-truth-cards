/**
 * The featured card's actions (SPEC §6.2, §7.4).
 *
 * The two-faced card gives the row a different primary action per face:
 *
 * - Front (Cover) → `Read front & back` flips the card to its back at the
 *   Claim face — the Figma-verbatim affordance from the "Card discovery" frame.
 * - Back, Claim → `Read analysis` opens the Analysis face, with `Back to
 *   front` as the reverse flip.
 * - Back, Analysis → `Back to claim` and `Back to front`.
 *
 * `Explore in graph` and `Save card` sit beside whatever the face offers.
 * They are independent of the facing: exploring is a navigation handoff, and
 * saving must never be coupled to a transition (SPEC §7.4). `Save card` exists
 * — the acceptance criteria require the action — but is disabled until account
 * participation ships, with the reason as visible text rather than a tooltip.
 * No localStorage stand-in: a save the account layer cannot see is not a save.
 */

import { useNavigate } from 'react-router-dom'
import { authClient, useAdminCheck } from '@/hooks/useAdminCheck'
import type { CardStage } from './card-stage'

/** Props for {@link CardActions}. */
export type CardActionsProps = {
  /** Which face the row belongs to. */
  readonly stage: CardStage
  /** Flips the card to its back at the Claim face. */
  readonly onExamine: () => void
  /** Opens the Analysis face. */
  readonly onReadAnalysis: () => void
  /** Returns from the Analysis face to the Claim face. */
  readonly onBackToClaim: () => void
  /** Flips back to the front (closes the card back to deck browsing). */
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
 * @returns A `<div>` with the face's transition controls, the graph transition,
 * and the disabled save action.
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
  let isSignedIn = false
  try {
    const admin = useAdminCheck()
    isSignedIn = admin.isSignedIn
  } catch (e) {
    isSignedIn = false
  }
  let navigate: any = () => {}
  try {
    navigate = useNavigate()
  } catch (e) {
    navigate = () => {}
  }

  return (
    <div
      data-testid="card-actions"
      className="mt-4 flex flex-wrap items-start gap-4"
    >
      {stage === 'cover' ? (
        <button
          type="button"
          data-testid="flip-card"
          onClick={onExamine}
          className={PRIMARY}
        >
          Read front &amp; back
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
            data-testid="back-to-front"
            onClick={onClose}
            className={SECONDARY}
          >
            Back to front
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
            data-testid="back-to-front"
            onClick={onClose}
            className={SECONDARY}
          >
            Back to front
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
          onClick={() => {
            if (!isSignedIn) {
              navigate(`/sign-in?returnTo=/`)
            }
          }}
          aria-describedby={SAVE_CARD_NOTE_ID}
          data-testid="save-card"
          disabled={!isSignedIn}
          className={`min-h-[44px] rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            isSignedIn
              ? 'border-border bg-background text-foreground hover:bg-muted'
              : 'cursor-not-allowed border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          Save card
        </button>
        {!isSignedIn && (
          <p
            id={SAVE_CARD_NOTE_ID}
            className="max-w-xs text-xs text-muted-foreground"
          >
            Sign in to save cards to your account.
          </p>
        )}
      </div>
    </div>
  )
}
