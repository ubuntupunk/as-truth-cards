/**
 * URL search params ⇄ `/api/graph` query params.
 *
 * The Graph page keeps `focus`, `view` and `depth` in the URL so a projection is
 * shareable, bookmarkable and back-button navigable. This module is the single
 * translation layer between that URL state and the query object the fetch layer
 * serialises; nothing else in `src/graph/` parses or formats query strings.
 *
 * Parameter names match the server's `parseGraphQuery` keys exactly (`focus`,
 * `view`, `depth`) so the same serializer feeds both the router and the API
 * request. That is deliberate: a rename on either side becomes a failing test
 * here rather than a silent mismatch.
 *
 * Defaults are *omitted*, not materialised. A URL with no `depth` produces a
 * request with no `depth`, and the server applies its own `DEFAULT_DEPTH` —
 * the client never hard-codes a default that could drift from
 * `trope-cards/src/graph/views.ts`.
 */

/** The three parameters that address a projection. `null` means "absent: use the server default". */
export type GraphParams = {
  /** Card uuid or kebab-case slug. Absent means "no focus selected". */
  readonly focus: string | null
  /** View name. Absent means the server default view. */
  readonly view: string | null
  /** Hop count. Absent means the server default depth. */
  readonly depth: number | null
}

/** The params of a URL with no graph state. */
export const EMPTY_GRAPH_PARAMS: GraphParams = {
  focus: null,
  view: null,
  depth: null,
}

/**
 * Parse graph params out of a URL query string.
 *
 * Tolerates both a raw string (`location.search`) and a `URLSearchParams`.
 * Repeated parameters take the first value rather than erroring: the server
 * rejects those with a 400, and a hand-edited URL is a client-side concern —
 * if it is malformed enough to matter, the API error state will surface it.
 *
 * @param search `location.search`, a serialized query string, or `URLSearchParams`.
 * @returns The parsed params; each field is `null` when absent or unusable.
 * @example
 * ```ts
 * parseGraphParams('?focus=jesus-was-a-zionist&depth=2')
 * // { focus: 'jesus-was-a-zionist', view: null, depth: 2 }
 * parseGraphParams('') // { focus: null, view: null, depth: null }
 * ```
 */
export function parseGraphParams(
  search: string | URLSearchParams,
): GraphParams {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search

  const focus = trimmedOrNull(params.get('focus'))
  const view = trimmedOrNull(params.get('view'))
  const depth = parseDepthParam(params.get('depth'))

  return { focus, view, depth }
}

/**
 * Serialize params back into a query string (no leading `?`).
 *
 * `null` fields are omitted so the URL stays minimal and the server sees only
 * the parameters the user actually chose. Insertion order is fixed
 * (`focus`, `view`, `depth`) so two equivalent states serialize identically —
 * which is what lets the React Query key derived from this string be stable.
 *
 * @param params The params to serialize.
 * @returns A `focus=…&view=…&depth=…` string, URL-encoded, possibly empty.
 * @example
 * ```ts
 * serializeGraphParams({ focus: 'slugged-card', view: null, depth: 0 })
 * // 'focus=slugged-card&depth=0'
 * ```
 */
export function serializeGraphParams(params: GraphParams): string {
  const out = new URLSearchParams()
  if (params.focus !== null) out.set('focus', params.focus)
  if (params.view !== null) out.set('view', params.view)
  if (params.depth !== null) out.set('depth', String(params.depth))
  return out.toString()
}

/**
 * Clamp a depth to `[0, maxDepth]`.
 *
 * Used before sending a depth that came from a URL the user may have edited by
 * hand, so the request is capped by the selected descriptor's own `maxDepth`
 * instead of earning a 413 from the server. `null` passes through untouched —
 * "absent" is not the same as "0" and must stay absent.
 *
 * @param depth The candidate depth, or `null`.
 * @param maxDepth The selected view descriptor's `maxDepth`.
 * @returns The clamped integer depth, or `null` when `depth` was `null`.
 * @example
 * ```ts
 * clampDepth(9, 3) // 3
 * clampDepth(-1, 3) // 0
 * clampDepth(null, 3) // null
 * ```
 */
export function clampDepth(
  depth: number | null,
  maxDepth: number,
): number | null {
  if (depth === null) return null
  const ceiling = Math.max(0, Math.floor(maxDepth))
  return Math.min(Math.max(0, Math.floor(depth)), ceiling)
}

/**
 * The selectable depths for a view: `0 … maxDepth`.
 *
 * Depth 0 is a legitimate, meaningful choice — the focus node alone — so it is
 * always offered. The result is capped by the descriptor and never exceeds the
 * server's hard cap, because a descriptor cannot exceed it either.
 *
 * @param maxDepth The selected view descriptor's `maxDepth`.
 * @returns `[0, 1, …, clampedMaxDepth]`.
 * @example
 * ```ts
 * depthOptions(3) // [0, 1, 2, 3]
 * ```
 */
export function depthOptions(maxDepth: number): number[] {
  const ceiling = Math.max(0, Math.floor(maxDepth))
  return Array.from({ length: ceiling + 1 }, (_, index) => index)
}

/** Trim a raw param value; empty-after-trim becomes absent. */
function trimmedOrNull(raw: string | null): string | null {
  if (raw === null) return null
  const value = raw.trim()
  return value.length > 0 ? value : null
}

/**
 * Parse the depth param.
 *
 * Non-numeric or negative input yields `null` (absent → server default)
 * rather than a 400: depth is a control the user drives, and a stale or
 * hand-edited URL should degrade to the default instead of erroring the
 * whole projection. Focus has no such leniency — it is identity, and the
 * server's 400/404 for a bad focus is the correct behaviour.
 */
function parseDepthParam(raw: string | null): number | null {
  const value = trimmedOrNull(raw)
  if (value === null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}
