/**
 * The featured card plus its navigation — SPEC §3.3's items 2 and 3, the
 * middle of the discovery composition (`DeckScope` → this → `DiscoveryPrompt`).
 *
 * It composes rather than computes: the card panel renders its regions, the
 * navigation row renders position and controls, and all the semantics
 * (position, scope, preview, reading) arrive already derived from
 * `deck-model.ts` and `use-deck.ts`.
 */

import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import { CardNavigation } from './card-navigation'
import type { CardPreview, CardReading, DeckSession } from './deck-model'
import { FeaturedCard } from './featured-card'

/** Props for {@link CardDiscovery}. */
export type CardDiscoveryProps = {
  readonly card: CardListingRow
  readonly idLabel: string
  readonly preview: CardPreview | null
  readonly reading: CardReading | null
  readonly readingOpen: boolean
  readonly onToggleRead: () => void
  readonly session: DeckSession
  readonly onPrevious: () => void
  readonly onShuffle: () => void
  /** Projection rejection, surfaced in place of the card's derived regions. */
  readonly projectionError?: unknown | null
}

/**
 * The featured card and the Previous / position / Shuffle row.
 *
 * @param props See {@link CardDiscoveryProps}.
 * @returns A `<div>` with the card panel above the navigation row.
 */
export function CardDiscovery({
  card,
  idLabel,
  preview,
  reading,
  readingOpen,
  onToggleRead,
  session,
  onPrevious,
  onShuffle,
  projectionError = null,
}: CardDiscoveryProps) {
  return (
    <div data-testid="card-discovery" className="space-y-4">
      <FeaturedCard
        card={card}
        idLabel={idLabel}
        preview={preview}
        reading={reading}
        readingOpen={readingOpen}
        onToggleRead={onToggleRead}
        projectionError={projectionError}
      />
      <CardNavigation
        session={session}
        onPrevious={onPrevious}
        onShuffle={onShuffle}
      />
    </div>
  )
}
