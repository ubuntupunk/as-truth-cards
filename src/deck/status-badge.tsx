/**
 * The research-status badge (SPEC §6.2, §10) — the one place
 * `epistemic_status` reaches the screen as a badge.
 *
 * It never reaches it raw: {@link cardStatusLabel} is the presentation mapping
 * (`OPEN · UNVERIFIED`, never the word `OPEN` on its own) and
 * {@link isUnverifiedStatus} picks the amber treatment. The badge always says
 * in text what the colour also says, because an unverified card that reads as
 * verified is the exact failure SPEC §10 forbids.
 *
 * Extracted from the identity line so a second surface (the Explore result
 * list) can show the same badge without borrowing the Deck's position-derived
 * `Card / ID-XX` label — the label stays where it is meaningful, the badge
 * travels.
 */

import { cn } from '@/lib/utils'
import type { EpistemicStatusValue } from '../../trope-cards/src/graph/types.ts'
import { cardStatusLabel, isUnverifiedStatus } from './deck-status'

/** Props for {@link StatusBadge}. */
export type StatusBadgeProps = {
  readonly status: EpistemicStatusValue
}

/**
 * One card's research-status badge.
 *
 * @param props See {@link StatusBadgeProps}.
 * @returns A `<span>` carrying the status as text plus its treatment.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const unverified = isUnverifiedStatus(status)
  return (
    <span
      data-testid="card-status-badge"
      data-status={status}
      data-unverified={unverified ? 'true' : undefined}
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        unverified
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {cardStatusLabel(status)}
    </span>
  )
}
