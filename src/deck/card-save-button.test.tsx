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
