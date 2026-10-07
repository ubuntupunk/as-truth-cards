/**
 * The Graph Explorer control strip: focus, view, depth, appearance, facets,
 * and the colour legend — one compact row of presentation controls.
 *
 * Everything here is *presentation*. The strip never computes a semantic: the
 * view catalogue and depth bounds come from the server (`views`/`descriptor`),
 * the facet groups come from `deriveFacets(projection)`, and selections are
 * reported verbatim to the page, which applies them. It renders pure
 * (props → string), which is what lets `preact-render-to-string` test it under
 * Node without a DOM.
 *
 * The facet filter that lived in the old `DeckNavigator` sidebar is re-homed
 * here as a compact `<details>` popover — same single-select groups, same
 * derived-from-projection honesty (a facet with zero nodes renders disabled,
 * never as a dead filter), no left column. The appearance switcher is the
 * presentation-only treatment selector from `appearance.ts`.
 */

import type {
  EdgeFamily,
  GraphNodeType,
} from '../../trope-cards/src/graph/types.ts'
import { DEFAULT_DEPTH } from '../../trope-cards/src/graph/views.ts'
import {
  GRAPH_TREATMENT_LABELS,
  GRAPH_TREATMENTS,
  type GraphTreatment,
} from './appearance'
import {
  type DeckFacets,
  type FacetFilter,
  hasActiveFacets,
  SUIT_DOT_COLORS,
} from './deck-facets'
import { ViewsStatus } from './graph-states'
import type {
  GraphViewDescriptor,
  GraphViewsResponse,
} from './projection-guards'
import { depthOptions } from './query-params'

/** "All types" sentinel for the ontology-type facet group. */
const ALL_TYPE: GraphNodeType | null = null

/**
 * The control strip.
 *
 * @param props.focusInput The controlled focus text (card slug or uuid).
 * @param props.onFocusInput Updates the focus text.
 * @param props.onSubmitFocus Autoloading form submit handler.
 * @param props.views The loaded view catalogue, or `undefined` while loading.
 * @param props.viewsError The views query's error, when the catalogue failed.
 * @param props.view The active view name (URL state).
 * @param props.onViewChange Selects a view.
 * @param props.maxDepth The active view's max depth (hard cap fallback).
 * @param props.depth The active depth (URL state).
 * @param props.onDepthChange Selects a depth.
 * @param props.descriptor The active view's rule, when known.
 * @param props.facets Facets derived from the loaded projection.
 * @param props.filter The active facet filter.
 * @param props.onFacetChange Applies a facet filter this strip produced.
 * @param props.onClearFacets Clears every facet dimension.
 * @param props.treatment The active appearance treatment.
 * @param props.onTreatmentChange Switches the appearance treatment.
 * @param props.nodeColors Node-type fills for the legend (treatment palette).
 * @param props.edgeColors Edge-family colours for the legend (treatment palette).
 * @returns The control strip `<div>`.
 */
