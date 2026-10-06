/**
 * TanStack Query hooks for the graph API.
 *
 * Thin on purpose. Every behavioural rule this page needs — which URL, what
 * key, whether the query is even enabled, how the two error classes map to
 * states — lives here so `pages/Graph.tsx` only composes results. The hooks
 * share one `fetchValidated` path that both guards the shape *and* decodes
 * server error bodies, which is why a 400 with `{ error, detail }` arrives as
 * {@link GraphApiError} and an HTML error page arrives as
 * {@link ProjectionShapeError} — never as a thrown string and never as a
 * silently-empty projection.
 *
 * `useQuery` (from `@tanstack/react-query` via the preact/compat alias in
 * `vite.config.ts`) is the same store `pages/Admin.tsx` uses; the graph query
 * key is namespaced under `['graph', …]` so it cannot collide with the
 * existing `['cards']` key space.
 */

import { useQuery } from '@tanstack/react-query'
import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'
import {
  assertGraphProjection,
  assertGraphViewsResponse,
  type GraphViewsResponse,
  isRecord,
  ProjectionShapeError,
} from './projection-guards'
import { type GraphParams, serializeGraphParams } from './query-params'

/** React Query key for the `GET /api/graph/views` catalogue query. */
export const GRAPH_VIEWS_QUERY_KEY = ['graph', 'views'] as const

/**
 * The React Query key for one projection request.
 *
 * The key mirrors the request exactly (focus/view/depth) so a parameter
 * change refetches, and two identical parameter sets share cache instead of
 * re-hitting the API. When `focus` is `null` the query is disabled, but the
 * key is still deterministic — required because the hook always evaluates.
 *
 * @param params The params whose serialization defines the key.
 * @returns A stable `['graph', 'projection', focus, view, depth]` tuple.
 */
export function graphProjectionQueryKey(
  params: GraphParams,
): readonly unknown[] {
  return [
    'graph',
    'projection',
    params.focus,
    params.view ?? null,
    params.depth ?? null,
  ]
}

/**
 * A decoded non-2xx response from the graph API.
 *
 * Carries the server's own `error` (human-readable) and optional `detail`
 * (technical) strings, plus the HTTP status, so the page can differentiate
 * the "didn't validate" 400s/413s from the "not found" 404s and still show
 * both the friendly message and the status code.
 */
export class GraphApiError extends Error {
  /** HTTP status of the failed response. */
  readonly status: number
  /** The server's technical `detail` field, when present (`404`/`500` only). */
  readonly detail: string | null

  constructor(status: number, message: string, detail: string | null) {
    super(message)
    this.name = 'GraphApiError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Fetch a URL and validate its JSON body against a shape guard.
 *
 * The shared read path for both hooks. A non-2xx response is decoded as
 * `{ error?, detail? }` when possible and thrown as {@link GraphApiError}; a
 * 2xx response whose body fails validation throws {@link ProjectionShapeError};
 * a 2xx response that is not JSON at all is treated as malformed, because an
 * error-page-with-200 should still reach the "malformed response" state.
 *
 * @param url The endpoint to fetch.
 * @param validate A presence-level shape guard from `projection-guards.ts`.
 * @returns The validated body. Rejects with {@link GraphApiError} or
 * {@link ProjectionShapeError}.
 */
export async function fetchValidated<T>(
  url: string,
  validate: (value: unknown) => asserts value is T,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new GraphApiError(
      0,
      'Network error: the graph API is unreachable',
      null,
    )
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === 'string'
        ? body.error
        : `Request failed with HTTP ${response.status}`
    const detail =
      isRecord(body) && typeof body.detail === 'string' ? body.detail : null
    throw new GraphApiError(response.status, message, detail)
  }

  if (body === null) {
    throw new ProjectionShapeError('response', 'body is not valid JSON')
  }

  validate(body)
  return body
}

/**
 * The view catalogue (`GET /api/graph/views`).
 *
 * Not gated on focus: the page needs the descriptors (for the view/depth
 * selects and the legend) even before the user has chosen a node.
 *
 * @returns A TanStack Query result whose `data` is a validated
 * {@link GraphViewsResponse} once loaded.
 */
export function useGraphViews() {
  return useQuery<GraphViewsResponse>({
    queryKey: GRAPH_VIEWS_QUERY_KEY,
    queryFn: () => fetchValidated('/api/graph/views', assertGraphViewsResponse),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The options for one projection query.
 *
 * Extracted from the hook so the gating rule (disabled until a focus is set)
 * is a plain, testable value instead of something an integration suite can
 * only observe through a running QueryClient.
 *
 * @param params The current URL-derived params.
 * @returns The `useQuery` options for the projection query.
 */
export function graphProjectionQueryOptions(params: GraphParams) {
  const search = serializeGraphParams(params)
  return {
    queryKey: graphProjectionQueryKey(params),
    queryFn: () =>
      fetchValidated(`/api/graph?${search}`, assertGraphProjection),
    enabled: params.focus !== null,
    retry: false,
    staleTime: 30_000,
  }
}

/**
 * One projection (`GET /api/graph?focus=…&view=…&depth=…`).
 *
 * Disabled until `focus` is set: without a focus node there is no projection
 * to ask for, and the page shows the no-focus state instead. `retry: false`
 * keeps a 400/404/413 from making the user stare at a spinner while
 * react-query retries a request that will never succeed.
 *
 * @param params The current URL-derived params.
 * @returns A TanStack Query result whose `data` is a validated
 * {@link GraphProjection} once loaded.
 */
export function useGraphProjection(params: GraphParams) {
  return useQuery(graphProjectionQueryOptions(params))
}
