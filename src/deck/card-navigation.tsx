/**
 * Previous / position / Shuffle next (SPEC §6.3).
 *
 * The position indicator is both things the spec asks for: the literal
 * `n / total` (readable by a screen reader through the progress bar's own
 * labels) and a visual progress marker behind it. `Previous` wraps at the
 * start rather than disabling, because a deck is cyclic and a dead button at
 * position 1 is worse than stepping back to the last card; `Shuffle next`
 * disables only when there is genuinely nothing to shuffle to (one card).
 */

import { ChevronLeft, Shuffle } from 'lucide-react'
import { type DeckSession, positionLabel, positionRatio } from './deck-model'

/** Props for {@link CardNavigation}. */
export type CardNavigationProps = {
  readonly session: DeckSession
  readonly onPrevious: () => void
  readonly onShuffle: () => void
}

/** The shared button shell: 44px target, full label, no icon-only controls. */
const BUTTON =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'

/**
 * The navigation row under the featured card.
 *
 * @param props See {@link CardNavigationProps}.
 * @returns A `<nav>` with Previous, the position indicator, and Shuffle next.
 */
export function CardNavigation({
  session,
  onPrevious,
  onShuffle,
}: CardNavigationProps) {
  const total = session.cards.length
  const ratio = Math.round(positionRatio(session) * 100)
  return (
    <nav
      data-testid="card-navigation"
      aria-label="Card navigation"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={total === 0}
        className={BUTTON}
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Previous
      </button>

      <div className="flex min-w-[180px] flex-1 flex-col items-center gap-1.5">
        <span
          data-testid="position-label"
          className="text-sm font-medium tabular-nums text-foreground"
        >
          {positionLabel(session)}
        </span>
        <div
          role="progressbar"
          aria-label="Deck progress"
          aria-valuemin={0}
          aria-valuemax={Math.max(total, 1)}
          aria-valuenow={total === 0 ? 0 : session.position + 1}
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${ratio}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onShuffle}
        disabled={total <= 1}
        className={BUTTON}
        data-testid="shuffle-next"
      >
        <Shuffle aria-hidden="true" className="h-4 w-4" />
        Shuffle next
      </button>
    </nav>
  )
}
