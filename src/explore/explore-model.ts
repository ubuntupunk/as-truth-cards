/**
 * The Explore page's browse model — SPEC §5.3 (browse the corpus) and the
 * §3.1 `/explore` shell route.
 *
 * Pure data and pure functions: query state, facet derivation, and the merge
 * of a server-ranked search against the loaded listing. No JSX, no hooks, no
 * fetch, so every decision the surface makes is testable under Node.
 *
 * Three rules the module exists to keep honest:
 *
 * - **Facets select among loaded cards; they never invent classification.**
 *   Axis, status and Suit filters run over the rows the listing returned
 *   (`classification` is the graph's own assembly), exactly as the Deck's
 *   scope does — the ontology is never re-derived from what the UI shows.
 * - **Search answers with rank, not with facets.** `/api/graph/search` is
 *   server-ranked (`rank DESC, title ASC`) and returns no classification, so
 *   while a term is in flight the facets cannot be honestly applied to its
 *   hits: rows already loaded keep their facets, hits without a row are shown
 *   unclassified when no facet is active, and are withheld — with a count the
 *   page renders — when one is. The alternative, dropping or guessing them,
 *   would either lose real matches or fabricate dimensions.
 * - **Counts say what they counted.** {@link exploreCountLabel} distinguishes
 *   "n cards", "n of total cards", the loaded prefix of a paged listing, and
 *   a search's match count, because a browse header that reads `47` over six
 *   filtered rows is the same lie the Deck refuses to tell.
 */

import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import type {
  CardAxisValue,
  EpistemicStatusValue,
} from '../../trope-cards/src/graph/types.ts'
import { EPISTEMIC_STATUS_ORDER } from '../deck/deck-status'
import { SUIT_LABELS } from '../graph/deck-facets'
import type { CardSearchResult } from '../graph/projection-guards'

/** How results are ordered when no search term is in force. */
export type ExploreSort = 'title' | 'status'

/** The browse state the Explore page owns: three facets plus an order. */
export type ExploreQuery = {
  readonly axis: CardAxisValue | null
  readonly status: EpistemicStatusValue | null
  /** A `collections.slug`; suits only, never locales with the same name. */
  readonly suit: string | null
  readonly sort: ExploreSort
}

/** No facet active, listing order (server: title ascending). */
export const NO_EXPLORE_QUERY: ExploreQuery = {
  axis: null,
  status: null,
  suit: null,
  sort: 'title',
}

/**
 * Whether any facet narrows the corpus; sort is an order, not a filter.
 *
 * @param query The active browse query.
 * @returns `true` when at least one of axis/status/suit is set.
 */
export function hasActiveFilters(query: ExploreQuery): boolean {
  return query.axis !== null || query.status !== null || query.suit !== null
}

/**
 * Suits present in the loaded cards.
 *
 * The known vocabulary leads in its own declared order so the five suits read
 * the way the corpus declares them; a slug outside `SUIT_LABELS` (the vocab is
 * explicitly provisional, Q3) follows alphabetically rather than being hidden
 * or assigned an order the labels do not own.
 *
 * @param cards The loaded listing rows.
 * @returns Suit slugs to offer as facets, in order.
 */
export function availableSuits(
  cards: readonly CardListingRow[],
): readonly string[] {
  const present = new Set<string>()
  for (const card of cards) {
    for (const suit of card.classification.suits) present.add(suit)
  }
  const known = Object.keys(SUIT_LABELS).filter((slug) => present.has(slug))
  const unknown = [...present].filter((slug) => !(slug in SUIT_LABELS)).sort()
  return [...known, ...unknown]
}

/**
 * Whether a card survives every active facet (AND across dimensions).
 *
 * @param card One loaded listing row.
 * @param query The facets; unset dimensions pass everything.
 * @returns `true` when the card matches all active facets.
 */
export function matchesQuery(
  card: CardListingRow,
  query: ExploreQuery,
): boolean {
  if (
    query.axis !== null &&
    !card.classification.axes.some((entry) => entry.axis === query.axis)
  ) {
    return false
  }
  if (query.status !== null && card.epistemicStatus !== query.status) {
    return false
  }
  if (query.suit !== null && !card.classification.suits.includes(query.suit)) {
    return false
  }
  return true
}