export function GraphControls({
  focusInput,
  onFocusInput,
  onSubmitFocus,
  views,
  viewsError,
  view,
  onViewChange,
  maxDepth,
  depth,
  onDepthChange,
  descriptor,
  facets,
  filter,
  onFacetChange,
  onClearFacets,
  treatment,
  onTreatmentChange,
  nodeColors,
  edgeColors,
}: {
  focusInput: string
  onFocusInput: (value: string) => void
  onSubmitFocus: (event: Event) => void
  views: GraphViewsResponse | undefined
  viewsError: unknown
  view: string
  onViewChange: (value: string) => void
  maxDepth: number
  depth: number
  onDepthChange: (value: number) => void
  descriptor: GraphViewDescriptor | null
  facets: DeckFacets
  filter: FacetFilter
  onFacetChange: (next: FacetFilter) => void
  onClearFacets: () => void
  treatment: GraphTreatment
  onTreatmentChange: (next: GraphTreatment) => void
  nodeColors: Record<GraphNodeType, string>
  edgeColors: Record<EdgeFamily, string>
}) {
  const defaultView = view
  return (
    <div
      data-testid="graph-controls"
      className="flex flex-wrap items-end gap-4 rounded-xl border border-graph-border bg-graph-controls p-4"
    >
      <form className="flex items-end gap-2" onSubmit={onSubmitFocus}>
        <label className="block text-xs font-medium text-muted-foreground">
          Focus
          <input
            type="text"
            value={focusInput}
            onInput={(event) => onFocusInput(event.currentTarget.value)}
            placeholder="card slug or uuid"
            className="mt-1 h-9 w-56 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-graph-focus/30"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-graph-accent px-3 text-sm font-medium text-graph-accent-foreground hover:opacity-90"
        >
          <SearchIcon className="h-4 w-4" aria-hidden="true" /> Expand
        </button>
      </form>

      <ViewSelect
        views={views}
        viewsError={viewsError}
        view={defaultView}
        onViewChange={onViewChange}
      />

      <DepthSelect
        maxDepth={maxDepth}
        depth={depth}
        onDepthChange={onDepthChange}
      />

      <FacetPopover
        facets={facets}
        filter={filter}
        onChange={onFacetChange}
        onClear={onClearFacets}
      />

      <AppearanceSwitcher treatment={treatment} onChange={onTreatmentChange} />

      {descriptor && descriptor.blockingGaps.length > 0 ? (
        <ViewGapsNote descriptor={descriptor} />
      ) : null}

      {descriptor ? (
        <ColorLegend
          descriptor={descriptor}
          nodeColors={nodeColors}
          edgeColors={edgeColors}
        />
      ) : null}
    </div>
  )
}

/** The view selector, fed by the server catalogue. */
function ViewSelect({
  views,
  viewsError,
  view,
  onViewChange,
}: {
  views: GraphViewsResponse | undefined
  viewsError: unknown
  view: string
  onViewChange: (value: string) => void
}) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      View
      <select
        value={view}
        onChange={(event) => onViewChange(event.currentTarget.value)}
        className="mt-1 h-9 min-w-52 rounded-md border border-input bg-background px-2 text-sm"
      >
        {views?.views.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name}
            {v.status !== 'implemented' ? ` (${v.status})` : ''}
          </option>
        ))}
      </select>
      <ViewsStatus error={viewsError} views={views} />
    </label>
  )
}

/** The depth selector, bound to the active view's `maxDepth`. */
function DepthSelect({
  maxDepth,
  depth,
  onDepthChange,
}: {
  maxDepth: number
  depth: number
  onDepthChange: (value: number) => void
}) {
  const options = depthOptions(maxDepth)
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      Depth
      <select
        value={depth}
        onChange={(event) => onDepthChange(Number(event.currentTarget.value))}
        className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option} hop{option === 1 ? '' : 's'}
            {option === DEFAULT_DEPTH ? ' (default)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * The facet filter as a compact `<details>` popover.
 *
 * Re-homes the interaction the old `DeckNavigator` sidebar offered: single-select
 * per group, selections AND across groups, facets with zero nodes disabled. A
 * `<details>` keeps the disclosure open state in the browser and renders its
 * whole group markup under `preact-render-to-string`, so the popover is testable
 * without any JS.
 */
function FacetPopover({
  facets,
  filter,
  onChange,
  onClear,
}: {
  facets: DeckFacets
  filter: FacetFilter
  onChange: (next: FacetFilter) => void
  onClear: () => void
}) {
  const activeCount = hasActiveFacets(filter)
    ? [filter.type, filter.suit, filter.axis].filter((v) => v !== null).length
    : 0
  return (
    <details data-testid="facet-popover" className="relative group">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-muted/60">
        <FilterIcon className="h-4 w-4" aria-hidden="true" />
        Filter
        {activeCount > 0 ? (
          <span
            className="rounded-full bg-graph-accent px-1.5 text-xs font-semibold text-graph-accent-foreground"
            data-filter-count
          >
            {activeCount}
          </span>
        ) : null}
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-graph-border bg-graph-surface p-3 shadow-lg">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[13px] font-medium text-foreground">Facets</p>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded px-1.5 py-0.5 text-xs text-graph-accent hover:bg-muted/60"
              data-testid="clear-facets"
            >
              Clear all
            </button>
          ) : null}
        </div>
        <OntologyTypeGroup
          facets={facets}
          filter={filter}
          onChange={onChange}
        />
        <SuitGroup facets={facets} filter={filter} onChange={onChange} />
        <AxisGroup facets={facets} filter={filter} onChange={onChange} />
      </div>
    </details>
  )
}

