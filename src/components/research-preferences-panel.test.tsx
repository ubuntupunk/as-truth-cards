/**
 * Render tests for the shared research-preferences panel — the surface the
 * onboarding completion panel's "Review Settings" and the account Settings page
 * both mount.
 *
 * The panel is stateful (tabs, staged edits, save status), so these render it
 * under `preact-render-to-string` and assert the initial markup and the parts a
 * tab switch reveals; the save contract itself is exercised through its seams.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import {
  ResearchPreferencesPanel,
  SETTINGS_TABS,
} from './research-preferences-panel'

const noop = async () => undefined

const baseProps = {
  values: { feedbackEmail: 'later', academicParticipation: 'yes' } as const,
  treatment: 'editorial' as const,
  name: 'Dav',
  summary: null,
  onSave: noop,
  onEditProfile: () => undefined,
}

describe('ResearchPreferencesPanel', () => {
  it('opens on the research-preference questions with both answered', () => {
    const html = render(<ResearchPreferencesPanel {...baseProps} />)
    assert.ok(html.includes('Feedback-related email'))
    assert.ok(html.includes('Academic participation'))
    assert.equal((html.match(/type="radio"/g) ?? []).length, 6)
    assert.ok(html.includes('name="academicParticipation" value="yes" checked'))
    assert.ok(html.includes('data-testid="preferences-panel"'))
  })

  it('offers exactly the three guided-setup categories as tabs', () => {
    assert.deepEqual(SETTINGS_TABS, ['profile', 'appearance', 'preferences'])
    const html = render(<ResearchPreferencesPanel {...baseProps} />)
    assert.ok(html.includes('role="tablist"'))
    assert.ok(html.includes('>Profile<'))
    assert.ok(html.includes('>Appearance<'))
    assert.ok(html.includes('>Research preferences<'))
  })

  it('exposes one visible tab panel at a time', () => {
    const html = render(<ResearchPreferencesPanel {...baseProps} />)
    assert.ok(html.includes('data-testid="settings-tab-preferences"'))
    assert.equal(html.includes('data-testid="settings-tab-appearance"'), false)
    assert.equal(html.includes('data-testid="settings-tab-profile"'), false)
  })

  it('reports the staged answers rather than claiming the account owns them', () => {
    const html = render(<ResearchPreferencesPanel {...baseProps} />)
    assert.ok(html.includes('stored on this device'))
    assert.ok(html.includes('not research evidence'))
    assert.equal(html.includes('saved to your account'), false)
  })

  it('renders a save action and no saved status until one fires', () => {
    const html = render(<ResearchPreferencesPanel {...baseProps} />)
    assert.ok(html.includes('Save preferences'))
    assert.equal(html.includes('data-testid="preferences-saved"'), false)
  })

  it('shows the summary rows only when the host supplies one', () => {
    assert.equal(
      render(<ResearchPreferencesPanel {...baseProps} />).includes(
        'data-testid="settings-summary"',
      ),
      false,
    )
    assert.ok(
      render(
        <ResearchPreferencesPanel
          {...baseProps}
          summary={{
            profile: 'Dav',
            appearance: 'Editorial',
            researchPreferences: '',
          }}
        />,
      ).includes('data-testid="settings-summary"'),
    )
  })

  it('paints accents with the readable token, never the near-white primary background token', () => {
    const html = render(<ResearchPreferencesPanel {...baseProps} />)
    assert.ok(html.includes('bg-graph-surface'))
    // The Button's solid `bg-primary`/`text-primary-foreground` inverse fill is
    // legitimate; what must never appear is a whole `text-primary` class token
    // — `--primary` is a near-white surface token, so text painted with it is
    // invisible on a card in both modes.
    assert.equal(
      /(?<![-\w])text-primary(?![\w-])/.test(html),
      false,
      'no whole text-primary class token — it is invisible on cards',
    )
  })
})
