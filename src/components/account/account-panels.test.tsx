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
import type { VNode } from 'preact'
import { render } from 'preact-render-to-string'
import { APP_ROUTES } from '@/app-routes'
import { EMPTY_PROFILE_FORM } from '@/onboarding/wizard'
import { ACCOUNT_NAV_SECTIONS } from './account-nav'
import { AvatarPanel } from './avatar-panel'
import { EditProfileForm } from './edit-profile-form'
import { PrivateAccountCard } from './private-account-card'
import { PublicProfileCard } from './public-profile-card'

const noop = () => undefined

/**
 * Find a vnode by `data-testid` anywhere in a rendered component tree,
 * descending into function components by invoking them (they are pure, so
 * this is just rendering) — the same walk the deck tests use to click
 * handlers without a DOM.
 */
function findByTestId(
  tree: unknown,
  testId: string,
): (VNode & { props?: Record<string, unknown> }) | undefined {
  if (tree === null || tree === undefined || typeof tree !== 'object') {
    return undefined
  }
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const found = findByTestId(item, testId)
      if (found) return found
    }
    return undefined
  }
  const vnode = tree as VNode & { props?: Record<string, unknown> }
  if (typeof vnode.type === 'function') {
    return findByTestId(
      (vnode.type as (props: unknown) => unknown)(vnode.props),
      testId,
    )
  }
  if (vnode.props?.['data-testid'] === testId) return vnode
  const children = (vnode.props?.children ?? null) as unknown
  return findByTestId(children, testId)
}

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

  it('shows the stored avatar in place of the initials disc, decorative', () => {
    const html = renderCard({ imageUrl: '/api/users/user-1/avatar?v=abc' })
    assert.ok(html.includes('data-testid="public-profile-avatar"'))
    assert.ok(html.includes('src="/api/users/user-1/avatar?v=abc"'))
    // Decorative like the disc it replaces: the name sits beside it, so the
    // alt carries no text and a screen reader never hears the name twice.
    assert.equal(
      /alt="[^"]/.test(html),
      false,
      'the avatar must not announce text of its own',
    )
    assert.equal(html.includes('>D<'), false, 'no initials behind an image')
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

describe('AvatarPanel', () => {
  /** The full props the page renders the panel with. */
  type PanelProps = Parameters<typeof AvatarPanel>[0]

  /** A chosen-image stand-in the right size to assert the human KB hint. */
  const file = new File([new Uint8Array(8)], 'me.png', { type: 'image/png' })

  const base: PanelProps = {
    name: 'Dav',
    imageUrl: null,
    draftFile: null,
    draftError: null,
    busy: 'idle',
    error: null,
    status: null,
    onChoose: noop,
    onCancelDraft: noop,
    onUpload: noop,
    onRemove: noop,
  }

  const renderPanel = (overrides: Partial<PanelProps> = {}) =>
    render(<AvatarPanel {...base} {...overrides} />)

  it('shows the initials fallback when no photo is stored, and no Remove', () => {
    const html = renderPanel()
    assert.ok(html.includes('data-testid="avatar-initials"'))
    assert.ok(html.includes('>D<'))
    assert.equal(html.includes('data-testid="avatar-remove"'), false)
  })

  it('shows the stored photo with a Remove action', () => {
    const html = renderPanel({ imageUrl: '/api/users/u1/avatar?v=abc' })
    assert.ok(html.includes('data-testid="avatar-image"'))
    assert.ok(html.includes('src="/api/users/u1/avatar?v=abc"'))
    assert.ok(html.includes('data-testid="avatar-remove"'))
    assert.equal(html.includes('data-testid="avatar-initials"'), false)
  })

  it('binds the visible control to a focusable, accept-scoped file input', () => {
    const html = renderPanel()
    assert.ok(html.includes('id="avatar-file-input"'))
    assert.ok(html.includes('for="avatar-file-input"'), 'label targets input')
    assert.ok(html.includes('accept="image/png,image/jpeg,image/webp"'))
    assert.ok(html.includes('class="sr-only"'), 'focusable, not display-none')
  })

  it('names the chosen file with its size and offers Upload and Cancel', () => {
    const tree = AvatarPanel({ ...base, draftFile: file })
    const html = render(<AvatarPanel {...base} draftFile={file} />)
    assert.ok(html.includes('me.png'))
    assert.ok(html.includes('1 KB'), 'small files never read as 0 KB')
    assert.ok(html.includes('data-testid="avatar-upload"'))
    assert.ok(html.includes('data-testid="avatar-cancel-draft"'))
    const upload = findByTestId(tree, 'avatar-upload')
    assert.ok(upload, 'upload control rendered')
    // An acceptable draft keeps the write operable — checked on the control
    // itself, because Tailwind's `disabled:` variants make the class list
    // say "disabled" no matter what the control's state is.
    assert.equal(upload?.props?.disabled, false)
  })

  it('holds Upload back while the page reports a validation error', () => {
    const html = renderPanel({
      draftFile: file,
      draftError: 'Choose a PNG, JPEG or WebP image.',
    })
    assert.ok(html.includes('data-testid="avatar-draft-error"'))
    assert.ok(html.includes('Choose a PNG, JPEG or WebP image.'))
    const upload = findByTestId(
      AvatarPanel({
        ...base,
        draftFile: file,
        draftError: 'Choose a PNG, JPEG or WebP image.',
      }),
      'avatar-upload',
    )
    assert.equal(upload?.props?.disabled, true)
  })

  it('disables every control and renames the button while a write is in flight', () => {
    const html = renderPanel({ draftFile: file, busy: 'uploading' })
    assert.ok(html.includes('Uploading…'))
    const input = findByTestId(
      AvatarPanel({ ...base, draftFile: file, busy: 'uploading' }),
      'avatar-file-input',
    )
    assert.equal(input?.props?.disabled, true)
    const htmlRemoving = renderPanel({
      imageUrl: '/api/users/u1/avatar?v=abc',
      busy: 'removing',
    })
    assert.ok(htmlRemoving.includes('Removing…'))
  })

  it('surfaces the last outcome through status and alert roles', () => {
    const html = renderPanel({
      imageUrl: '/api/users/u1/avatar?v=abc',
      error: 'The image must be 512 KB or smaller.',
      status: 'Profile photo updated.',
    })
    assert.ok(html.includes('role="alert"'))
    assert.ok(html.includes('data-testid="avatar-error"'))
    assert.ok(html.includes('role="status"'))
    assert.ok(html.includes('data-testid="avatar-status"'))
  })

  it('reports a chosen file to the page and resets the picker for a re-choose', () => {
    let chosen: File | null = null
    const tree = AvatarPanel({ ...base, onChoose: (f) => (chosen = f) })
    const input = findByTestId(tree, 'avatar-file-input')
    assert.ok(input, 'file input rendered')
    const onChange = input?.props?.onChange as (event: unknown) => void
    const target = { files: [file], value: 'stale' }
    onChange({ currentTarget: target })
    assert.equal(chosen, file)
    assert.equal(target.value, '', 're-choosing the same file must re-report')
  })

  it('routes the controls to the page-owned transitions', () => {
    const calls: string[] = []
    const props: PanelProps = {
      ...base,
      imageUrl: '/api/users/u1/avatar?v=abc',
      draftFile: file,
      onUpload: () => calls.push('upload'),
      onCancelDraft: () => calls.push('cancel'),
      onRemove: () => calls.push('remove'),
    }
    const tree = AvatarPanel(props)
    const upload = findByTestId(tree, 'avatar-upload')
    ;(upload?.props?.onClick as () => void)()
    const cancel = findByTestId(tree, 'avatar-cancel-draft')
    ;(cancel?.props?.onClick as () => void)()
    const remove = findByTestId(tree, 'avatar-remove')
    ;(remove?.props?.onClick as () => void)()
    assert.deepEqual(calls, ['upload', 'cancel', 'remove'])
  })
})
