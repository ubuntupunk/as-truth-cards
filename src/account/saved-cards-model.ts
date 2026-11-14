/**
 * Assembly rules for the Saved cards surface.
 *
 * Saving a card stores only its slug (`SavedCard.cardSlug`), because the canonical card
 * lives in `trope_graph` under a different schema and the account row must not duplicate
 * it. The page therefore joins two independent reads: the account's saved-slug list and
 * the public card listing. This module is that join, kept pure so the ordering and the
 * unresolved-slug behaviour are testable without a browser, a session, or a database.
 *
 * The ordering rule is the one readers expect: newest save first, which is the order the
 * API already returns. The listing order is irrelevant and is never used.
 */

/** One saved card, resolved against the public card listing. */
export type SavedCardEntry = {
  /** Canonical `trope_graph.cards.slug`; the deck deep-links on it. */
  readonly slug: string
  /** Card title as the listing reports it. */
  readonly title: string
  /** Card summary, or `null` when the card has none. */
  readonly summary: string | null
}

/** What the Saved cards surface can render after the join. */
export type SavedCardsListing = {
  /** Saved cards that resolved, newest save first. */
  readonly entries: readonly SavedCardEntry[]
  /**
   * Saved slugs the listing could not resolve, newest save first.
   *
   * A saved slug can fail to resolve because the card was removed from the corpus or
   * because it fell outside the page the listing returned. The UI must not choose
   * between those explanations — it says the card is not available, which is true in
   * both cases.
   */
  readonly unresolvedSlugs: readonly string[]
}

/** The subset of a listing row this join needs. */
export type SavedCardSource = {
  readonly slug: string
  readonly title: string
  readonly summary: string | null
}

/**
 * Join saved slugs to the public card listing.
 *
 * Duplicate saved slugs are collapsed: the API's `unique (userId, card_slug)` already
 * guarantees this, and a client-side duplicate must not render twice if that ever
 * changes. A missing listing row is reported, never silently dropped.
 *
 * @param savedSlugs Slugs in display order (newest save first), as the API returns them.
 * @param cards One page of the public card listing.
 * @returns Resolved entries and the slugs that did not resolve, both in saved order.
 * @example
 * ```ts
 * assembleSavedCards(['south-africa', 'removed-card'], [
 *   { slug: 'south-africa', title: 'South Africa', summary: '…' },
 * ])
 * // => { entries: [{ slug: 'south-africa', … }], unresolvedSlugs: ['removed-card'] }
 * ```
 */
export function assembleSavedCards(
  savedSlugs: readonly string[],
  cards: readonly SavedCardSource[],
): SavedCardsListing {
  const bySlug = new Map<string, SavedCardSource>()
  for (const card of cards) {
    if (!bySlug.has(card.slug)) bySlug.set(card.slug, card)
  }

  const entries: SavedCardEntry[] = []
  const unresolvedSlugs: string[] = []
  const seen = new Set<string>()

  for (const slug of savedSlugs) {
    if (seen.has(slug)) continue
    seen.add(slug)

    const card = bySlug.get(slug)
    if (card === undefined) {
      unresolvedSlugs.push(slug)
      continue
    }
    entries.push({ slug: card.slug, title: card.title, summary: card.summary })
  }

  return { entries, unresolvedSlugs }
}

/**
 * The deck URL that opens a card by slug.
 *
 * The deck reads `?focus=` on load and jumps to that card, so a saved card opens in the
 * same surface the Save action lives on rather than in a second reading view.
 *
 * @param slug Canonical card slug.
 * @returns A relative URL for a router `<Link>`.
 */
export function savedCardHref(slug: string): string {
  return `/?focus=${encodeURIComponent(slug)}`
}

/** Every state the saved-cards surface can render. */
export type SavedCardsPanelState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed-out'; readonly signInHref: string }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready'
      readonly entries: readonly SavedCardEntry[]
      readonly unresolvedSlugs: readonly string[]
    }

/** The independent query results the page reduces to one panel state. */
export type SavedCardsPanelInputs = {
  /** The session read is still in flight. */
  readonly sessionLoading: boolean
  readonly isSignedIn: boolean
  /** The saved-slug request failed, with its message. */
  readonly savedError: string | null
  /** Saved slugs, or `null` until the request settles. */
  readonly savedSlugs: readonly string[] | null
  /** The public card listing is still in flight. */
  readonly cardsPending: boolean
  /** The public card listing failed. */
  readonly cardsError: boolean
  /** The join, once both reads have data. */
  readonly listing: SavedCardsListing | null
}

/** Where a signed-out visitor is sent, and where they come back to. */
export const SAVED_CARDS_RETURN_TO = '/account/saved'

/** The sign-in URL that returns to this surface. */
export const SAVED_CARDS_SIGN_IN_HREF = `/sign-in?returnTo=${encodeURIComponent(
  SAVED_CARDS_RETURN_TO,
)}`

/**
 * Reduce the page's independent queries to the panel's single state.
 *
 * Precedence matters and is deliberate: the session is resolved before anything else
 * (a signed-out visitor must never be told their saved cards "failed"), then the private
 * read's error, then the public listing's error, then loading, then ready. The listing
 * error is reported separately from the saved error because the two have different
 * remedies — retrying the listing is not the same as retrying the account request.
 *
 * @param inputs Current query results.
 * @returns The state the panel should render.
 * @example
 * ```ts
 * savedCardsPanelState({ ...inputs, isSignedIn: false }).kind // => 'signed-out'
 * ```
 */
export function savedCardsPanelState(
  inputs: SavedCardsPanelInputs,
): SavedCardsPanelState {
  if (inputs.sessionLoading) return { kind: 'loading' }

  if (!inputs.isSignedIn) {
    return { kind: 'signed-out', signInHref: SAVED_CARDS_SIGN_IN_HREF }
  }

  if (inputs.savedError !== null) {
    return { kind: 'error', message: inputs.savedError }
  }

  if (inputs.cardsError) {
    return {
      kind: 'error',
      message:
        'Your saved cards loaded, but the card listing is unavailable, so their titles cannot be shown right now.',
    }
  }

  if (
    inputs.savedSlugs === null ||
    inputs.cardsPending ||
    inputs.listing === null
  ) {
    return { kind: 'loading' }
  }

  return {
    kind: 'ready',
    entries: inputs.listing.entries,
    unresolvedSlugs: inputs.listing.unresolvedSlugs,
  }
}
