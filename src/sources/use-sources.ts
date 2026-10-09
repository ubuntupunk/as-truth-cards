/**
 * The Sources query hook — the canonical source index.
 *
 * One read, one key. `GET /api/graph/sources` returns every canonical source,
 * title-ordered, with the attribution count the page shows. The hook shares the
 * graph layer's `fetchValidated` path so a `400`/`500` decodes to
 * {@link GraphApiError} and a `200` that fails validation raises
 * {@link ProjectionShapeError} — never a thrown string, never a silently-empty
 * index. There is deliberately no per-source endpoint: a source's provenance
 * neighbourhood is a projection (`view=evidence`), not a second list read.
 */

import { useQuery } from '@tanstack/react-query'
import {
  assertSourcesResponse,
  type SourcesResponse,
} from '../graph/projection-guards'
import { fetchValidated } from '../graph/use-graph'

/** React Query key for the canonical source index. */
export const SOURCES_QUERY_KEY = ['graph', 'sources'] as const

/**
 * The canonical source index (`GET /api/graph/sources`).
 *
 * @returns A TanStack Query result whose `data` is a validated
 * {@link SourcesResponse} once loaded.
 */
export function useSources() {
  return useQuery<SourcesResponse>({
    queryKey: SOURCES_QUERY_KEY,
    queryFn: () => fetchValidated('/api/graph/sources', assertSourcesResponse),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
