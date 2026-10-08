/**
 * Deck data access and navigation state.
 *
 * Two concerns live here and nowhere else:
 *
 * - **The listing query.** One page of cards with their classification, from
 *   `GET /api/graph/cards`, guarded by the shared `assertCardListResponse`.
 *   The key is namespaced `['graph', …]` so it cannot collide with the admin
 *   CRUD `['cards']` key that a Prisma row and a graph row must never share.
 * - **The session.** Position, `seen` and the repeat policy are plain state
 *   over an already-scoped list; this hook only owns *when* they restart.
 *
 * The restart rule is the interesting part: an axis or status change restarts
 * the deck (the cards under the reader changed), while flipping the repeat
 * policy keeps the reader exactly where they were (the policy governs the
 * *next* shuffle, not the current card). That is expressed as one guarded
 * `useState` updater rather than two effects that could race.
 */

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'preact/hooks'
import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import { DEFAULT_VIEW_NAME } from '../../trope-cards/src/graph/views.ts'
import type { GraphViewDescriptor } from '../graph/projection-guards'
import {
  assertCardListResponse,
  type CardListResponse,
} from '../graph/projection-guards'
import type { GraphParams } from '../graph/query-params'
import { fetchValidated } from '../graph/use-graph'
import {
  type DeckScope,
  type DeckSession,
  deckProjectionDepth,
  jumpToCard,
  previousCard,
  reconcileSession,
  shuffleNextCard,
  startDeck,
} from './deck-model'

/** The page size the deck asks for; the server's `limit` ceiling is 200. */
export const DECK_CARDS_LIMIT = 200

/** React Query key for the deck listing (distinct from admin `['cards']`). */
export const DECK_CARDS_QUERY_KEY = [
  'graph',
  'cards',
  DECK_CARDS_LIMIT,
] as const

/**
 * The `useQuery` options for the deck listing.
 *
 * Extracted from the hook so the key, URL and guard are inspectable values a
 * test can assert without mounting a QueryClient.
 *
 * @returns Query options for one validated page of cards.
 */
export function deckCardsQueryOptions() {
  return {
    queryKey: DECK_CARDS_QUERY_KEY,
    queryFn: () =>
      fetchValidated(
        `/api/graph/cards?limit=${DECK_CARDS_LIMIT}`,
        assertCardListResponse,
      ),
    retry: false,
    staleTime: 60_000,
  }
}

/**
 * One validated page of cards.
 *
 * @returns A TanStack Query result whose `data` is a {@link CardListResponse}
 * once loaded.
 */
export function useDeckCards() {
  return useQuery<CardListResponse>(deckCardsQueryOptions())
}

/**
 * The projection request for the featured card.
 *
 * The deck pins the view the Graph page treats as canonical and asks deep
 * enough for attribution to actually be in the payload (see
 * `DECK_PROJECTION_DEPTH` — a shallower request would make every provenance
 * count a fabricated zero). The focus is the slug the listing served, so
 * entering the deck and entering the graph through `Explore in graph` address
 * the same card the same way.
 *
 * @param focus The featured card's slug, or `null` when no card is featured
 * (the query is then disabled by its own `enabled` gate).
 * @param descriptor The view descriptor once the catalogue has loaded, used to
 * clamp the depth to what the view can serve.
 * @returns Params for `useGraphProjection`.
 */
export function deckProjectionParams(
  focus: string | null,
  descriptor: GraphViewDescriptor | null,
): GraphParams {
  return {
    focus,
    view: DEFAULT_VIEW_NAME,
    depth: deckProjectionDepth(descriptor),
  }
}

/** The navigation surface {@link useDeckSession} hands to the page. */
export type DeckNavigation = {
  readonly session: DeckSession
  readonly goPrevious: () => void
  readonly shuffle: () => void
  /** Land on a card by slug (a deep link); no-op when the deck lacks it. */
  readonly jumpTo: (slug: string) => void
}

/**
 * Own the deck session for a scoped card list.
 *
 * @param scoped The cards after {@link applyScope}, in listing order.
 * @param scope The scope that produced them, including the repeat policy.
 * @returns The current session plus Previous/Shuffle/jumpTo handlers.
 */
export function useDeckSession(
  scoped: readonly CardListingRow[],
  scope: DeckScope,
): DeckNavigation {
  const [session, setSession] = useState<DeckSession>(() =>
    startDeck(scoped, scope),
  )

  useEffect(() => {
    setSession((current) => reconcileSession(current, scoped, scope))
  }, [scoped, scope])

  // Memoised because the page calls it from an effect that must not re-run on
  // every render; goPrevious/shuffle are plain props and need no such care.
  const jumpTo = useCallback(
    (slug: string) => setSession((current) => jumpToCard(current, slug)),
    [],
  )

  return {
    session,
    goPrevious: () => setSession((current) => previousCard(current)),
    shuffle: () =>
      setSession((current) => shuffleNextCard(current, Math.random)),
    jumpTo,
  }
}
