/**
 * Render tests for the Saved cards panel.
 *
 * The panel is presentational: every state is a prop, so this test drives each honest
 * state through the same string renderer the other account tests use. Links are injected
 * as plain anchors because a real `react-router` `Link` needs router context, which this
 * harness does not provide (the same limitation documented for `AccountNav`/`Footer`).
 *
 * The contract the QA pass would check: the surface never claims a saved card does not
 * exist, never hides an unresolved entry, and never presents saving as support for a
 * claim.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import type { SavedCardsPanelState } from '@/account/saved-cards-model'
import { type PanelLink, SavedCardsPanel } from './saved-cards-panel'

/** An anchor stand-in for the SPA link, so links are assertable without a router. */
const anchorLink: PanelLink = ({ to, className, children }) => (
  <a href={to} className={className}>
    {children}
  </a>
)

/**
 * Render the panel with the anchor link injected.
 *
 * @param state The state under test.
 * @param extra Extra props (unsave handler, notice, in-flight slug).
 * @returns The rendered HTML.
 */
function renderPanel(
  state: SavedCardsPanelState,
  extra: Partial<Parameters<typeof SavedCardsPanel>[0]> = {},
): string {
  return render(<SavedCardsPanel state={state} link={anchorLink} {...extra} />)
}

describe('SavedCardsPanel states', () => {
  it('says it is loading rather than showing an empty list', () => {
    const html = renderPanel({ kind: 'loading' })
    assert.ok(html.includes('data-testid="saved-cards-loading"'))
    assert.ok(!html.includes('data-testid="saved-cards-empty"'))
  })

  it('asks a signed-out reader to sign in and links the return url', () => {
    const html = renderPanel({
      kind: 'signed-out',
      signInHref: '/sign-in?returnTo=%2Faccount%2Fsaved',
    })
    assert.ok(html.includes('data-testid="saved-cards-signed-out"'))
    assert.ok(html.includes('href="/sign-in?returnTo=%2Faccount%2Fsaved"'))
    assert.ok(html.includes('Sign in'))
  })

  it('renders an error message as an alert', () => {
    const html = renderPanel({
      kind: 'error',
      message: 'Could not load your saved cards.',
    })
    assert.ok(html.includes('role="alert"'))
    assert.ok(html.includes('Could not load your saved cards.'))
  })

  it('states an empty reading list without inventing cards', () => {
    const html = renderPanel({
      kind: 'ready',
      entries: [],
      unresolvedSlugs: [],
    })
    assert.ok(html.includes('data-testid="saved-cards-empty"'))
    assert.ok(html.includes('No saved cards yet.'))
    assert.ok(!html.includes('data-testid="saved-card"'))
  })
})

describe('SavedCardsPanel ready state', () => {
  const ready: SavedCardsPanelState = {
    kind: 'ready',
    entries: [
      {
        slug: 'south-africa',
        title: 'South Africa',
        summary: 'A state-level accusation.',
      },
      { slug: 'blood-libel', title: 'Blood libel', summary: null },
    ],
    unresolvedSlugs: [],
  }

  it('lists each card by title and opens it in the deck', () => {
    const html = renderPanel(ready)
    assert.ok(html.includes('South Africa'))
    assert.ok(html.includes('Blood libel'))
    assert.ok(html.includes('href="/?focus=south-africa"'))
    assert.ok(html.includes('href="/?focus=blood-libel"'))
  })

  it('shows a summary when there is one, and nothing when there is not', () => {
    const html = renderPanel(ready)
    assert.ok(html.includes('A state-level accusation.'))
    assert.equal(html.includes('null'), false)
  })

  it('offers unsave only when a handler is provided', () => {
    assert.ok(!renderPanel(ready).includes('Unsave'))
    const withHandler = renderPanel(ready, { onUnsave: () => undefined })
    assert.ok(withHandler.includes('Unsave'))
    assert.ok(withHandler.includes('aria-label="Unsave South Africa"'))
  })

  it('marks the in-flight card as unsaving', () => {
    const html = renderPanel(ready, {
      onUnsave: () => undefined,
      unsavingSlug: 'south-africa',
    })
    assert.ok(html.includes('Unsaving…'))
  })

  it('shows an unresolved saved slug instead of dropping it', () => {
    const html = renderPanel({
      kind: 'ready',
      entries: [ready.entries[0]],
      unresolvedSlugs: ['removed-card'],
    })
    assert.ok(html.includes('data-testid="saved-cards-unresolved"'))
    assert.ok(html.includes('removed-card'))
    assert.ok(html.includes('Not available right now'))
    assert.ok(
      html.includes('could not be matched to a card in the listing'),
      'the explanation must not claim the card was deleted',
    )
  })

  it('shows a rollback notice when an unsave failed', () => {
    const html = renderPanel(ready, {
      notice: 'Could not unsave that card. It is still in your saved cards.',
    })
    assert.ok(html.includes('data-testid="saved-cards-notice"'))
    assert.ok(html.includes('still in your saved cards'))
  })

  it('never presents saving as a judgement about a claim', () => {
    const html = renderPanel(ready).toLowerCase()
    assert.ok(html.includes('not a judgement'))
    assert.ok(!html.includes('supports'))
  })
})
