/**
 * The featured card's identity line: `Card / ID-XX` plus the research-status
 * badge (SPEC §6.2, first two items).
 *
 * The status is the one place the `epistemic_status` enum reaches the screen,
 * and it never reaches it raw: {@link cardStatusLabel} is the presentation
 * mapping (`OPEN · UNVERIFIED`, never the word `OPEN` on its own) and
 * {@link isUnverifiedStatus} picks the amber treatment. The badge always says
 * in text what the colour also says, because an unverified card that reads as
 * verified is the exact failure SPEC §10 forbids.
 */

import { cn } from '@/lib/utils'
import type { EpistemicStatusValue } from '../../trope-cards/src/graph/types.ts'
import { cardStatusLabel, isUnverifiedStatus } from './deck-status'

/** Props for {@link CardMetadata}. */
export type CardMetadataProps = {
  /** The composed identity label, e.g. `Card / ID-07`. */
  readonly idLabel: string
  readonly status: EpistemicStatusValue
}

/**
 * The card identity + status row.
 *
 * @param props See {@link CardMetadataProps}.
 * @returns A `<div>` with the id label and the status badge.
 */
export function CardMetadata({ idLabel, status }: CardMetadataProps) {
  const unverified = isUnverifiedStatus(status)
  return (
    <div
      data-testid="card-metadata"
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
    >
      <span data-testid="card-id-label" className="font-medium tracking-wide">
        {idLabel}
      </span>
      <span aria-hidden="true">·</span>
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
    </div>
  )
}
