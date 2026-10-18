/**
 * Tests for the account-view derivation the account surfaces read.
 *
 * Pins the session → UI mapping, including the profile fields the improved
 * account panel displays and the onboarding/verification states the QA pass
 * found mislabelled: `onboardedAt` is the only completion source, and missing
 * profile fields read as null rather than "undefined".
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SessionShape } from './session-envelope'
import { deriveAccountView, readOnboardedAt } from './session-state'

/** A minimal signed-in session with the fields under test. */
function session(overrides: Record<string, unknown> = {}): SessionShape {
  return {
    user: {
      id: 'u_1',
      email: 'dav@example.org',
      name: 'Dav',
      emailVerified: false,
      image: null,
      role: 'ANONYMOUS',
      onboardedAt: null,
      bio: 'Research and education',
      website: 'example.org',
      location: 'Cape Town',
      ...overrides,
    },
    session: { id: 's_1' },
  } as unknown as SessionShape
}

describe('deriveAccountView profile fields', () => {
  it('maps string profile fields through to the account view', () => {
    const view = deriveAccountView(session())
    assert.equal(view.user?.bio, 'Research and education')
    assert.equal(view.user?.website, 'example.org')
    assert.equal(view.user?.location, 'Cape Town')
  })

  it('reads absent or non-string profile fields as null', () => {
    const view = deriveAccountView(session({ bio: 42, website: null }))
    assert.equal(view.user?.bio, null)
    assert.equal(view.user?.website, null)
    assert.equal(view.user?.location, 'Cape Town')
  })

  it('keeps onboarding state tied to onboardedAt alone', () => {
    const incomplete = deriveAccountView(session())
    assert.equal(incomplete.onboardingComplete, false)
    assert.equal(incomplete.onboardingStatus, 'incomplete')

    const complete = deriveAccountView(
      session({ onboardedAt: '2026-01-01T00:00:00.000Z' }),
    )
    assert.equal(complete.onboardingComplete, true)
    assert.equal(complete.onboardingStatus, 'complete')
  })
})

describe('readOnboardedAt', () => {
  it('accepts ISO strings and Dates, rejects everything else', () => {
    assert.equal(
      readOnboardedAt('2026-01-01T00:00:00.000Z'),
      '2026-01-01T00:00:00.000Z',
    )
    assert.equal(
      readOnboardedAt(new Date('2026-01-01T00:00:00.000Z')),
      '2026-01-01T00:00:00.000Z',
    )
    assert.equal(readOnboardedAt(''), null)
    assert.equal(readOnboardedAt(true), null)
    assert.equal(readOnboardedAt(undefined), null)
  })
})