/** The "Ontology type" group: All plus the ontology-type facets. */
function OntologyTypeGroup({
  facets,
  filter,
  onChange,
}: {
  facets: DeckFacets
  filter: FacetFilter
  onChange: (next: FacetFilter) => void
}) {
  return (
    <div className="mb-3">
      <GroupHeading>Ontology type</GroupHeading>
      <FacetList>
        <FacetRow
          label="All"
          selected={filter.type === ALL_TYPE}
          onClick={() => onChange({ ...filter, type: ALL_TYPE })}
        />
        {facets.types.map((facet) => (
          <FacetRow
            key={facet.type}
            label={facet.label}
            count={facet.count}
            selected={filter.type === facet.type}
            disabled={!facet.present}
            title={
              facet.present
                ? undefined
                : `No ${facet.label.toLowerCase()} in the current projection`
            }
            onClick={() =>
              onChange({
                ...filter,
                type: filter.type === facet.type ? ALL_TYPE : facet.type,
              })
            }
          />
        ))}
      </FacetList>
    </div>
  )
}

/** The "Suit" group: coloured-dot rows. */
function SuitGroup({
  facets,
  filter,
  onChange,
}: {
  facets: DeckFacets
  filter: FacetFilter
  onChange: (next: FacetFilter) => void
}) {
  return (
    <div className="mb-3">
      <GroupHeading>Suit</GroupHeading>
      <FacetList>
        {facets.suits.map((facet) => (
          <FacetRow
            key={facet.slug}
            label={facet.label}
            count={facet.count}
            selected={filter.suit === facet.slug}
            onClick={() =>
              onChange({
                ...filter,
                suit: filter.suit === facet.slug ? null : facet.slug,
              })
            }
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: SUIT_DOT_COLORS[facet.slug] ?? '#94a3b8',
              }}
              aria-hidden="true"
            />
          </FacetRow>
        ))}
      </FacetList>
    </div>
  )
}

/** The "Axis" group, in canonical `card_axis` order. */
function AxisGroup({
  facets,
  filter,
  onChange,
}: {
  facets: DeckFacets
  filter: FacetFilter
  onChange: (next: FacetFilter) => void
}) {
  return (
    <div>
      <GroupHeading>Axis</GroupHeading>
      <FacetList>
        {facets.axes.map((facet) => (
          <FacetRow
            key={facet.axis}
            label={facet.label}
            count={facet.count}
            selected={filter.axis === facet.axis}
            onClick={() =>
              onChange({
                ...filter,
                axis: filter.axis === facet.axis ? null : facet.axis,
              })
            }
          >
            <span className="h-2 w-2 shrink-0 rounded-sm border border-current opacity-60" />
          </FacetRow>
        ))}
      </FacetList>
    </div>
  )
}

/** Group title inside the popover. */
function GroupHeading({ children }: { children: string }) {
  return (
    <p className="mb-0.5 px-2 text-[13px] font-medium text-foreground">
      {children}
    </p>
  )
}

/** The tight vertical stack of facet rows. */
function FacetList({
  children,
}: {
  children: import('preact').ComponentChildren
}) {
  return <div className="flex flex-col gap-0.5">{children}</div>
}