/** One rendered result: a classified row, or a search hit without one. */
export type ExploreResult =
  | { readonly kind: 'row'; readonly card: CardListingRow }
  | { readonly kind: 'hit'; readonly hit: CardSearchResult }

/** What {@link exploreResults} produced, and why it is in that order. */
export type ExploreResults = {
  /** Results in display order. */
  readonly results: readonly ExploreResult[]
  /**
   * Search hits withheld because a facet is active and their row never
   * arrived, so the facet could not be checked. The page must show this.
   */
  readonly withheldHits: number
  /** `true` when order came from the server's rank, not the sort control. */
  readonly byRelevance: boolean
}

/**
 * The rows to render, in order.
 *
 * Browse (`hits === null`) filters the listing and applies the sort: `title`
 * keeps the server's title order untouched, `status` re-orders by vocabulary
 * with a stable sort so equal statuses stay title-ordered. Search (`hits`)
 * walks the server's rank order exactly as returned — re-sorting relevance
 * results would undo the only thing search knows that the listing does not —
 * joining each hit to its row by slug when the row is among the loaded cards.
 *
 * @param cards The loaded listing rows, in server order.
 * @param query The active facets and sort.
 * @param hits The server's ranked results, or `null` while browsing.
 * @returns Display results plus the withheld-hit count; see
 * {@link ExploreResults}.
 */
export function exploreResults(
  cards: readonly CardListingRow[],
  query: ExploreQuery,
  hits: readonly CardSearchResult[] | null,
): ExploreResults {
  if (hits === null) {
    const filtered = cards.filter((card) => matchesQuery(card, query))
    const rows = query.sort === 'status' ? byStatus(filtered) : filtered
    return {
      results: rows.map((card) => ({ kind: 'row', card })),
      withheldHits: 0,
      byRelevance: false,
    }
  }

  const bySlug = new Map(cards.map((card) => [card.slug, card]))
  const filtering = hasActiveFilters(query)
  const results: ExploreResult[] = []
  let withheldHits = 0
  for (const hit of hits) {
    const card = bySlug.get(hit.slug)
    if (card !== undefined) {
      if (matchesQuery(card, query)) {
        results.push({ kind: 'row', card })
      }
      continue
    }
    if (filtering) {
      withheldHits += 1
      continue
    }
    results.push({ kind: 'hit', hit })
  }
  return { results, withheldHits, byRelevance: true }
}

/**
 * Order cards by research status, in vocabulary order, stably.
 *
 * @param cards Cards already in title order.
 * @returns A new list grouped `ESTABLISHED` → `LIVE`; ties keep title order.
 */
function byStatus(cards: readonly CardListingRow[]): readonly CardListingRow[] {
  const rank = new Map(
    EPISTEMIC_STATUS_ORDER.map((status, index) => [status, index]),
  )
  return [...cards].sort(
    (a, b) =>
      (rank.get(a.epistemicStatus) ?? EPISTEMIC_STATUS_ORDER.length) -
      (rank.get(b.epistemicStatus) ?? EPISTEMIC_STATUS_ORDER.length),
  )
}

/**
 * The result-count line: what is on screen, out of what, and whether "what"
 * is the whole listing or its loaded prefix — or, mid-search, how many
 * matches the server found.
 *
 * The browse phrasing deliberately matches the Deck's scope badge (`47
 * cards`, `6 of 47 cards`, `… (first 100 loaded)`), because the same words
 * over the same data should read the same way on both surfaces.
 *
 * @param counts `shown` results to render, `total` server rows for the
 * unfiltered listing, `served` rows actually loaded, `searching` whether a
 * term owns the ordering.
 * @returns The count line, e.g. `12 matches`.
 */
export function exploreCountLabel(counts: {
  readonly shown: number
  readonly total: number
  readonly served: number
  readonly searching: boolean
}): string {
  const { shown, total, served, searching } = counts
  if (searching) {
    return `${shown} match${shown === 1 ? '' : 'es'}`
  }
  const scopeSuffix = shown === total ? '' : ` of ${total}`
  // The noun counts the corpus, so it pluralises off the total: `1 of 47
  // cards`, never `1 of 47 card`.
  const base = `${shown}${scopeSuffix} card${total === 1 ? '' : 's'}`
  return served === total ? base : `${base} (first ${served} loaded)`
}
