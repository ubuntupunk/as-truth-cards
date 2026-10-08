/**
 * The Explore / Browse surface — Phase B (ROADMAP §71–96), route `/explore`.
 *
 * Discovery over the canonical corpus, on the same two read endpoints the
 * rest of the app already trusts: `GET /api/graph/cards` (the Deck's listing,
 * shared through the identical query key, so both surfaces read one cached
 * truth) and `GET /api/graph/search` (server-ranked). Filtering, search and
 * ordering happen only where the API contract supports them: facets select
 * among loaded rows, search defers ordering to the server's rank, and
 * nothing re-derives a classification the graph did not author.
 *
 * Render order is the honesty contract:
 *
 * 1. listing in flight → loading; rejected → the API error, or the malformed
 *    shape state when the body broke the documented contract;
 * 2. an empty corpus → "no cards yet", never "no results";
 * 3. a term in force but unanswered → searching; failed → its own error;
 * 4. zero results → whichever empty reason is actually true (the term, or
 *    the filters — never a bare "nothing here" that hides which);
 * 5. results, under a count line that says what it counted, plus — when it
 *    applies — why some matches are being held back rather than guessed at.
 */

import { useState } from 'preact/hooks'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { availableAxes, availableStatuses } from '@/deck/deck-model'
import { useDeckCards } from '@/deck/use-deck'
import { ExploreFilters } from '@/explore/explore-filters'
import {
  availableSuits,
  type ExploreQuery,
  exploreCountLabel,
  exploreResults,
  hasActiveFilters,
  NO_EXPLORE_QUERY,
} from '@/explore/explore-model'
import { ResultCard } from '@/explore/result-card'
import { ExploreSearchField } from '@/explore/search-field'
import {
  ApiErrorState,
  LoadingState,
  MalformedState,
} from '@/graph/graph-states'
import { ProjectionShapeError } from '@/graph/projection-guards'
import { useCardSearch } from '@/graph/use-graph'

/**
 * The `/explore` page.
 *
 * @returns The composed browse screen (Header, search, filters, results,
 * Footer).
 */
const Explore = () => {
  const cardsQuery = useDeckCards()
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState<ExploreQuery>(NO_EXPLORE_QUERY)
  const search = useCardSearch(term)
  const searching = search.term.length >= 2

  const cards = cardsQuery.data?.items ?? []
  const total = cardsQuery.data?.total ?? 0
  const served = cards.length

  const clearFilters = () =>
    setQuery((current) => ({
      ...current,
      axis: null,
      status: null,
      suit: null,
    }))

  const renderResults = () => {
    if (cardsQuery.isLoading) {
      return <LoadingState labelled="Loading cards…" />
    }
    if (cardsQuery.error instanceof ProjectionShapeError) {
      return <MalformedState error={cardsQuery.error} />
    }
    if (cardsQuery.isError) {
      return <ApiErrorState error={cardsQuery.error} />
    }
    if (cardsQuery.data !== undefined && total === 0) {
      return (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h2 className="text-xl font-semibold">No cards yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The graph returned an empty card listing. Explore shows what the
            corpus holds — when cards are seeded, they appear here in listing
            order.
          </p>
        </div>
      )
    }

    if (searching) {
      if (search.isError) {
        return <ApiErrorState error={search.error} />
      }
      if (search.data === undefined) {
        return <LoadingState labelled="Searching…" />
      }
    }

    const hits =
      searching && search.data !== undefined ? search.data.results : null
    const { results, withheldHits, byRelevance } = exploreResults(
      cards,
      query,
      hits,
    )
    const filtering = hasActiveFilters(query)
    const shownTerm = `“${search.term.trim()}”`

    if (results.length === 0) {
      return (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h2 className="text-xl font-semibold">
            {searching ? 'No matches' : 'No cards match these filters'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {searching
              ? filtering
                ? `Nothing matches ${shownTerm} with the active filters.`
                : `Nothing in the corpus matches ${shownTerm}.`
              : 'No card carries every selected axis, research status and suit at once.'}
          </p>
          {filtering ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      )
    }

    return (
      <>
        <p
          data-testid="explore-count"
          className="text-sm text-muted-foreground"
        >
          <span className="font-medium text-foreground">
            {exploreCountLabel({
              shown: results.length,
              total,
              served,
              searching,
            })}
          </span>
          {byRelevance ? ' · ordered by relevance' : ''}
        </p>
        {withheldHits > 0 ? (
          <p
            data-testid="explore-withheld"
            className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground"
          >
            {withheldHits} match{withheldHits === 1 ? '' : 'es'} not shown —
            their cards fall outside the loaded {served}, so the filters cannot
            be checked against them. Clear the filters to include them.
          </p>
        ) : null}
        <ul
          data-testid="explore-results"
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
          {results.map((result) => (
            <ResultCard
              key={result.kind === 'row' ? result.card.id : result.hit.id}
              result={result}
            />
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto w-full max-w-5xl">
          <nav
            data-testid="explore-context-bar"
            aria-label="Breadcrumb"
            className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span>Trope Cards</span>
            <span aria-hidden="true">·</span>
            <span>Research</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-foreground">Explorer</span>
          </nav>

          <header className="mt-4" data-testid="explore-heading">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Research / Explore
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              Explorer
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search and filter the card corpus, then open a card in the deck or
              expand it in the graph.
            </p>
          </header>

          <div className="mt-5">
            <ExploreSearchField value={term} onChange={setTerm} />
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <ExploreFilters
                query={query}
                axes={availableAxes(cards)}
                statuses={availableStatuses(cards)}
                suits={availableSuits(cards)}
                searching={searching}
                onChange={setQuery}
              />
            </aside>
            <section aria-label="Results" className="min-w-0">
              {renderResults()}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Explore
