/**
 * The Decks page's appearance state — the pure half of SPEC §4.5's decision.
 *
 * Appearance on Decks is the same visual-treatment system the Graph Explorer
 * uses (`src/graph/appearance.ts`): one token set per treatment, applied as
 * `--graph-*` custom properties on a `data-treatment` wrapper. The one
 * difference is *how a treatment is chosen*: the deck is addressable, so the
 * canonical persistence mechanism is the `?treatment=` URL parameter — a
 * shared link reproduces the exact treatment, no account setting required.
 * `localStorage` is the *default* only: when no parameter is present, the
 * stored choice (from `trope-cards:graph-treatment`) applies; when there is no
 * stored choice either, the atmospheric default wins.
 *
 * The parameter always beats storage, so a shared link overrides whatever the
 * local browser remembers, and nothing here touches the global light/dark
 * theme (`ThemeProvider`) — a treatment switch repaints deck chrome, never the
 * site theme.
 */

import {
  type GraphTreatment,
  isGraphTreatment,
  readGraphTreatment,
} from '../graph/appearance'

/** The URL query parameter that addresses a deck treatment. */
export const DECK_TREATMENT_QUERY_KEY = 'treatment'

/** The fallback when neither the URL nor storage names a treatment. */
export const DECK_DEFAULT_TREATMENT: GraphTreatment = 'atmospheric'

/**
 * Resolve the deck's treatment with URL-then-storage precedence.
 *
 * A valid `?treatment=` value wins outright (a shared link is reproducible);
 * otherwise the persisted choice — validated, never trusted — applies; and a
 * browser with no usable storage still gets the default, never a throw.
 *
 * @param rawParam The raw `?treatment=` value, or `null`/`undefined`.
 * @param storage A `Storage`-like reader, or `null` when unavailable.
 * @returns A valid {@link GraphTreatment}.
 * @example
 * ```ts
 * parseDeckTreatment('editorial', null) // 'editorial'
 * parseDeckTreatment('bogus', reader)   // the stored choice, or 'atmospheric'
 * parseDeckTreatment(undefined, null)   // 'atmospheric'
 * ```
 */
export function parseDeckTreatment(
  rawParam: string | null | undefined,
  storage: Pick<Storage, 'getItem'> | null,
): GraphTreatment {
  if (isGraphTreatment(rawParam)) return rawParam
  return readGraphTreatment(storage)
}
