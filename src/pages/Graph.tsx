/**
 * The Graph page: the Graph Explorer over `/api/graph`.
 *
 * Orchestration only, and small on purpose. URL state (`focus`/`view`/`depth`)
 * is translated by `query-params.ts`, the two API reads live in
 * `use-graph.ts`, every screen state is `graph-states.tsx`, the semantic side
 * panel is `entity-inspector.tsx`, and the only canvas code is the thin
 * `cytoscape-graph.tsx` mount. The page chrome — heading, disclaimer, control
 * strip, workspace, status strip — is composed through `GraphShell`, and the
 * appearance treatments come from `appearance.ts`, applied by the shell's
 * inline `--graph-*` variables plus the Cytoscape stylesheet rebuilt per
 * treatment. This file wires them together and decides which state is on
 * screen — it computes no graph semantics itself.
 *
 * State order (each case short-circuits the ones after it):
 *
 * 1. No focus → {@link NoFocusState}; the controls still render so a graph is
 *    *obviously* available.
 * 2. Projection in flight → {@link LoadingState}.
 * 3. Projection rejected with a shape error → {@link MalformedState}.
 * 4. Projection rejected with an API error → {@link ApiErrorState} (this is
 *    where an unknown view or a malformed focus surfaces).
 * 5. Valid and empty → {@link EmptyProjectionState}.
 * 6. Valid and non-empty → graph + {@link ProjectionNotices} + inspector.
 *
 * The presentation (`CytoscapePresentation`) is derived from the projection
 * through the adapter, so a projection that is malformed *for Cytoscape* —
 * reviewable and real, but not presentable — also lands in the malformed
 * state, via its own message.
 *
 * Facet filtering is presentation-only: the controls strip's popover narrows
 * the projection by ontology type / Suit / Axis, keyed to the current
 * focus/view/depth scope so a new request never inherits a stale filter. The
 * canvas and the inspector read the *filtered* projection; the notices and the
 * status strip read the *original*, because corpus facts (warnings,
 * truncation) and what the corpus supports are not facets of browsing. When
 * the facets empty a non-empty projection, {@link FilteredEmptyState} offers
 * the escape hatch.
 *
 * The appearance switcher repaints the shell and canvas from the chosen
 * treatment's tokens; it never touches the projection, focus, view, depth,
 * selection, or any semantic readout.
 */

