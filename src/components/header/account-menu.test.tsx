/**
 * Tests for the header account menu (`62:11735`).
 *
 * The menu is the one place a signed-in reader can see their role, so the two
 * things worth pinning down are honesty and reachability:
 *
 * - Every destination is a served route. The menu must not grow a dead link.
 * - The copy describes what the product does. The mockup's "History, ratings and
 *   feedback" and "Verified researcher" are not capabilities the account has, so
 *   neither phrase may appear.
 *
 * `AccountMenuPanel` takes an injected link renderer, which is what lets this
 * render without a router the SSR harness cannot supply.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { roleLabel } from '@/account/role-label'
import { APP_ROUTES } from '@/app-routes'
import { GRAPH_TREATMENT_LABELS } from '@/graph/appearance'
import {
  ACCOUNT_MENU_ITEMS,
  AccountMenuPanel,
  type MenuLinkProps,
} from './account-menu'

/** A plain anchor standing in for the router's `Link`. */
const StubLink = ({ to, className, onClick, children }: MenuLinkProps) => (
  <a href={to} className={className} onClick={onClick}>
    {children}
  </a>
)

/** Render the panel with sensible defaults, overriding what a test cares about. */
function renderPanel(
  overrides: Partial<Parameters<typeof AccountMenuPanel>[0]> = {},
): string {
  return render(
    <AccountMenuPanel
      name="Dana Whitfield"
      email="dana@example.org"
      imageUrl={null}
      accountRole="RESEARCHER"
      treatment="atmospheric"
      onSelectTreatment={() => undefined}
      onSignOut={() => undefined}
      onNavigate={() => undefined}
      link={StubLink}
      {...overrides}
    />,
  )
}

describe('account menu destinations', () => {
  const servedPaths = new Set(APP_ROUTES.map((route) => route.path))

  it('only points at routes the app serves', () => {
    for (const item of ACCOUNT_MENU_ITEMS) {
      assert.ok(
        servedPaths.has(item.path),
        `${item.label} points at ${item.path}, which is not in APP_ROUTES`,
      )
    }
  })

  it('lists profile, activity, saved cards and settings once each', () => {
    assert.deepEqual(
      ACCOUNT_MENU_ITEMS.map((item) => item.path),
      ['/account', '/account/activity', '/account/saved', '/account/settings'],
    )
  })

  it('puts settings below the divider', () => {
    const groups = ACCOUNT_MENU_ITEMS.map((item) => item.group)
    assert.equal(groups[groups.length - 1], 'settings')
  })

  it('does not promise ratings, history or feedback the account lacks', () => {
    for (const item of ACCOUNT_MENU_ITEMS) {
      const copy = `${item.label} ${item.description}`.toLowerCase()
      assert.equal(copy.includes('rating'), false, `${item.label}: rating`)
      assert.equal(copy.includes('feedback'), false, `${item.label}: feedback`)
      assert.equal(copy.includes('history'), false, `${item.label}: history`)
    }
  })
})

describe('role labels', () => {
  it('maps every server role to a human label', () => {
    assert.equal(roleLabel('ANONYMOUS'), 'Anonymous')
    assert.equal(roleLabel('VERIFIED'), 'Verified')
    assert.equal(roleLabel('ACADEMIC'), 'Academic')
    assert.equal(roleLabel('RESEARCHER'), 'Researcher')
    assert.equal(roleLabel('MODERATOR'), 'Moderator')
    assert.equal(roleLabel('ADMIN'), 'Admin')
  })

  it('falls back to Anonymous rather than rendering an empty badge', () => {
    assert.equal(roleLabel(undefined), 'Anonymous')
    assert.equal(roleLabel('VERIFIED_RESEARCHER'), 'Anonymous')
  })
})

describe('AccountMenuPanel', () => {
  it('shows the real role and does not call the reader a verified researcher', () => {
    const html = renderPanel()
    assert.match(html, /Researcher/)
    assert.equal(html.includes('Verified researcher'), false)
  })

  it('states that role is account access, not research standing', () => {
    const html = renderPanel()
    assert.match(html, /Role describes account access, not research standing/)
    assert.match(html, /not research evidence/)
  })

  it('renders every menu destination as a link', () => {
    const html = renderPanel()
    for (const item of ACCOUNT_MENU_ITEMS) {
      assert.match(html, new RegExp(`href="${item.path}"`))
      assert.match(html, new RegExp(item.label))
    }
  })

  it('renders the three appearance treatments', () => {
    const html = renderPanel()
    for (const label of Object.values(GRAPH_TREATMENT_LABELS)) {
      assert.match(html, new RegExp(`>${label}<`))
    }
  })

  it('offers sign out', () => {
    assert.match(renderPanel(), /Sign out/)
    assert.match(renderPanel({ signingOut: true }), /Signing out/)
  })

  it('falls back to the email initial when no name is set', () => {
    const html = renderPanel({ name: '' })
    assert.match(html, /account-menu-initials[\s\S]*>D</)
  })

  it('prefers the stored avatar over initials', () => {
    const html = renderPanel({ imageUrl: 'https://example.org/a.png' })
    assert.match(html, /account-menu-avatar/)
    assert.equal(html.includes('account-menu-initials'), false)
  })
})
