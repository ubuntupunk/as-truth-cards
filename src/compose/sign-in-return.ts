/**
 * Build the sign-in handoff for the Compose surface.
 *
 * Compose saves are account-bound. The editor's 401 is the signed-out state, so the
 * handoff must send the reader to sign-in **and** bring them back to the exact card
 * they were authoring, including its query string. The destination is derived from
 * the app's own current location and passed through {@link safeReturnTo}, so a
 * tampered query value can never produce an off-origin redirect.
 */

import { safeReturnTo } from '@/auth/journey'

/**
 * Compose sign-in URL preserving the current route and card selection.
 *
 * @param currentLocation The app's current `pathname + search` (trusted input).
 * @returns A same-origin `/sign-in?returnTo=…` URL.
 * @example
 * ```ts
 * composeSignInHref('/research/compose?card=id-01')
 * // => '/sign-in?returnTo=%2Fresearch%2Fcompose%3Fcard%3Did-01'
 * ```
 */
export function composeSignInHref(currentLocation: string): string {
  const destination = safeReturnTo(currentLocation, '/research/compose')
  return `/sign-in?returnTo=${encodeURIComponent(destination)}`
}
