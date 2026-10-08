/**
 * The featured card's identity line: `Card / ID-XX` plus the research-status
 * badge (SPEC §6.2, first two items).
 *
 * The id label is position-derived and belongs to the deck alone; the status
 * badge itself lives in `status-badge.tsx` so other surfaces can show the same
 * mapping without inventing a position.
 */

import type { EpistemicStatusValue } from '../../trope-cards/src/graph/types.ts'
import { StatusBadge } from './status-badge'

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
  return (
    <div
      data-testid="card-metadata"
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
    >
      <span data-testid="card-id-label" className="font-medium tracking-wide">
        {idLabel}
      </span>
      <span aria-hidden="true">·</span>
      <StatusBadge status={status} />
    </div>
  )
}
