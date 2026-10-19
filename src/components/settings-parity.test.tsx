/**
 * Tests for the settings parity surfaces — the two places a user can actually
 * change their research preferences.
 *
 * Both pages read the session (`useAdminCheck`) and the router, so they cannot
 * be mounted in the string harness. What is testable — and what the QA report
 * was about — is the *wiring*: that "Review Settings" is a real control rather
 * than a door to a stub, and that the settings route is reachable from the
 * account sidebar. Those are asserted here against the source of truth the
 * pages read (`SETTINGS_TABS`) and the route/section tables.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { APP_ROUTES } from '@/app-routes'
import { ACCOUNT_NAV_SECTIONS } from './account/account-nav'
import { SETTINGS_TABS } from './research-preferences-panel'

const onboardingSource = readFileSync(
  new URL('../pages/Onboarding.tsx', import.meta.url),
  'utf8',
)
const settingsSource = readFileSync(
  new URL('../pages/AccountSettings.tsx', import.meta.url),
  'utf8',
)

describe('Review Settings wiring', () => {
  it('opens the shared preferences panel in place instead of a stub route', () => {
    // The completion panel's callback must mount the panel, not navigate to a
    // page that only said "coming soon" (gh QA: "review settings button
    // doesn't work").
    assert.ok(
      onboardingSource.includes(
        'onReviewSettings={() => setReviewingSettings(true)}',
      ),
    )
    assert.ok(onboardingSource.includes('<ResearchPreferencesPanel'))
    assert.equal(
      onboardingSource.includes(
        "onReviewSettings={() => navigate('/account/settings')}",
      ),
      false,
      'Review Settings must not just navigate to a stub',
    )
  })

  it('hosts the same panel on the account settings page', () => {
    assert.ok(settingsSource.includes('<ResearchPreferencesPanel'))
  })

  it('renders the account sidebar on the settings page, like its siblings', () => {
    assert.ok(settingsSource.includes('<AccountNav active="settings"'))
  })

  it('covers the three categories guided setup collects', () => {
    assert.deepEqual(SETTINGS_TABS, ['profile', 'appearance', 'preferences'])
  })

  it('keeps the settings route reachable from the account sidebar', () => {
    const paths = APP_ROUTES.map((route) => route.path)
    assert.ok(paths.includes('/account/settings'))
    assert.ok(
      ACCOUNT_NAV_SECTIONS.some(
        (section) => section.to === '/account/settings',
      ),
    )
  })
})
