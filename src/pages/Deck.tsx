/**
 * The Decks page — SPEC §3.3's card-discovery composition in order:
 * scope badges → featured card (+ navigation) → discovery prompt.
 *
 * Orchestration only, deliberately small, in the shape `pages/Graph.tsx`
 * already set: every semantic arrives pre-derived (`deck-model.ts`), every
 * request goes through the shared guarded fetch layer (`use-deck.ts`,
 * `use-graph.ts`), and this file only decides which state is on screen.
 *
 * State order (each case short-circuits the ones after it):
 *
 * 1. Listing in flight → {@link LoadingState}.
 * 2. Listing rejected → {@link ApiErrorState}.
 * 3. Server returned zero cards → an empty deck (a fact, not a failure).
 * 4. Scope matches nothing → a scoped-empty state with a way out.
 * 5. Otherwise → scope badges, {@link CardDiscovery}, {@link DiscoveryPrompt}.
 *
 * The featured card's projection is fetched *for the current card only*
 * (`focus=slug`, at a depth deep enough for provenance to be in the payload),
 * so moving through the deck reuses the same query key machinery the Graph
 * page uses. A rejected projection keeps the card's listing-served regions on
 * screen and replaces only the derived ones with one error state — malformed
 * and failed responses are told apart, exactly as the Graph page tells them
 * apart, rather than both landing on a generic "Network error".
 */

