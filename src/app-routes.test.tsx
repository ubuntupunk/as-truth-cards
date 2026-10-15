/**
 * Tests for the application routing contract (ROADMAP Milestone 1:
 * "route/navigation tests").
 *
 * These are the assertions the sprint close-out flagged as missing: that `/`
 * renders the canonical discovery {@link Deck}, that `/legacy/deck` still
 * renders the retired {@link LegacyDeck}, that unknown paths fall to the
 * catch-all, and that the legacy route stays *out of* the header navigation
 * while every header destination stays *routable*.
 *
 * The harness renders to string and has no router context, so rather than mount
 * a `BrowserRouter` the tests run react-router's own matcher (`matchRoutes`, a
 * pure function) over the exact `APP_ROUTES` table `App` maps into `<Route>`s.
 * That exercises the real path-matching logic, not a re-implementation of it.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VNode } from 'preact'
import { matchRoutes, type RouteObject } from 'react-router-dom'
import { APP_ROUTES } from './app-routes'
import { NAV_ENTRIES } from './components/Header'
import Deck from './pages/Deck'
import ForgotPassword, { FORGOT_PASSWORD_PATH } from './pages/ForgotPassword'
import LegacyDeck from './pages/LegacyDeck'
import NotFound from './pages/NotFound'
import ResetPassword, { RESET_PASSWORD_PATH } from './pages/ResetPassword'

const routeObjects: RouteObject[] = APP_ROUTES.map(({ path, element }) => ({
  path,
  element,
}))

/** The element react-router resolves for `pathname`, via its real matcher. */
function resolved(pathname: string): VNode {
  const matches = matchRoutes(routeObjects, pathname)
  assert.ok(matches && matches.length > 0, `expected a match for ${pathname}`)
  return matches[matches.length - 1].route.element as VNode
}

describe('application route table', () => {
  it('renders the canonical discovery deck at the root', () => {
    assert.equal(resolved('/').type, Deck)
  })

  it('keeps the retired flat deck behind /legacy/deck', () => {
    assert.equal(resolved('/legacy/deck').type, LegacyDeck)
  })

  it('does not resolve the canonical deck on the legacy path', () => {
    assert.notEqual(resolved('/legacy/deck').type, Deck)
  })

  it('sends unknown paths to the catch-all, not the deck', () => {
    assert.equal(resolved('/no-such-page').type, NotFound)
  })

  it('lists each path once and ends with the catch-all', () => {
    const paths = APP_ROUTES.map((route) => route.path)
    assert.equal(new Set(paths).size, paths.length)
    assert.equal(APP_ROUTES[APP_ROUTES.length - 1].path, '*')
  })

  it('resolves every header destination to a real surface', () => {
    for (const entry of NAV_ENTRIES) {
      assert.notEqual(
        resolved(entry.path).type,
        NotFound,
        `${entry.path} fell through to the catch-all`,
      )
    }
  })

  it('serves the password-reset surfaces at their shared path constants', () => {
    assert.equal(resolved(FORGOT_PASSWORD_PATH).type, ForgotPassword)
    assert.equal(resolved(RESET_PASSWORD_PATH).type, ResetPassword)
  })
})

describe('legacy deck discoverability', () => {
  it('does not surface the legacy deck in the header navigation', () => {
    const navPaths = NAV_ENTRIES.map((entry) => entry.path)
    assert.equal(navPaths.includes('/legacy/deck'), false)
  })

  it('offers the canonical deck route as a header destination', () => {
    const navPaths = NAV_ENTRIES.map((entry) => entry.path)
    assert.equal(navPaths.includes('/'), true)
  })
})