import { useEffect, useMemo, useState } from 'preact/hooks'
import { useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import type { GraphViewDescriptor } from '@/graph/projection-guards'
import {
  CytoscapeAdapterError,
  toCytoscapePresentation,
} from '../../trope-cards/src/graph/cytoscape-adapter.ts'
import {
  ARGUMENT_VIEW_NAME,
  DEFAULT_DEPTH,
  DEFAULT_VIEW_NAME,
  EVIDENCE_VIEW_NAME,
  HARD_MAX_DEPTH,
} from '../../trope-cards/src/graph/views.ts'
import {
  GRAPH_TREATMENT_STORAGE_KEY,
  GRAPH_TREATMENT_TOKENS,
  type GraphTreatment,
  readGraphTreatment,
} from '../graph/appearance'
import { CytoscapeGraph } from '../graph/cytoscape-graph'
import {
  applyFacetFilter,
  deriveFacets,
  EMPTY_DECK_FACETS,
  type FacetFilter,
  NO_FACET_FILTER,
} from '../graph/deck-facets'
import {
  EntityInspector,
  type InspectorSelection,
  type RefocusTarget,
} from '../graph/entity-inspector'
import { GraphControls } from '../graph/graph-controls'
import { GraphShell } from '../graph/graph-shell'
import {
  ApiErrorState,
  EmptyProjectionState,
  FilteredEmptyState,
  LoadingState,
  MalformedState,
  NoFocusState,
  ProjectionNotices,
} from '../graph/graph-states'
import { GraphStatusStrip } from '../graph/graph-status'
import { buildGraphStylesheet } from '../graph/graph-stylesheet'
import { ProjectionShapeError } from '../graph/projection-guards'
import { clampDepth, parseGraphParams } from '../graph/query-params'
import {
  useCardSearch,
  useGraphProjection,
  useGraphViews,
} from '../graph/use-graph'

/**
 * The persisted appearance treatment, or the default when storage is missing.
 *
 * @returns A valid {@link GraphTreatment}.
 */
function initialTreatment(): GraphTreatment {
  try {
    return readGraphTreatment(
      typeof localStorage !== 'undefined' ? localStorage : null,
    )
  } catch {
    return 'atmospheric'
  }
}

/**
 * The Graph page.
 *
 * @returns The routed page: shell, controls, graph canvas and inspector, or
 * the matching state component when there is no usable projection.
 */
const Graph = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseGraphParams(searchParams.toString())
  const [selection, setSelection] = useState<InspectorSelection>(null)
  const [focusInput, setFocusInput] = useState(params.focus ?? '')
  const [treatment, setTreatment] = useState<GraphTreatment>(initialTreatment)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    setFocusInput(params.focus ?? '')
  }, [params.focus])

  // Persist a treatment choice (best-effort: privacy mode just keeps it for
  // the session). Persisting is presentation state and never touches the URL.
  useEffect(() => {
    try {
      localStorage.setItem(GRAPH_TREATMENT_STORAGE_KEY, treatment)
    } catch {
      /* storage unavailable — the switcher still wins for this session */
    }
  }, [treatment])

  const viewsQuery = useGraphViews()
  const projectionQuery = useGraphProjection(params)
  const searchQuery = useCardSearch(focusInput)
  const searchResults = searchQuery.data?.results ?? []

  const views = viewsQuery.data
  const selectedDescriptor =
    views?.views.find(
      (view) => view.name === (params.view ?? DEFAULT_VIEW_NAME),
    ) ?? null

  const maxDepth = selectedDescriptor?.maxDepth ?? HARD_MAX_DEPTH
  const selectedDepth = clampDepth(params.depth, maxDepth) ?? DEFAULT_DEPTH

  const projection = projectionQuery.data

  // The facet filter is presentation-only and belongs to the projection it was
  // derived from: a new focus/view/depth loads a different corpus, so the
  // filter is keyed to that scope and goes inert on change rather than
  // carrying a facet the new projection may not satisfy.
  const facetScope =
    String(params.focus) +
    '|' +
    String(params.view) +
    '|' +
    String(params.depth)
  const [facetState, setFacetState] = useState<{
    key: string
    filter: FacetFilter
  }>({ key: facetScope, filter: NO_FACET_FILTER })
  const facetFilter: FacetFilter =
    facetState.key === facetScope ? facetState.filter : NO_FACET_FILTER
  const setFacetFilter = (filter: FacetFilter) =>
    setFacetState({ key: facetScope, filter })

  // Facets describe the *loaded* projection (server truth), never a filtered one.
  const facets =
    projection !== undefined ? deriveFacets(projection) : EMPTY_DECK_FACETS
  const filteredProjection =
    projection !== undefined
      ? applyFacetFilter(projection, facetFilter)
      : undefined

  // The canvas renders the filtered projection; notices and the status strip
  // read the original, because corpus facts (warnings, truncation) and what
  // the corpus supports are not facets of browsing.
  const presentation = (() => {
    if (
      filteredProjection === undefined ||
      filteredProjection.nodes.length === 0
    ) {
      return null
    }
    try {
      return toCytoscapePresentation(filteredProjection)
    } catch (error) {
      return error instanceof CytoscapeAdapterError ? error : null
    }
  })()

  // A selection that the filter hid is shown as no selection: the inspector
  // would otherwise report a stale id as "missing" on a projection it is
  // merely filtered out of.
  const visibleSelection = (() => {
    if (selection === null || filteredProjection === undefined) return null
    const present =
      selection.kind === 'node'
        ? filteredProjection.nodes.some((node) => node.id === selection.id)
        : filteredProjection.edges.some((edge) => edge.id === selection.id)
    return present ? selection : null
  })()

  // Switching treatments repaints the canvas via a *new stylesheet identity*;
  // `buildGraphStylesheet` returns a fresh array per call, so its output is
  // memoized on `treatment` here — the memory is what tells CytoscapeGraph to
  // rebuild rather than observe a no-op style prop object each render.
  const stylesheet = useMemo(() => buildGraphStylesheet(treatment), [treatment])

  const renderProjectionArea = () => {
    if (params.focus === null) return <NoFocusState />

    if (projectionQuery.isPending) {
      return <LoadingState labelled="Expanding the neighbourhood…" />
    }

    const error = projectionQuery.error
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
            <FilteredEmptyState
              filter={facetFilter}
              onClear={() => setFacetFilter(NO_FACET_FILTER)}
            />
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
            onNavigateCard={(slug) => navigateToCard(slug)}
            onRefocus={(id, type) => refocusEntity(id, type)}
            descriptor={selectedDescriptor}
          />
        </div>
      </div>
    )
  }

  const navigateToCard = (slug: string) => {
    setSelection(null)
    updateParam('focus', slug)
  }

  // Refocusing moves `focus` and `view` together: a claim or argument chain goes
  // to the argument view (the registered view whose focusTypes accepts both), a
  // source or evidence item to the evidence view (the only one that accepts
  // those), so no refocus button can hand the router a focus its view would 404.
  // Both keys land in one search-params write: two sequential updates would build
  // the second from a stale `searchParams` snapshot and silently drop the first.
  const refocusEntity = (id: string, type: RefocusTarget) => {
    setSelection(null)
    const next = new URLSearchParams(searchParams)
    next.set('focus', id)
    next.set(
      'view',
      type === 'claim' || type === 'argument_chain'
        ? ARGUMENT_VIEW_NAME
        : EVIDENCE_VIEW_NAME,
    )
    setSearchParams(next)
  }

  const updateParam = (
    key: 'focus' | 'view' | 'depth',
    value: string | null,
  ) => {
    const next = new URLSearchParams(searchParams)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setSearchParams(next)
  }

  const onFocusSubmit = (event: Event) => {
    event.preventDefault()
    const value = focusInput.trim()
    if (value.length === 0) return
    setSelection(null)
    setSearchOpen(false)
    updateParam('focus', value)
  }

  const onFocusInput = (value: string) => {
    setFocusInput(value)
    setSearchOpen(value.trim().length >= 2)
  }

  const onSelectCard = (slug: string) => {
    setSearchOpen(false)
    navigateToCard(slug)
  }

  return (
    <div className="flex min-h-screen flex-col bg-graph-page">
      <Header />

      <div className="flex-grow">
        <GraphShell
          treatment={treatment}
          controls={
            <GraphControls
              focusInput={focusInput}
              onFocusInput={onFocusInput}
              onSubmitFocus={onFocusSubmit}
              searchResults={searchResults}
              searchPending={searchQuery.isPending}
              searchOpen={searchOpen}
              onSelectCard={onSelectCard}
              onSearchClose={() => setSearchOpen(false)}
              views={views}
              viewsError={viewsQuery.error}
              view={params.view ?? DEFAULT_VIEW_NAME}
              onViewChange={(value) => updateParam('view', value)}
              maxDepth={maxDepth}
              depth={selectedDepth}
              onDepthChange={(value) => updateParam('depth', String(value))}
              descriptor={selectedDescriptor}
              facets={facets}
              filter={facetFilter}
              onFacetChange={setFacetFilter}
              onClearFacets={() => setFacetFilter(NO_FACET_FILTER)}
              treatment={treatment}
              onTreatmentChange={setTreatment}
              nodeColors={GRAPH_TREATMENT_TOKENS[treatment].nodeColors}
              edgeColors={GRAPH_TREATMENT_TOKENS[treatment].edgeColors}
            />
          }
          workspace={<div>{renderProjectionArea()}</div>}
          status={
            <GraphStatusStrip
              projection={projection ?? null}
              descriptor={selectedDescriptor}
            />
          }
        />
      </div>

      <Footer />
    </div>
  )
}

export default Graph
