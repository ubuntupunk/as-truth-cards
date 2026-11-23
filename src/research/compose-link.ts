/**
 * Compose deep link for a focused card in the research session.
 *
 * A research entry stores a canonical uuid; Compose addresses a card by its corpus
 * slug. Only entries that actually carry a card slug can produce a link — every
 * other entry type returns `null` rather than guessing a destination. The link also
 * carries a safe `returnTo` so the author can resume the research workspace after
 * authoring or signing in.
 */

import { safeReturnTo } from '@/auth/journey'
import type { ResearchEntry } from './research-session'

/**
 * Build the Compose URL for a research-session card entry.
 *
 * @param entry The focused entry, which must be a card with a known slug.
 * @param returnTo The research location to return to (untrusted query value).
 * @returns The Compose URL, or `null` when this entry cannot be composed.
 * @example
 * ```ts
 * composeHrefForEntry(cardEntry, '/research?focus=uuid-1')
 * // => '/research/compose?card=id-01&returnTo=%2Fresearch%3Ffocus%3Duuid-1'
 * ```
 */
export function composeHrefForEntry(
  entry: ResearchEntry,
  returnTo: string,
): string | null {
  if (entry.type !== 'card') return null
  if (entry.slug === undefined || entry.slug === '') return null
  const destination = safeReturnTo(returnTo, '/research')
  return `/research/compose?card=${encodeURIComponent(entry.slug)}&returnTo=${encodeURIComponent(destination)}`
}