import { useEffect, useMemo, useState } from 'preact/hooks'
import { useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { CardDiscovery } from '@/deck/card-discovery'
import {
  applyScope,
  availableAxes,
  availableStatuses,
  type DeckScope,
  deriveCardPreview,
  deriveCardReading,
  discoveryPrompt,
  NO_SCOPE,
} from '@/deck/deck-model'
import { DeckScopeBadges } from '@/deck/deck-scope'
import { DiscoveryPrompt } from '@/deck/discovery-prompt'
import {
  deckProjectionParams,
  useDeckCards,
  useDeckSession,
} from '@/deck/use-deck'
import { ApiErrorState, LoadingState } from '@/graph/graph-states'
import { useGraphProjection, useGraphViews } from '@/graph/use-graph'
import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import { DEFAULT_VIEW_NAME } from '../../trope-cards/src/graph/views.ts'

/** Stable identity for "no cards yet", so scope memos do not churn. */
const NO_CARDS: readonly CardListingRow[] = []

/** The listing's request, with no filters: a scope only selects what arrived. */
function isDeckEmpty(cards: readonly CardListingRow[]): boolean {
  return cards.length === 0
}

/** The identity label `Card / ID-XX`, padded from the card's deck position. */
function idLabelFor(position: number): string {
  return `Card / ID-${String(position + 1).padStart(2, '0')}`
}

/**
 * The Decks page.
 *
 * @returns The composed discovery screen (Header, scope, card, prompt, Footer).
 */
const Deck = () => {
  const cardsQuery = useDeckCards()
  const viewsQuery = useGraphViews()

  const [scope, setScope] = useState<DeckScope>(NO_SCOPE)
  // Which card's reading is open, rather than a boolean: a card change must
  // never leave the previous card's reading expanded under a new card.
  const [readingFor, setReadingFor] = useState<string | null>(null)

  // The deck is addressable: `/?focus=<slug>` (the handoff Explore makes) is
  // read once on mount — later URL writes are this page's own sync, never a
  // reason to re-jump — and only applied once cards exist to jump within.
  const [searchParams, setSearchParams] = useSearchParams()
  const [pendingFocus, setPendingFocus] = useState(() =>
    searchParams.get('focus'),
  )

  const cards = cardsQuery.data?.items ?? NO_CARDS
  const { axis, status } = scope
  const filters = useMemo(() => ({ ...NO_SCOPE, axis, status }), [axis, status])
  const scoped = useMemo(() => applyScope(cards, filters), [cards, filters])
  const { session, goPrevious, shuffle, jumpTo } = useDeckSession(scoped, scope)

  const featured = session.cards[session.position] ?? null
  const featuredId = featured?.id ?? null

  useEffect(() => {
    if (pendingFocus === null || scoped.length === 0) return
    jumpTo(pendingFocus)
    setPendingFocus(null)
  }, [pendingFocus, scoped, jumpTo])

  // The URL always names the card on screen, so a deep link survives reload
  // and shuffling leaves no lying address behind. Replaced, not pushed: deck
  // movement is not browser history.
  useEffect(() => {
    if (pendingFocus !== null) return
    const slug = featured?.slug
    if (slug === undefined) return
    if (searchParams.get('focus') === slug) return
    const next = new URLSearchParams(searchParams)
    next.set('focus', slug)
    setSearchParams(next, { replace: true })
  }, [pendingFocus, featured?.slug, searchParams, setSearchParams])

  // Safety net for the ordering above: if the deck empties under an open
  // reading, nothing is left open.
  useEffect(() => {
    if (featuredId === null) setReadingFor(null)
  }, [featuredId])

  const descriptor = useMemo(
    () =>
      viewsQuery.data?.views.find((view) => view.name === DEFAULT_VIEW_NAME) ??
      null,
    [viewsQuery.data],
  )
  // The catalogue's own failure is a *reason* the readouts can state, not a
  // missing value to render as dashes forever.
  const catalogueError = viewsQuery.isError
    ? viewsQuery.error instanceof Error
      ? viewsQuery.error.message
      : 'rejected'
    : null

  const projectionQuery = useGraphProjection(
    deckProjectionParams(featured?.slug ?? null, descriptor),
  )
  const projection = projectionQuery.data ?? null

  const preview =
    featured !== null && projection !== null
      ? deriveCardPreview(projection, descriptor, {
          cardId: featured.id,
          catalogueError,
        })
      : null
  const reading =
    featured !== null && projection !== null
      ? deriveCardReading(projection, featured.id)
      : null
  const promptModel = featured !== null ? discoveryPrompt(featured) : null

  const total = cardsQuery.data?.total ?? cards.length
  const served = cards.length

  let content: preact.ComponentChildren
  if (cardsQuery.isLoading) {
    content = <LoadingState labelled="Loading the deck…" />
  } else if (cardsQuery.isError) {
    content = <ApiErrorState error={cardsQuery.error} />
  } else if (isDeckEmpty(cards)) {
    content = (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <h2 className="text-xl font-semibold">No cards yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The graph returned an empty card listing. When cards are seeded, they
          appear here in listing order.
        </p>
      </div>
    )
  } else if (featured === null || promptModel === null) {
    content = (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <h2 className="text-xl font-semibold">No cards match this scope</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The deck holds {total} card{total === 1 ? '' : 's'}, but none carry
          the selected axis and research status at once.
        </p>
        <button
          type="button"
          onClick={() => setScope(NO_SCOPE)}
          className="mt-4 min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Clear scope
        </button>
      </div>
    )
  } else {
    content = (
      <>
        <DeckScopeBadges
          total={total}
          served={served}
          shown={scoped.length}
          scope={scope}
          axes={availableAxes(cards)}
          statuses={availableStatuses(cards)}
          onChange={setScope}
        />
        <CardDiscovery
          card={featured}
          idLabel={idLabelFor(session.position)}
          preview={preview}
          reading={reading}
          readingOpen={readingFor === featuredId}
          projectionError={projectionQuery.error}
          onToggleRead={() =>
            setReadingFor((current) =>
              current === featuredId ? null : featuredId,
            )
          }
          session={session}
          onPrevious={goPrevious}
          onShuffle={shuffle}
        />
        <DiscoveryPrompt model={promptModel} />
      </>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto w-full max-w-4xl xl:max-w-5xl">
          <nav
            data-testid="deck-context-bar"
            aria-label="Breadcrumb"
            className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span>Trope Cards</span>
            <span aria-hidden="true">·</span>
            <span>Research</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-foreground">Decks</span>
          </nav>

          <header className="mt-4" data-testid="deck-heading">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Research / Cards
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              Decks
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse research cards by axis and research status.
            </p>
          </header>

          <div className="mt-6 space-y-4">{content}</div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Deck
