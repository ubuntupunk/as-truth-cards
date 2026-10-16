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

import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { ResearchDisclaimer } from '@/components/ResearchDisclaimer'
import { BrowseRail } from '@/deck/browse-rail'
import { CardDiscovery } from '@/deck/card-discovery'
import { type CardStage, DEFAULT_CARD_STAGE } from '@/deck/card-stage'
import {
  DECK_TREATMENT_QUERY_KEY,
  parseDeckTreatment,
} from '@/deck/deck-appearance'
import { DeckAppearanceControl } from '@/deck/deck-appearance-control'
import {
  applyScope,
  availableAxes,
  availableLocales,
  availableStatuses,
  type DeckScope,
  deriveCardPreview,
  deriveCardReading,
  discoveryPrompt,
  NO_SCOPE,
} from '@/deck/deck-model'
import { DeckScopeBadges } from '@/deck/deck-scope'
import { type DeckDrawerKind, DeckWorkspace } from '@/deck/deck-workspace'
import { DiscoveryPrompt } from '@/deck/discovery-prompt'
import { inertBackground, trapTab } from '@/deck/drawer-a11y'
import { ResearchTray } from '@/deck/research-tray'
import { suiteEntryFromCard, suiteHandoff } from '@/deck/suite-session'
import { SuiteTray } from '@/deck/suite-tray'
import {
  deckProjectionParams,
  useDeckCards,
  useDeckSession,
} from '@/deck/use-deck'
import { useSuiteSession } from '@/deck/use-suite-session'
import {
  GRAPH_TREATMENT_STORAGE_KEY,
  type GraphTreatment,
  graphTreatmentVars,
} from '@/graph/appearance'
import { ApiErrorState, LoadingState } from '@/graph/graph-states'
import { EMPTY_GRAPH_PARAMS, serializeGraphParams } from '@/graph/query-params'
import { useGraphProjection, useGraphViews } from '@/graph/use-graph'
import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import { DEFAULT_VIEW_NAME } from '../../trope-cards/src/graph/views.ts'
import {
  entryFromNode,
  entryToGraphParams,
  type ResearchEntry,
} from '../research/research-session'
import { useResearchSession } from '../research/use-research-session'

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

