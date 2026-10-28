/**
 * Tests for `card-save-button.tsx` — Save/unsave affordance (SPEC §6.x).
 *
 * The signed-out branch is hook-free and renderable with
 * `preact-render-to-string`. The signed-in `SaveCardToggle` uses Preact hooks
 * (`useState`, `useEffect`) which `preact-render-to-string` cannot execute;
 * its error-UI behaviour (visible `data-testid="save-card-error"` on save /
 * unsave failure) is verified live in-browser via `agent-browser` against
 * `localhost:8080` (see Issue #9 E2E report).
 *
 * Signed-out rule: the affordance is deliberately non-operative — disabled,
 * with its reason as visible text (`aria-describedby`). No click handler is
 * attached; the header's Sign-in link is the account entry point.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { CardSaveButton } from './card-save-button'

describe('CardSaveButton (signed out)', () => {
  it('renders a disabled button with visible reason text', () => {
    const html = render(<CardSaveButton slug="jesus-was-a-zionist" />)

    assert.ok(
      html.includes('data-testid="save-card"'),
      'save-card testid present',
    )
    assert.ok(html.includes('disabled'), 'button is disabled when signed out')
    assert.ok(
      html.includes('aria-describedby="save-card-note"'),
      'reason is exposed via aria-describedby',
    )
    assert.ok(
      html.includes('Sign in to save cards to your account.'),
      'reason text is visible',
    )
  })

  it('does not render an error notice when signed out', () => {
    const html = render(<CardSaveButton slug="jesus-was-a-zionist" />)

    assert.ok(
      !html.includes('data-testid="save-card-error"'),
      'no error notice when signed out',
    )
  })
})

/**
 * Deterministic coverage for signed-in save/unsave failure paths.
 *
 * `saveCard`/`unsaveCard` accept an injectable `fetchImpl`, so a mock fetch
 * that rejects or returns non-ok responses exercises the exact error path the
 * UI catches and surfaces via `data-testid="save-card-error"`.
 *
 * The UI error notice itself (visible `aria-live="polite"` paragraph) is
 * verified live in-browser via `agent-browser` against `localhost:8080`
 * (see Issue #9 E2E report, Test 1).
 */

import { checkSaved, saveCard, unsaveCard } from '@/auth/saved-cards'

describe('saved-cards API failure paths (signed in)', () => {
  const failingFetch = () => Promise.reject(new Error('network failure'))

  const errorResponse = (status: number, message: string) =>
    Promise.resolve(
      new Response(JSON.stringify({ error: message }), {
        status,
        statusText: message,
        headers: { 'content-type': 'application/json' },
      }),
    )

  it('saveCard rejects when the network fails', async () => {
    await assert.rejects(saveCard('jesus-was-a-zionist', failingFetch), {
      message: 'network failure',
    })
  })

  it('unsaveCard rejects when the network fails', async () => {
    await assert.rejects(unsaveCard('jesus-was-a-zionist', failingFetch), {
      message: 'network failure',
    })
  })

  it('saveCard throws on non-ok response', async () => {
    await assert.rejects(
      saveCard('jesus-was-a-zionist', () => errorResponse(500, 'server error')),
      { message: 'Failed to save card' },
    )
  })

  it('unsaveCard throws on non-ok response', async () => {
    await assert.rejects(
      unsaveCard('jesus-was-a-zionist', () =>
        errorResponse(500, 'server error'),
      ),
      { message: 'Failed to unsave card' },
    )
  })

  it('checkSaved returns false on 401 (not an error)', async () => {
    const result = await checkSaved('jesus-was-a-zionist', () =>
      errorResponse(401, 'unauthorized'),
    )
    assert.equal(result, false)
  })
})
