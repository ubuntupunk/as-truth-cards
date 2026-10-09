/**
 * `useGraphPage` — the query, URL, and presentation state shared by the Graph
 * Explorer and the Research Workspace.
 *
 * The two pages differ only in chrome and in the research-session rail, so the
 * wiring that must not drift between them lives here once: URL params, the
 * views/projection/search reads, the appearance treatment, the shared facet
 * filter, the derived focus node, and the navigation handlers. Each page supplies
 * its own copy and slots the returned pieces into `GraphShell` and
 * `GraphWorkspace`.
 */

import { useEffect, useMemo, useState } from 'preact/hooks'
import { useSearchParams } from 'react-router-dom'
import type { GraphNode } from '../../trope-cards/src/graph/types.ts'
import {
  DEFAULT_DEPTH,
  DEFAULT_VIEW_NAME,
  HARD_MAX_DEPTH,
} from '../../trope-cards/src/graph/views.ts'
import {
  GRAPH_TREATMENT_STORAGE_KEY,
  type GraphTreatment,
  readGraphTreatment,
} from './appearance'
import { type RefocusTarget, refocusView } from './entity-inspector'
import { buildGraphStylesheet } from './graph-stylesheet'
import { clampDepth, parseGraphParams } from './query-params'
import { useCardSearch, useGraphProjection, useGraphViews } from './use-graph'
import { useGraphFacetFilter } from './use-graph-facets'

/** The persisted appearance treatment, or the default when storage is missing. */
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
 * The shared state of a graph-backed page.
 *
 * @returns Params, reads, derived focus/descriptor, appearance, facets, and the
 * navigation handlers both pages render.
 */
export function useGraphPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseGraphParams(searchParams.toString())
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

  const focusNode: GraphNode | null =
    projectionQuery.data?.nodes.find((node) => node.isFocus) ?? null

  // Switching treatments repaints the canvas via a *new stylesheet identity*;
  // `buildGraphStylesheet` returns a fresh array per call, so its output is
  // memoized on `treatment` — the memory is what tells CytoscapeGraph to rebuild
  // rather than observe a no-op style prop each render.
  const stylesheet = useMemo(() => buildGraphStylesheet(treatment), [treatment])

  const facets = useGraphFacetFilter(params, projectionQuery.data)

  const updateParam = (
    key: 'focus' | 'view' | 'depth',
    value: string | null,
  ) => {
    const next = new URLSearchParams(searchParams)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setSearchParams(next)
  }

  // Writes focus/view/depth in one navigation. The `useSearchParams` snapshot is
  // a render value, so chaining `updateParam` calls would rebuild each write from
  // the same stale params and drop all but the last — every multi-key move (open
  // a saved research entry) must go through here.
  const setGraphParams = (next: {
    focus?: string | null
    view?: string | null
    depth?: number | null
  }) => {
    const params = new URLSearchParams(searchParams)
    if (next.focus !== undefined) {
      if (next.focus === null) params.delete('focus')
      else params.set('focus', next.focus)
    }
    if (next.view !== undefined) {
      if (next.view === null) params.delete('view')
      else params.set('view', next.view)
    }
    if (next.depth !== undefined) {
      if (next.depth === null) params.delete('depth')
      else params.set('depth', String(next.depth))
    }
    setSearchParams(params)
  }

  const navigateToCard = (slug: string) => {
    updateParam('focus', slug)
  }

  // Refocusing moves `focus` and `view` together: a claim or argument chain goes
  // to the argument view (the registered view whose focusTypes accepts both), a
  // source or evidence item to the evidence view (the only one that accepts
  // those), so no refocus button can hand the router a focus its view would 404.
  // Both keys land in one search-params write: two sequential updates would build
  // the second from a stale `searchParams` snapshot and silently drop the first.
  const refocusEntity = (id: string, type: RefocusTarget) => {
    const next = new URLSearchParams(searchParams)
    next.set('focus', id)
    next.set('view', refocusView(type))
    setSearchParams(next)
  }

  const onFocusSubmit = (event: Event) => {
    event.preventDefault()
    const value = focusInput.trim()
    if (value.length === 0) return
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

  return {
    params,
    searchParams,
    views,
    view: params.view ?? DEFAULT_VIEW_NAME,
    viewsError: viewsQuery.error,
    selectedDescriptor,
    maxDepth,
    depth: selectedDepth,
    projection: projectionQuery.data,
    projectionPending: projectionQuery.isPending,
    projectionError: projectionQuery.error,
    focusNode,
    focusInput,
    onFocusInput,
    onFocusSubmit,
    searchResults,
    searchPending: searchQuery.isPending,
    searchOpen,
    onSearchClose: () => setSearchOpen(false),
    onSelectCard,
    treatment,
    setTreatment,
    stylesheet,
    facets,
    updateParam,
    setGraphParams,
    navigateToCard,
    refocusEntity,
  }
}