/** The appearance storage reader, or `null` when unavailable. */
function deckStorage(): Pick<Storage, 'getItem'> | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
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
  // Which card's stage is open, rather than a bare boolean: a card change must
  // never leave the previous card's Analysis face under a new card, so the
  // open stage is scoped to the card id it belongs to. Deck browsing shows the
  // Cover, so `null` (or another card's id) reads as `cover`.
  const [openStage, setOpenStage] = useState<{
    readonly id: string
    readonly stage: CardStage
  } | null>(null)
  // The card element, so opening a face can move focus to the card the reader
  // just transitioned within (SPEC §10: predictable focus).
  const cardRef = useRef<HTMLElement>(null)

  // The deck is addressable: `/?focus=<slug>` (the handoff Explore makes) is
  // read once on mount — later URL writes are this page's own sync, never a
  // reason to re-jump — and only applied once cards exist to jump within.
  const [searchParams, setSearchParams] = useSearchParams()
  const [pendingFocus, setPendingFocus] = useState(() =>
    searchParams.get('focus'),
  )

  const cards = cardsQuery.data?.items ?? NO_CARDS
  const { axis, status, locale } = scope
  const filters = useMemo(
    () => ({ ...NO_SCOPE, axis, status, locale }),
    [axis, status, locale],
  )
  const scoped = useMemo(() => applyScope(cards, filters), [cards, filters])
  const { session, goPrevious, shuffle, jumpTo } = useDeckSession(scoped, scope)

  const featured = session.cards[session.position] ?? null
  const featuredId = featured?.id ?? null

  // The stage on screen: the open stage when it belongs to the featured card,
  // otherwise the Cover. Derived rather than stored so a card change cannot
  // strand a face open over a different card.
  const stage: CardStage =
    openStage !== null && openStage.id === featuredId
      ? openStage.stage
      : DEFAULT_CARD_STAGE

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
    if (featuredId === null) setOpenStage(null)
  }, [featuredId])

  // Opening a face moves focus to the card the reader transitioned within, so
  // the new face's controls are reachable without a scroll-hunt. Closing back
  // to the Cover is a return to browsing and leaves focus alone.
  useEffect(() => {
    if (stage === DEFAULT_CARD_STAGE) return
    cardRef.current?.focus()
  }, [stage])

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

  /** Open a face for the featured card, scoped to its id. */
  const showStage = (next: CardStage) => {
    if (featuredId === null) return
    setOpenStage({ id: featuredId, stage: next })
  }

  // The page owns the appearance decision (SPEC §4.5): the URL is canonical —
  // a shared `?treatment=` link reproduces the treatment exactly — and the
  // stored choice is only the default when no parameter names one. Changing it
  // rewrites the parameter (preserving any `?focus=` handoff) and remembers it.
  const treatment = useMemo(
    () =>
      parseDeckTreatment(
        searchParams.get(DECK_TREATMENT_QUERY_KEY),
        deckStorage(),
      ),
    [searchParams],
  )
  const setTreatment = (next: GraphTreatment) => {
    const params = new URLSearchParams(searchParams)
    params.set(DECK_TREATMENT_QUERY_KEY, next)
    setSearchParams(params, { replace: true })
    try {
      localStorage.setItem(GRAPH_TREATMENT_STORAGE_KEY, next)
    } catch {
      // Storage unavailable — the URL keeps the state shareable on its own.
    }
  }

  // The workspace rails collapse to drawers below `xl`; the page owns which
  // (if any) is open so Escape drains exactly one modal.
  const [drawer, setDrawer] = useState<DeckDrawerKind | null>(null)
  const invokerRef = useRef<HTMLElement | null>(null)
  const navigate = useNavigate()

  // Drawer keyboard + focus (SPEC §4.7): opening traps focus inside the dialog,
  // makes the rest of the page inert (so neither Tab nor pointer reaches the
  // background), and moves focus to Close; dismissing with Escape, the
  // backdrop, or Close returns focus to the control that opened the drawer.
  useEffect(() => {
    if (drawer === null) return
    const layer = document.querySelector<HTMLElement>(
      '[data-testid="deck-drawer-layer"]',
    )
    const dialog = document.querySelector<HTMLElement>(
      `[data-testid="deck-drawer-${drawer}"]`,
    )
    const restoreInert = layer ? inertBackground(layer) : () => {}
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawer(null)
        return
      }
      if (dialog) trapTab(dialog, event)
    }
    window.addEventListener('keydown', onKeyDown)
    window.requestAnimationFrame(() => {
      dialog
        ?.querySelector<HTMLElement>('[data-testid="deck-drawer-close"]')
        ?.focus()
    })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      restoreInert()
      invokerRef.current?.focus?.()
    }
  }, [drawer])

  // The tray is the browser-local research session (SPEC §4.4): adding a card
  // is a working-memory action, and opening an entry hands off to `/research`
  // with the same items, because both surfaces read the same storage key.
  const tray = useResearchSession()
  const trayFocus =
    featured !== null ? { id: featured.id, label: featured.title } : null
  const addToTray = () => {
    if (featured === null) return
    tray.add(
      entryFromNode(
        { id: featured.id, type: 'card', label: featured.title },
        EMPTY_GRAPH_PARAMS,
      ),
    )
  }
  const openTrayEntry = (entry: ResearchEntry) => {
    navigate(`/research?${serializeGraphParams(entryToGraphParams(entry))}`)
  }

  // The draft suite is the curator's hand-assembly surface (g2f): a browser-
  // local roster of the cards a human picked, whose only hand-off is an export.
  // It never writes — the durable home of a Suite is a `collections` row, and
  // assigning one stays an explicit, human decision.
  const suite = useSuiteSession()
  const suiteFocus =
    featured !== null ? { id: featured.id, label: featured.title } : null
  const addToSuite = () => {
    if (featured === null) return
    suite.add(suiteEntryFromCard(featured))
  }
  const [suiteExportState, setSuiteExportState] = useState<
    'idle' | 'copied' | 'failed'
  >('idle')
  const exportSuite = async () => {
    if (suite.entries.length === 0) return
    try {
      await navigator.clipboard.writeText(suiteHandoff(suite.entries))
      setSuiteExportState('copied')
    } catch {
      setSuiteExportState('failed')
    }
  }

  let content: preact.ComponentChildren
  if (cardsQuery.isLoading) {
    content = <LoadingState labelled="Loading the deck…" />
  } else if (cardsQuery.isError) {
    content = <ApiErrorState error={cardsQuery.error} />
  } else if (isDeckEmpty(cards)) {
    content = (
      <div className="rounded-xl border border-dashed border-graph-border p-10 text-center">
        <h2 className="text-xl font-semibold">No cards yet</h2>
        <p className="mt-2 text-sm text-graph-muted-foreground">
          The graph returned an empty card listing. When cards are seeded, they
          appear here in listing order.
        </p>
      </div>
    )
  } else if (featured === null || promptModel === null) {
    content = (
      <div className="rounded-xl border border-dashed border-graph-border p-10 text-center">
        <h2 className="text-xl font-semibold">No cards match this scope</h2>
        <p className="mt-2 text-sm text-graph-muted-foreground">
          The deck holds {total} card{total === 1 ? '' : 's'}, but none carry
          the selected axis and research status at once.
        </p>
        <button
          type="button"
          onClick={() => setScope(NO_SCOPE)}
          className="mt-4 min-h-[44px] rounded-lg border border-graph-border bg-graph-surface px-4 py-2.5 text-sm font-medium hover:bg-graph-muted"
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
          locales={availableLocales(cards)}
          onChange={setScope}
        />
        <CardDiscovery
          card={featured}
          idLabel={idLabelFor(session.position)}
          preview={preview}
          reading={reading}
          stage={stage}
          projectionError={projectionQuery.error}
          onExamine={() => showStage('claim')}
          onReadAnalysis={() => showStage('analysis')}
          onBackToClaim={() => showStage('claim')}
          onClose={() => setOpenStage(null)}
          articleRef={cardRef}
          session={session}
          onPrevious={goPrevious}
          onShuffle={shuffle}
        />
        <DiscoveryPrompt model={promptModel} />
      </>
    )
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-graph-page"
      data-treatment={treatment}
      style={graphTreatmentVars(treatment)}
    >
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        {/* The graph chrome tokens zone the deck + Rails; the header and
            footer stay on the site stack because they sit outside it. */}
        <div
          className="mx-auto w-full max-w-4xl xl:max-w-7xl"
          style={{ fontFamily: 'var(--graph-font-family)' }}
        >
          <nav
            data-testid="deck-context-bar"
            aria-label="Breadcrumb"
            className="mt-6 flex items-center gap-2 text-xs text-graph-muted-foreground"
          >
            <span>Trope Cards</span>
            <span aria-hidden="true">·</span>
            <span>Research</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-foreground">Decks</span>
          </nav>

          <header
            data-testid="deck-heading"
            className="mt-4 flex items-end justify-between gap-4"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-graph-muted-foreground">
                Research / Cards
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                Decks
              </h1>
              <p className="mt-1 text-sm text-graph-muted-foreground">
                Browse research cards by axis and research status.
              </p>
            </div>
            <DeckAppearanceControl
              treatment={treatment}
              onChange={setTreatment}
            />
          </header>

          <ResearchDisclaimer className="mt-5 border-graph-disclaimer-border bg-graph-disclaimer text-graph-muted-foreground" />

          <DeckWorkspace
            drawer={drawer}
            onOpenDrawer={(kind) => {
              invokerRef.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null
              setDrawer(kind)
            }}
            onCloseDrawer={() => setDrawer(null)}
            browseRail={
              <BrowseRail
                axes={availableAxes(cards)}
                activeAxis={scope.axis}
                onChange={(axis) => setScope({ ...scope, axis })}
                locales={availableLocales(cards)}
                activeLocale={scope.locale}
                onLocaleChange={(locale) => setScope({ ...scope, locale })}
                graphHref="/graph"
              />
            }
            tray={
              <div className="space-y-4">
                <ResearchTray
                  entries={tray.entries}
                  focus={trayFocus}
                  onAdd={addToTray}
                  onOpen={openTrayEntry}
                  onRemove={tray.remove}
                  onClear={tray.clear}
                />
                <SuiteTray
                  entries={suite.entries}
                  focus={suiteFocus}
                  onAdd={addToSuite}
                  onRemove={suite.remove}
                  onClear={suite.clear}
                  onExport={() => void exportSuite()}
                  exportStatus={suiteExportState}
                />
              </div>
            }
          >
            <div className="space-y-4">{content}</div>
          </DeckWorkspace>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Deck
