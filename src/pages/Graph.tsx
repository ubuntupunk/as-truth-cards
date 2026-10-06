/**
 * The Graph page: the first presentation layer over `/api/graph`.
 *
 * Orchestration only, and small on purpose. URL state (`focus`/`view`/`depth`)
 * is translated by `query-params.ts`, the two API reads live in
 * `use-graph.ts`, every screen state is `graph-states.tsx`, the semantic side
 * panel is `entity-inspector.tsx`, and the only canvas code is the thin
 * `cytoscape-graph.tsx` mount. This file wires them together and decides which
 * state is on screen — it computes no graph semantics itself.
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
 */

import { Search } from 'lucide-react'
import { useEffect, useState } from 'preact/hooks'
import { useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import type { GraphViewDescriptor } from '@/graph/projection-guards'
import {
  CytoscapeAdapterError,
  toCytoscapePresentation,
} from '../../trope-cards/src/graph/cytoscape-adapter.ts'
import {
  DEFAULT_DEPTH,
  DEFAULT_VIEW_NAME,
  HARD_MAX_DEPTH,
} from '../../trope-cards/src/graph/views.ts'
import { CytoscapeGraph } from '../graph/cytoscape-graph'
import {
  EntityInspector,
  type InspectorSelection,
} from '../graph/entity-inspector'
import {
  ApiErrorState,
  EmptyProjectionState,
  LoadingState,
  MalformedState,
  NoFocusState,
  ProjectionNotices,
  ViewsStatus,
} from '../graph/graph-states'
import { EDGE_FAMILY_COLORS, NODE_TYPE_COLORS } from '../graph/graph-stylesheet'
import { ProjectionShapeError } from '../graph/projection-guards'
import {
  clampDepth,
  depthOptions,
  parseGraphParams,
} from '../graph/query-params'
import { useGraphProjection, useGraphViews } from '../graph/use-graph'

/**
 * The Graph page.
 *
 * @returns The routed page: controls, legend, graph canvas and inspector, or
 * the matching state component when there is no usable projection.
 */
const Graph = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseGraphParams(searchParams.toString())
  const [selection, setSelection] = useState<InspectorSelection>(null)
  const [focusInput, setFocusInput] = useState(params.focus ?? '')

  useEffect(() => {
    setFocusInput(params.focus ?? '')
  }, [params.focus])

  const viewsQuery = useGraphViews()
  const projectionQuery = useGraphProjection(params)

  const views = viewsQuery.data
  const selectedDescriptor =
    views?.views.find(
      (view) => view.name === (params.view ?? DEFAULT_VIEW_NAME),
    ) ?? null

  const maxDepth = selectedDescriptor?.maxDepth ?? HARD_MAX_DEPTH
  const selectedDepth = clampDepth(params.depth, maxDepth) ?? DEFAULT_DEPTH

  const projection = projectionQuery.data

  const presentation = (() => {
    if (projection === undefined) return null
    try {
      return toCytoscapePresentation(projection)
    } catch (error) {
      return error instanceof CytoscapeAdapterError ? error : null
    }
  })()

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
          <div className="h-[460px] md:h-[560px] overflow-hidden rounded-xl border bg-background">
            {presentation ? (
              <CytoscapeGraph
                presentation={presentation}
                selectedId={selection?.id ?? null}
                onSelect={setSelection}
              />
            ) : null}
          </div>
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          <EntityInspector
            projection={projection}
            selection={selection}
            onNavigateCard={(slug) => navigateToCard(slug)}
          />
        </div>
      </div>
    )
  }

  const navigateToCard = (slug: string) => {
    setSelection(null)
    updateParam('focus', slug)
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
    updateParam('focus', value)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow pt-24 pb-16 px-4">
        <section className="container mx-auto max-w-7xl space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-medium tracking-tight">Graph</h1>
            <p className="text-sm text-muted-foreground">
              Explore how a card is built: classification, claims, reasoning and
              relationships — over the same canonical data every view reads.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4 rounded-xl border p-4">
            <form className="flex items-end gap-2" onSubmit={onFocusSubmit}>
              <label className="block text-xs font-medium text-muted-foreground">
                Focus
                <input
                  type="text"
                  value={focusInput}
                  onInput={(event) => setFocusInput(event.currentTarget.value)}
                  placeholder="card slug or uuid"
                  className="mt-1 h-9 w-56 rounded-md border border-input bg-background px-2 text-sm outline-none ring-primary/30 focus:ring-2"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Search className="h-4 w-4" aria-hidden="true" /> Expand
              </button>
            </form>

            <label className="block text-xs font-medium text-muted-foreground">
              View
              <select
                value={params.view ?? DEFAULT_VIEW_NAME}
                onChange={(event) =>
                  updateParam('view', event.currentTarget.value)
                }
                className="mt-1 h-9 min-w-52 rounded-md border border-input bg-background px-2 text-sm"
              >
                {views?.views.map((view) => (
                  <option key={view.name} value={view.name}>
                    {view.name}
                    {view.status !== 'implemented' ? ` (${view.status})` : ''}
                  </option>
                ))}
              </select>
              <ViewsStatus error={viewsQuery.error ?? null} views={views} />
            </label>

            <label className="block text-xs font-medium text-muted-foreground">
              Depth
              <select
                value={selectedDepth}
                onChange={(event) =>
                  updateParam('depth', event.currentTarget.value)
                }
                className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {depthOptions(maxDepth).map((depth) => (
                  <option key={depth} value={depth}>
                    {depth} hop{depth === 1 ? '' : 's'}
                    {depth === DEFAULT_DEPTH ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedDescriptor ? (
              <Legend descriptor={selectedDescriptor} />
            ) : null}
          </div>

          <div>{renderProjectionArea()}</div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

/**
 * The colour legend, built from the same maps the stylesheet uses.
 *
 * Only shows what the selected view actually emits. Node types and edge
 * families outside the descriptor are omitted, so the legend never promises a
 * colour for a class the current view cannot draw.
 *
 * @param descriptor The selected view's rule.
 * @returns A compact swatch legend for node types and edge families.
 */
const Legend = ({ descriptor }: { descriptor: GraphViewDescriptor }) => (
  <div className="ml-auto max-w-sm space-y-1.5 text-xs text-muted-foreground">
    <div className="flex flex-wrap gap-2">
      {descriptor.nodeTypes.map((type) => (
        <span key={type} className="inline-flex items-center gap-1">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: NODE_TYPE_COLORS[type] ?? '#94a3b8' }}
            aria-hidden="true"
          />
          {type}
        </span>
      ))}
    </div>
    <div className="flex flex-wrap gap-2">
      {descriptor.edgeFamilies.map((family) => (
        <span key={family} className="inline-flex items-center gap-1">
          <span
            className="h-0.5 w-4 rounded"
            style={{ backgroundColor: EDGE_FAMILY_COLORS[family] ?? '#94a3b8' }}
            aria-hidden="true"
          />
          {family}
        </span>
      ))}
    </div>
  </div>
)

export default Graph
