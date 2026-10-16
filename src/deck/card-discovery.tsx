/**
 * The featured card plus its navigation — SPEC §3.3's items 2 and 3, the
 * middle of the discovery composition (`DeckScope` → this → `DiscoveryPrompt`).
 *
 * It composes rather than computes: the card panel renders its regions and
 * stage, the navigation row renders position and controls, and all the
 * semantics (position, scope, preview, reading, stage) arrive already derived
 * from `deck-model.ts`, `card-stage.ts` and `use-deck.ts`.
 */

import type { Ref } from 'preact'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import { CardNavigation } from './card-navigation'
import type { CardStage } from './card-stage'
import type { CardPreview, CardReading, DeckSession } from './deck-model'
import { type CardCoverImage, FeaturedCard } from './featured-card'

/** Props for {@link CardDiscovery}. */
export type CardDiscoveryProps = {
  readonly card: CardListingRow
  readonly idLabel: string
  readonly preview: CardPreview | null
  readonly reading: CardReading | null
  /** Which of the three SPEC §7 faces is on screen. */
  readonly stage: CardStage
  readonly onExamine: () => void
  readonly onReadAnalysis: () => void
  readonly onBackToClaim: () => void
  readonly onClose: () => void
  readonly session: DeckSession
  readonly onPrevious: () => void
  readonly onShuffle: () => void
  /** Optional rights-cleared cover image; a fallback renders when absent. */
  readonly coverImage?: CardCoverImage | null
  /** Projection rejection, surfaced in place of the card's derived regions. */
  readonly projectionError?: unknown | null
  /** The card element, so the page can move focus on a stage transition. */
  readonly articleRef?: Ref<HTMLElement>
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
  stage,
  onExamine,
  onReadAnalysis,
  onBackToClaim,
  onClose,
  session,
  onPrevious,
  onShuffle,
  coverImage = null,
  projectionError = null,
  articleRef,
}: CardDiscoveryProps) {
  // This is the owning page-level composition (rendered only by `Deck.tsx`), so
  // it holds the session hook and threads the result down: the card tree below
  // is presentational and must stay hook-free for the SSR/vnode test harness.
  const { isSignedIn } = useAdminCheck()

  return (
    <div data-testid="card-discovery" className="space-y-4">
      <FeaturedCard
        isSignedIn={isSignedIn}
        card={card}
        idLabel={idLabel}
        preview={preview}
        reading={reading}
        stage={stage}
        onExamine={onExamine}
        onReadAnalysis={onReadAnalysis}
        onBackToClaim={onBackToClaim}
        onClose={onClose}
        coverImage={coverImage}
        projectionError={projectionError}
        articleRef={articleRef}
      />
      <CardNavigation
        session={session}
        onPrevious={onPrevious}
        onShuffle={onShuffle}
      />
    </div>
  )
}
