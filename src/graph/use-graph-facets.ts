/**
 * `useGraphFacetFilter` — the facet filter shared by the controls strip and the
 * projection area.
 *
 * The controls strip edits the filter and the workspace consumes it, so the
 * state has to sit above both. It is keyed to the projection's scope
 * (focus/view/depth): a new scope loads a different corpus, and a facet the new
 * projection may not satisfy must go inert rather than silently hide every
 * node. Facets are derived from the *loaded* (unfiltered) projection, so the
 * navigator always describes what the layer contains.
 */

import { useCallback, useState } from 'preact/hooks'
import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'
import {
  deriveFacets,
  EMPTY_DECK_FACETS,
  type FacetFilter,
  NO_FACET_FILTER,
} from './deck-facets'
import type { GraphParams } from './query-params'

/** A projection scope string; a change resets the filter. */
function scopeKey(params: GraphParams): string {
  return `${params.focus ?? ''}|${params.view ?? ''}|${params.depth ?? ''}`
}

/**
 * The facet state for one projection scope.
 *
 * @param params The URL-derived params addressing the projection.
 * @param projection The loaded projection, or `undefined` until it lands.
 * @returns Facets for the controls strip, the active filter, and its setters.
 */
export function useGraphFacetFilter(
  params: GraphParams,
  projection: GraphProjection | undefined,
) {
  const key = scopeKey(params)
  const [state, setState] = useState<{ key: string; filter: FacetFilter }>({
    key,
    filter: NO_FACET_FILTER,
  })

  const filter = state.key === key ? state.filter : NO_FACET_FILTER
  const setFilter = useCallback(
    (next: FacetFilter) => setState({ key, filter: next }),
    [key],
  )
  const clear = useCallback(() => setFilter(NO_FACET_FILTER), [setFilter])

  const facets =
    projection !== undefined ? deriveFacets(projection) : EMPTY_DECK_FACETS

  return { facets, filter, setFilter, clear }
}
