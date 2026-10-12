/**
 * Route-level error containment for the application route table.
 *
 * `App` maps `APP_ROUTES` into `<Route>` elements; wrapping each element here —
 * rather than inside `app-routes.tsx` — keeps the route table itself the plain,
 * assertable data the routing contract tests rely on (`app-routes.test.tsx`
 * matches on `APP_ROUTES` and expects `resolved('/').type` to be `Deck`). Each
 * route gets its own boundary keyed by path, so a crash in one view shows that
 * route's fallback and leaves the rest of the app untouched.
 *
 * Pure: builds a vnode tree, touches no DOM, so it is unit-testable without a
 * browser.
 */

import type { VNode } from 'preact'
import type { AppRoute } from '@/app-routes'
import { ErrorBoundary, type ErrorBoundaryProps } from './error-boundary'

/**
 * Wrap one route's element in its own {@link ErrorBoundary}.
 *
 * @param route A path and the element the router renders for it.
 * @returns The element guarded by a boundary labelled with the route path.
 */
export function withRouteBoundary(route: AppRoute): VNode<ErrorBoundaryProps> {
  return <ErrorBoundary label={route.path}>{route.element}</ErrorBoundary>
}