/**
 * One selectable facet row.
 *
 * @param props.label The human facet label.
 * @param props.count Optional node count shown at the right edge.
 * @param props.selected Whether this row is the group's active selection.
 * @param props.disabled Whether the facet is empty in this projection.
 * @param props.title Native tooltip, used to explain disabled facets.
 * @param props.onClick The row activation handler.
 */
function FacetRow({
  label,
  count,
  selected,
  disabled,
  title,
  onClick,
  children,
}: {
  label: string
  count?: number
  selected?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
  children?: import('preact').ComponentChildren
}) {
  return (
    <button
      type="button"
      aria-pressed={selected ?? false}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors ${
        selected ? 'bg-muted text-foreground' : 'text-muted-foreground'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/60'}`}
    >
      {children}
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
      ) : null}
    </button>
  )
}

/**
 * The appearance switcher.
 *
 * Presentation-only: switching a treatment calls `onTreatmentChange`; the page
 * repaints the shell and the Cytoscape stylesheet from the new token set and
 * touches nothing semantic.
 */
function AppearanceSwitcher({
  treatment,
  onChange,
}: {
  treatment: GraphTreatment
  onChange: (next: GraphTreatment) => void
}) {
  return (
    <div
      data-testid="appearance-switcher"
      className="flex items-end flex-col gap-1"
    >
      <span className="text-xs font-medium text-muted-foreground">
        Appearance
      </span>
      <div className="inline-flex h-9 overflow-hidden rounded-md border border-input bg-background">
        {GRAPH_TREATMENTS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            data-appearance={candidate}
            aria-pressed={treatment === candidate}
            onClick={() => onChange(candidate)}
            className={`px-3 text-sm font-medium transition-colors ${
              treatment === candidate
                ? 'bg-graph-accent text-graph-accent-foreground'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {GRAPH_TREATMENT_LABELS[candidate]}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The blocking-gaps note under the view selector.
 *
 * Tells the user why a view is data-blocked *before* anything is fetched:
 * a declared node type whose backing table has no rows (a corpus fact, not a
 * bug). The server's own `blockingGaps` strings name the empty table, so this
 * note reports the specific blocking condition and never a blanket "0 rows
 * in the corpus". It speaks only to backing-table gaps — evidence outside the
 * current depth frontier and a claim with no attached evidence stay the
 * inspector's per-claim story.
 *
 * @param descriptor The selected view's rule, including its `blockingGaps`.
 */
function ViewGapsNote({ descriptor }: { descriptor: GraphViewDescriptor }) {
  return (
    <p className="basis-full text-xs text-muted-foreground">
      <span className="font-medium text-amber-700 dark:text-amber-400">
        This view is data-blocked
      </span>{' '}
      — {descriptor.blockingGaps.join(' · ')} — an empty backing table, not a
      failed load. Depth and per-claim gaps are reported in the inspector.
    </p>
  )
}

/**
 * The colour legend, built from the same treatment palettes the stylesheet uses.
 *
 * Only shows what the selected view actually emits; a node type or edge family
 * outside the descriptor is omitted, so the legend never promises a colour for
 * a class the current view cannot draw.
 *
 * @param descriptor The selected view's rule.
 * @param nodeColors The active treatment's node fills (same map the stylesheet keys).
 * @param edgeColors The active treatment's edge colours.
 */
function ColorLegend({
  descriptor,
  nodeColors,
  edgeColors,
}: {
  descriptor: GraphViewDescriptor
  nodeColors: Record<GraphNodeType, string>
  edgeColors: Record<EdgeFamily, string>
}) {
  return (
    <div className="ml-auto max-w-sm space-y-1.5 text-xs text-muted-foreground">
      <div className="flex flex-wrap gap-2">
        {descriptor.nodeTypes.map((type) => (
          <span key={type} className="inline-flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: nodeColors[type] ?? '#94a3b8' }}
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
              style={{ backgroundColor: edgeColors[family] ?? '#94a3b8' }}
              aria-hidden="true"
            />
            {family}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Search glyph (inline SVG; never a react-coupled icon library). */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/** Sliders glyph for the filter popover disclosure. */
function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  )
}
