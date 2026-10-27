/**
 * The application route table.
 *
 * Kept as exported data rather than inline JSX for one reason: the routing
 * contract — `/` is the discovery deck, `/legacy/deck` is the retired flat deck,
 * and every header destination resolves to a real surface — must be assertable
 * in tests. The UI test harness renders to string and has no browser-router
 * context, so `App` maps this table into `<Route>` elements and the tests run
 * react-router's own matcher (`matchRoutes`) over the same table.
 *
 * Ordering matters only for the catch-all: `*` must stay last so it is the
 * lowest-ranked match. Every other entry is a distinct, exact path.
 */

import type { VNode } from 'preact'
import About from '@/pages/About'
import Account from '@/pages/Account'
import AccountActivity from '@/pages/AccountActivity'
import AccountSettings from '@/pages/AccountSettings'
import Admin from '@/pages/Admin'
import AdminDiscovery from '@/pages/AdminDiscovery'
import Compose from '@/pages/Compose'
import Deck from '@/pages/Deck'
import Explore from '@/pages/Explore'
import ForgotPassword, { FORGOT_PASSWORD_PATH } from '@/pages/ForgotPassword'
import Graph from '@/pages/Graph'
import LegacyDeck from '@/pages/LegacyDeck'
import NotFound from '@/pages/NotFound'
import Onboarding from '@/pages/Onboarding'
import Privacy from '@/pages/Privacy'
import Research from '@/pages/Research'
import ResetPassword, { RESET_PASSWORD_PATH } from '@/pages/ResetPassword'
import Resources from '@/pages/Resources'
import SignIn from '@/pages/SignIn'
import SignUp from '@/pages/SignUp'
import Sources from '@/pages/Sources'
import Terms from '@/pages/Terms'

/** A single route: a react-router path pattern and the element it renders. */
export interface AppRoute {
  path: string
  element: VNode
}

/**
 * Every route the app serves, in match order (catch-all `*` last).
 *
 * `/` → {@link Deck} is the canonical first landing; `/legacy/deck` →
 * {@link LegacyDeck} is preserved for comparison but is intentionally not a
 * header destination (see `components/Header.tsx`).
 */
export const APP_ROUTES: readonly AppRoute[] = [
  { path: '/', element: <Deck /> },
  { path: '/legacy/deck', element: <LegacyDeck /> },
  { path: '/explore', element: <Explore /> },
  { path: '/research', element: <Research /> },
  { path: '/research/compose', element: <Compose /> },
  { path: '/sources', element: <Sources /> },
  { path: '/resources', element: <Resources /> },
  { path: '/about', element: <About /> },
  { path: '/privacy', element: <Privacy /> },
  { path: '/terms', element: <Terms /> },
  { path: '/graph', element: <Graph /> },
  { path: '/admin', element: <Admin /> },
  { path: '/admin/discovery', element: <AdminDiscovery /> },
  { path: '/sign-in', element: <SignIn /> },
  { path: '/sign-up', element: <SignUp /> },
  { path: FORGOT_PASSWORD_PATH, element: <ForgotPassword /> },
  { path: RESET_PASSWORD_PATH, element: <ResetPassword /> },
  { path: '/account', element: <Account /> },
  { path: '/account/activity', element: <AccountActivity /> },
  { path: '/account/settings', element: <AccountSettings /> },
  { path: '/onboarding', element: <Onboarding /> },
  { path: '*', element: <NotFound /> },
]
