/**
 * `GraphWorkspace` — the projection area shared by the Graph Explorer and the
 * Research Workspace.
 *
 * Both pages render the *same* authoritative projection the *same* way; the
 * only difference between them is the chrome around it and what a focus is kept
 * for. So the state machine — no-focus / loading / malformed / API-error /
 * empty / rendered, plus presentation-only selection — lives here once, and each
 * page supplies the queries, the facet filter it shares with the controls strip,
 * and the navigation callbacks. That keeps the honesty ordering (SPEC §9.1)
 * from drifting between two copies.
 *
 * Facet filtering stays presentation-only: the canvas and inspector read the
 * filtered projection, while notices and the status strip read the original,
 * because corpus facts are not facets of browsing. The filter itself is owned by
 * the page (the controls strip edits it too, above this component); this
 * component only applies it. Selection that a filter hides is reported as no
 * selection rather than a stale "missing" id.
 */

import type { StylesheetJsonBlock } from 'cytoscape'
import { useState } from 'preact/hooks'
import {
  CytoscapeAdapterError,
  toCytoscapePresentation,
} from '../../trope-cards/src/graph/cytoscape-adapter.ts'
import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'
import { DEFAULT_DEPTH } from '../../trope-cards/src/graph/views.ts'
import { CytoscapeGraph } from './cytoscape-graph'
import { applyFacetFilter, type FacetFilter } from './deck-facets'
import {
  EntityInspector,
  type InspectorSelection,
  type RefocusTarget,
} from './entity-inspector'
import {
  ApiErrorState,
  EmptyProjectionState,
  FilteredEmptyState,
  LoadingState,
  MalformedState,
  NoFocusState,
  ProjectionNotices,
} from './graph-states'
import {
  type GraphViewDescriptor,
  ProjectionShapeError,
} from './projection-guards'
import { clampDepth, type GraphParams } from './query-params'

/**
 * The projection area.
 *
 * @param props.params The URL-derived params addressing the projection.
 * @param props.projection The loaded projection, or `undefined` until it lands.
 * @param props.isPending Whether the projection request is in flight.
 * @param props.error The projection request's error, or `null`.
 * @param props.descriptor The selected view's descriptor, when known.
 * @param props.stylesheet The treatment stylesheet for the canvas.
 * @param props.facetFilter The page-owned, presentation-only facet filter.
 * @param props.onClearFacets Called by the filtered-empty escape hatch.
 * @param props.onNavigateCard Called with a card slug when "Open card" is used.
 * @param props.onRefocus Called with a node id and refocusable type to refocus.
 * @returns The matching state component, or the graph + inspector grid.
 */
export function GraphWorkspace({
  params,
  projection,
  isPending,
  error,
  descriptor,
  stylesheet,
  facetFilter,
  onClearFacets,
  onNavigateCard,
  onRefocus,
}: {
  params: GraphParams
  projection: GraphProjection | undefined
  isPending: boolean
  error: Error | null
  descriptor: GraphViewDescriptor | null
  stylesheet: StylesheetJsonBlock[]
  facetFilter: FacetFilter
  onClearFacets: () => void
  onNavigateCard: (slug: string) => void
  onRefocus: (id: string, type: RefocusTarget) => void
}) {
  const [selection, setSelection] = useState<InspectorSelection>(null)

  const filteredProjection =
    projection !== undefined
      ? applyFacetFilter(projection, facetFilter)
      : undefined

  const maxDepth = descriptor?.maxDepth ?? DEFAULT_DEPTH
  const selectedDepth = clampDepth(params.depth, maxDepth) ?? DEFAULT_DEPTH

  const presentation = (() => {
    if (
      filteredProjection === undefined ||
      filteredProjection.nodes.length === 0
    ) {
      return null
    }
    try {
      return toCytoscapePresentation(filteredProjection)
    } catch (caught) {
      return caught instanceof CytoscapeAdapterError ? caught : null
    }
  })()

  // A selection the filter hid is shown as no selection: the inspector would
  // otherwise report a stale id as "missing" on a projection it is merely
  // filtered out of.
  const visibleSelection = (() => {
    if (selection === null || filteredProjection === undefined) return null
    const present =
      selection.kind === 'node'
        ? filteredProjection.nodes.some((node) => node.id === selection.id)
        : filteredProjection.edges.some((edge) => edge.id === selection.id)
    return present ? selection : null
  })()

  const navigateToCard = (slug: string) => {
    setSelection(null)
    onNavigateCard(slug)
  }

  const refocusEntity = (id: string, type: RefocusTarget) => {
    setSelection(null)
    onRefocus(id, type)
  }

  if (params.focus === null) return <NoFocusState />

  if (isPending) {
    return <LoadingState labelled="Expanding the neighbourhood…" />
  }

  if (error instanceof ProjectionShapeError) {
    return <MalformedState error={error} />
  }
  if (error !== null) {
    return <ApiErrorState error={error} />
  }
  if (projection === undefined) return null

  if (presentation instanceof CytoscapeAdapterError) {
    return <MalformedState error={presentation} />
  }
  if (projection.meta.nodeCount === 0) {
    return <EmptyProjectionState projection={projection} />
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-3">
        <ProjectionNotices
          projection={projection}
          requestedDepth={selectedDepth}
        />
        {filteredProjection !== undefined &&
        filteredProjection.nodes.length === 0 ? (
          <FilteredEmptyState filter={facetFilter} onClear={onClearFacets} />
        ) : (
          <div className="h-[460px] md:h-[560px] overflow-hidden rounded-xl border border-graph-border bg-graph-canvas">
            {presentation ? (
              <CytoscapeGraph
                presentation={presentation}
                selectedId={visibleSelection?.id ?? null}
                onSelect={setSelection}
                style={stylesheet}
              />
            ) : null}
          </div>
        )}
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <EntityInspector
          projection={filteredProjection ?? projection}
          selection={visibleSelection}
          onNavigateCard={navigateToCard}
          onRefocus={refocusEntity}
          descriptor={descriptor}
        />
      </div>
    </div>
  )
}
