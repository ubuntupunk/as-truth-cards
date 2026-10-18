/**
 * Render tests for the account page's presentational panels.
 *
 * The contracts under test are the ones the QA pass found missing: an honest
 * email-verification state with a real resend affordance when unverified (and
 * none when verified), "Not added" fallbacks for absent profile fields, the
 * website link normalised to a real href, and the account sidebar pointing
 * only at routes that exist.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { APP_ROUTES } from '@/app-routes'
import { EMPTY_PROFILE_FORM } from '@/onboarding/wizard'
import { ACCOUNT_NAV_SECTIONS } from './account-nav'
import { EditProfileForm } from './edit-profile-form'
import { PrivateAccountCard } from './private-account-card'
import { PublicProfileCard } from './public-profile-card'

const noop = () => undefined

describe('PublicProfileCard', () => {
  const renderCard = (
    overrides: Partial<Parameters<typeof PublicProfileCard>[0]> = {},
  ) =>
    render(
      <PublicProfileCard
        name="Dav"
        bio="Research and education"
        website="example.org"
        location="Cape Town"
        accountRole="ANONYMOUS"
        onEdit={noop}
        {...overrides}
      />,
    )

  it('renders identity, role and the public-facing fields', () => {
    const html = renderCard()
    assert.ok(html.includes('Public profile preview'))
    assert.ok(html.includes('>D<'), 'initial avatar')
    assert.ok(html.includes('Dav'))
    assert.ok(html.includes('Anonymous'))
    assert.ok(html.includes('Research and education'))
    assert.ok(html.includes('Cape Town'))
    assert.ok(html.includes('Edit profile'))
  })

  it('links the website at a normalised href with an external marker', () => {
    const html = renderCard()
    assert.ok(html.includes('href="https://example.org"'))
    assert.ok(html.includes('target="_blank"'))
    assert.ok(html.includes('noopener noreferrer'))
    assert.ok(html.includes('↗'))
  })

  it('says “Not added” for absent fields instead of rendering blanks', () => {
    const html = renderCard({ bio: null, website: null, location: null })
    assert.equal((html.match(/Not added/g) ?? []).length, 3)
    assert.equal(
      html.includes('<a '),
      false,
      'no dead link for a missing website',
    )
  })

  it('never invents a researcher credential from the role', () => {
    const html = renderCard({ accountRole: undefined })
    assert.equal(html.includes('Verified researcher'), false)
    assert.ok(html.includes('Anonymous'))
  })

  it('paints public-facing accents with the readable accent token, never the near-white primary background token', () => {
    const html = renderCard({ website: 'example.org' })
    // `--primary` is a near-white surface token (95.9% lightness in light
    // mode, 98% in dark); `text-primary` on a card is invisible in both
    // modes. Accents must ride `--graph-accent`, which the treatment system
    // themes and which overrides per mode.
    assert.ok(html.includes('text-graph-accent'))
    assert.equal(html.includes('text-primary'), false)
    assert.equal(html.includes('bg-primary'), false)
  })
})

describe('PrivateAccountCard', () => {
  const base = {
    email: 'dav@example.org',
    resendStatus: 'idle' as const,
    resendError: null,
    onResend: noop,
    treatment: 'atmospheric' as const,
    onSelectTreatment: noop,
  }

  it('shows the verified state without a resend action', () => {
    const html = render(<PrivateAccountCard {...base} emailVerified />)
    assert.ok(html.includes('Email verified'))
    assert.equal(html.includes('Resend verification email'), false)
    assert.ok(html.includes('does not establish research expertise'))
  })

  it('shows an honest unverified state with a real resend action', () => {
    const html = render(<PrivateAccountCard {...base} emailVerified={false} />)
    assert.ok(html.includes('Email not verified'))
    assert.ok(html.includes('data-testid="resend-verification"'))
    assert.ok(html.includes('dav@example.org'))
  })

  it('reports the accepted-resend status without overclaiming delivery', () => {
    const html = render(
      <PrivateAccountCard
        {...base}
        emailVerified={false}
        resendStatus="sent"
      />,
    )
    assert.ok(html.includes('role="status"'))
    assert.ok(html.includes('If this address can receive mail'))
    assert.equal(html.includes('delivered'), false)
  })

  it('surfaces a resend failure with role=alert', () => {
    const html = render(
      <PrivateAccountCard
        {...base}
        emailVerified={false}
        resendError="Too many requests"
      />,
    )
    assert.ok(html.includes('role="alert"'))
    assert.ok(html.includes('Too many requests'))
  })

  it('includes the appearance selector on the account surface', () => {
    assert.ok(
      render(<PrivateAccountCard {...base} emailVerified />).includes(
        'data-testid="appearance-selector"',
      ),
    )
  })
})

describe('EditProfileForm', () => {
  it('renders the four fields, the honest note and both actions', () => {
    const html = render(
      <EditProfileForm
        values={{ ...EMPTY_PROFILE_FORM, name: 'Dav' }}
        errors={{}}
        saving={false}
        error={null}
        onFieldChange={noop}
        onSave={noop}
        onCancel={noop}
      />,
    )
    assert.ok(html.includes('Edit profile'))
    assert.ok(html.includes('Email and security are managed in Settings'))
    assert.ok(html.includes(`value="Dav"`))
    assert.ok(html.includes("don't verify credentials"))
    assert.ok(html.includes('Save profile'))
    assert.ok(html.includes('Cancel'))
  })

  it('renders the server error and a validation message', () => {
    const html = render(
      <EditProfileForm
        values={{ ...EMPTY_PROFILE_FORM, name: '' }}
        errors={{
          name: 'Add a display name to continue, or use “Skip for now”.',
        }}
        saving={false}
        error="Failed to save profile"
        onFieldChange={noop}
        onSave={noop}
        onCancel={noop}
      />,
    )
    assert.ok(html.includes('data-testid="edit-profile-error"'))
    assert.ok(html.includes('Failed to save profile'))
    assert.ok(html.includes('Add a display name to continue'))
  })
})

/**
 * The sidebar renders `<Link>`s, which require a router context that this SSR
 * harness does not provide (the same limitation documented in `Footer.test.tsx`),
 * so the sections table itself is the unit under test — it is what `AccountNav`
 * maps directly to links, and the copy beside it is fixed JSX.
 */
describe('AccountNav sections', () => {
  it('offers the three designed account sections', () => {
    assert.deepEqual(
      ACCOUNT_NAV_SECTIONS.map((section) => section.label),
      ['My profile', 'My activity', 'Settings'],
    )
    assert.deepEqual(
      ACCOUNT_NAV_SECTIONS.map((section) => section.key),
      ['profile', 'activity', 'settings'],
    )
  })

  it('links only routes the app actually serves — no dead links', () => {
    const paths = APP_ROUTES.map((route) => route.path)
    for (const section of ACCOUNT_NAV_SECTIONS) {
      assert.ok(
        paths.includes(section.to),
        `${section.label} → ${section.to} must be a real route`,
      )
    }
    assert.equal(
      ACCOUNT_NAV_SECTIONS.some((section) => section.label === 'Saved cards'),
      false,
      'no route exists for saved cards yet',
    )
  })

  it('returns to the deck via the root route', () => {
    assert.ok(APP_ROUTES.map((route) => route.path).includes('/'))
  })
})
