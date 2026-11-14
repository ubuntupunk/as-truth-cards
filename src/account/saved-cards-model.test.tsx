/**
 * Tests for `saved-cards-model.ts` — the pure Saved cards surface rules.
 *
 * Two contracts matter here and neither needs a browser, a session, or a database:
 *
 * - **The join.** Saved rows store only a slug, so the page resolves titles against the
 *   public listing. Saved order (newest first) is the display order, duplicates collapse,
 *   and a slug the listing cannot resolve is *reported*, never silently dropped.
 * - **The state precedence.** A signed-out reader must never be told their saved cards
 *   "failed", and a listing failure is a different message from an account failure.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assembleSavedCards,
  SAVED_CARDS_RETURN_TO,
  SAVED_CARDS_SIGN_IN_HREF,
  type SavedCardsPanelInputs,
  savedCardHref,
  savedCardsPanelState,
} from './saved-cards-model'

/** A couple of listing rows, deliberately in an order unlike the saved order. */
const LISTING = [
  {
    slug: 'blood-libel',
    title: 'Blood libel',
    summary: 'A medieval accusation.',
  },
  { slug: 'south-africa', title: 'South Africa', summary: null },
] as const

describe('assembleSavedCards', () => {
  it('orders resolved cards by save order, not listing order', () => {
    const { entries } = assembleSavedCards(
      ['south-africa', 'blood-libel'],
      LISTING,
    )
    assert.deepEqual(
      entries.map((entry) => entry.slug),
      ['south-africa', 'blood-libel'],
    )
  })

  it('carries the title and the summary through, including a null summary', () => {
    const { entries } = assembleSavedCards(['south-africa'], LISTING)
    assert.deepEqual(entries, [
      { slug: 'south-africa', title: 'South Africa', summary: null },
    ])
  })

  it('reports unresolved slugs in saved order and does not drop them', () => {
    const { entries, unresolvedSlugs } = assembleSavedCards(
      ['removed-card', 'south-africa', 'also-removed'],
      LISTING,
    )
    assert.deepEqual(
      entries.map((entry) => entry.slug),
      ['south-africa'],
    )
    assert.deepEqual(unresolvedSlugs, ['removed-card', 'also-removed'])
  })

  it('collapses a duplicate saved slug instead of rendering the card twice', () => {
    const { entries } = assembleSavedCards(
      ['south-africa', 'south-africa'],
      LISTING,
    )
    assert.equal(entries.length, 1)
  })

  it('ignores duplicate listing rows rather than merging them', () => {
    const { entries } = assembleSavedCards(
      ['south-africa'],
      [
        { slug: 'south-africa', title: 'First', summary: null },
        { slug: 'south-africa', title: 'Second', summary: null },
      ],
    )
    assert.equal(entries.length, 1)
    assert.equal(entries[0].title, 'First')
  })

  it('returns an empty listing for no saved cards', () => {
    assert.deepEqual(assembleSavedCards([], LISTING), {
      entries: [],
      unresolvedSlugs: [],
    })
  })
})

describe('savedCardHref', () => {
  it('opens the card in the deck by focus slug', () => {
    assert.equal(savedCardHref('south-africa'), '/?focus=south-africa')
  })

  it('encodes a slug that would otherwise break the query string', () => {
    assert.equal(savedCardHref('a b&c'), '/?focus=a%20b%26c')
  })
})

describe('savedCardsPanelState', () => {
  /** A signed-in, settled, fully loaded set of inputs. */
  const ready: SavedCardsPanelInputs = {
    sessionLoading: false,
    isSignedIn: true,
    savedError: null,
    savedSlugs: ['south-africa'],
    cardsPending: false,
    cardsError: false,
    listing: assembleSavedCards(['south-africa'], LISTING),
  }

  it('is ready when both reads have settled', () => {
    const state = savedCardsPanelState(ready)
    assert.equal(state.kind, 'ready')
    assert.deepEqual(state.kind === 'ready' ? state.entries : [], [
      { slug: 'south-africa', title: 'South Africa', summary: null },
    ])
  })

  it('reports the session as loading before anything else', () => {
    assert.equal(
      savedCardsPanelState({
        ...ready,
        sessionLoading: true,
        isSignedIn: false,
        savedError: 'boom',
      }).kind,
      'loading',
    )
  })

  it('sends a signed-out reader to sign in, never to an error', () => {
    const state = savedCardsPanelState({
      ...ready,
      isSignedIn: false,
      savedError: 'boom',
      cardsError: true,
    })
    assert.deepEqual(state, {
      kind: 'signed-out',
      signInHref: SAVED_CARDS_SIGN_IN_HREF,
    })
  })

  it('returns to the saved-cards surface after signing in', () => {
    assert.equal(SAVED_CARDS_RETURN_TO, '/account/saved')
    assert.equal(
      SAVED_CARDS_SIGN_IN_HREF,
      `/sign-in?returnTo=${encodeURIComponent('/account/saved')}`,
    )
  })

  it('surfaces the account read error ahead of the listing error', () => {
    const state = savedCardsPanelState({
      ...ready,
      savedError: 'Could not load your saved cards.',
      cardsError: true,
    })
    assert.deepEqual(state, {
      kind: 'error',
      message: 'Could not load your saved cards.',
    })
  })

  it('explains a listing failure without blaming the saved cards', () => {
    const state = savedCardsPanelState({ ...ready, cardsError: true })
    assert.equal(state.kind, 'error')
    assert.ok(state.kind === 'error' && state.message.includes('listing'))
  })

  it('stays loading while the saved request or the listing is in flight', () => {
    assert.equal(
      savedCardsPanelState({ ...ready, savedSlugs: null }).kind,
      'loading',
    )
    assert.equal(
      savedCardsPanelState({ ...ready, cardsPending: true }).kind,
      'loading',
    )
    assert.equal(
      savedCardsPanelState({ ...ready, listing: null }).kind,
      'loading',
    )
  })
})
