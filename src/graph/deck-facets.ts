/**
 * The facet model behind the Graph explorer's navigator sidebar.
 *
 * `trope_deck_axis_suit_ui.html` (the machine-readable slice of the approved
 * mockup) and `trope-deck-axis-memo.md` §4 define three navigator groups over
 * one card-focused projection: **Ontology type** (All / Claims / Evidence /
 * Cases / …), **Suit** and **Axis**. Everything this module produces is derived
 * *from the projection itself* — the union of node types present, suits named
 * by the card nodes' `classification.suits`, axes named by their ordered
 * `classification.axes`. No vocabulary is invented and nothing here asks the
 * server for a wider graph: the sidebar answers "what does the layer I am
 * looking at contain", which keeps the client honest about empty layers (a
 * schema-only type renders as a disabled facet, never as a broken filter).
 *
 * `applyFacetFilter` is the presentation filter itself. It prunes nodes and
 * their now-dangling edges and returns a *new* projection with recomputed
 * `meta.nodeCount`/`edgeCount`, leaving `truncated`, `maxNodes`, `reachedDepth`
 * and `warnings` untouched — those are corpus facts, not presentation state.
 * When no filter is active it returns the same object unchanged, so an
 * unfiltered session never constructs a duplicate projection.
 *
 * This module is pure data + pure functions (no JSX), so the whole behaviour is
 * covered by `preact-render-to-string`-free Node tests against hand-built
 * projections.
 */

import type {
  CardAxisValue,
  GraphNode,
  GraphNodeType,
  GraphProjection,
} from '../../trope-cards/src/graph/types.ts'

/** One ontology-type facet as the navigator lists it. */
export type OntologyTypeFacet = {
  readonly type: GraphNodeType
  readonly label: string
  /**
   * Whether the current projection contains at least one node of this type.
   * A schema-only layer (e.g. Evidence when every `evidence_*` table is empty)
   * renders disabled so "no evidence in the corpus" is visible, not a dead
   * control that silently does nothing.
   */
  readonly present: boolean
  readonly count: number
}

/** One Suit facet: a collection slug plus its human label and card count. */
export type SuitFacet = {
  readonly slug: string
  readonly label: string
  readonly count: number
}

/** One Axis facet, in canonical `card_axis` declaration order. */
export type AxisFacet = {
  readonly axis: CardAxisValue
  readonly label: string
  readonly count: number
}

/** The three navigator groups derived from a projection. */
export type DeckFacets = {
  readonly types: readonly OntologyTypeFacet[]
  readonly suits: readonly SuitFacet[]
  readonly axes: readonly AxisFacet[]
}

/** The ontology-type facets, in the mockup's order. "All" lives in the navigator. */
export const ONTOLOGY_TYPE_FACETS: readonly {
  readonly type: GraphNodeType
  readonly label: string
}[] = [
  { type: 'claim', label: 'Claims' },
  { type: 'evidence_item', label: 'Evidence' },
  { type: 'source', label: 'Sources' },
  { type: 'case', label: 'Cases' },
  { type: 'concept', label: 'Concepts' },
  { type: 'interpretation', label: 'Interpretations' },
  { type: 'inference_step', label: 'Inferences' },
]

/** Human labels for the five known Suit slugs (presentation only). */
export const SUIT_LABELS: Readonly<Record<string, string>> = {
  classic: 'Classic',
  'zionism-coded': 'Zionism-coded',
  'south-africa': 'South Africa',
  'fact-rebuttal': 'Reference',
  foundational: 'Foundational',
}

/** Dot colours for the five known Suit slugs, matching the mockup's palette. */
export const SUIT_DOT_COLORS: Readonly<Record<string, string>> = {
  classic: '#ef4444',
  'zionism-coded': '#8b5cf6',
  'south-africa': '#22d3ee',
  'fact-rebuttal': '#22c55e',
  foundational: '#f97316',
}

/** Human labels for the `card_axis` vocabulary (presentation only). */
export const AXIS_LABELS: Readonly<Record<CardAxisValue, string>> = {
  TACTIC: 'Tactic',
  FACT_REBUTTAL: 'Fact-rebuttal',
  THEOLOGICAL: 'Theological',
  HISTORICAL: 'Historical',
}

/** `card_axis` declaration order, so the sidebar lists axes as the ontology does. */
export const AXIS_ORDER: readonly CardAxisValue[] = [
  'TACTIC',
  'FACT_REBUTTAL',
  'THEOLOGICAL',
  'HISTORICAL',
]

/** A projection with no nodes yet; the navigator renders it as empty groups. */
export const EMPTY_DECK_FACETS: DeckFacets = { types: [], suits: [], axes: [] }

/**
 * Derive the navigator's facet groups from one projection.
 *
 * @param projection Any valid projection. The focus card's own facets always
 * take part because the focus node is a member of `nodes`.
 * @returns The ontology-type, Suit and Axis facets with counts. Suits sort by
 * slug; axes sort in canonical `card_axis` order.
 */
export function deriveFacets(projection: GraphProjection): DeckFacets {
  const countByType = new Map<GraphNodeType, number>()
  const suitCounts = new Map<string, number>()
  const axisCounts = new Map<CardAxisValue, number>()

  for (const node of projection.nodes) {
    countByType.set(node.type, (countByType.get(node.type) ?? 0) + 1)
    if (node.type !== 'card') continue
    for (const slug of node.classification.suits) {
      suitCounts.set(slug, (suitCounts.get(slug) ?? 0) + 1)
    }
    for (const assignment of node.classification.axes) {
      axisCounts.set(
        assignment.axis,
        (axisCounts.get(assignment.axis) ?? 0) + 1,
      )
    }
  }

  const types = ONTOLOGY_TYPE_FACETS.map(({ type, label }) => {
    const count = countByType.get(type) ?? 0
    return { type, label, present: count > 0, count }
  })

  const suits = [...suitCounts.entries()]
    .map(([slug, count]) => ({ slug, label: suitLabel(slug), count }))
    .sort((a, b) => a.slug.localeCompare(b.slug))

  const axes = [...axisCounts.entries()]
    .map(([axis, count]) => ({ axis, label: axisLabel(axis), count }))
    .sort(
      (a, b) =>
        AXIS_ORDER.indexOf(a.axis) - AXIS_ORDER.indexOf(b.axis) ||
        a.axis.localeCompare(b.axis),
    )

  return { types, suits, axes }
}

/**
 * The active facet filter: `null` in a dimension means "all".
 *
 * One selection per group, matching the mockup's single-select rows. Selections
 * across groups combine with AND — a user reading "Claims in the Zionism-coded
 * suit on the Tactic axis" gets exactly that subgraph.
 */
export type FacetFilter = {
  readonly type: GraphNodeType | null
  readonly suit: string | null
  readonly axis: CardAxisValue | null
}

/** The unfiltered state: every dimension shows everything. */
export const NO_FACET_FILTER: FacetFilter = {
  type: null,
  suit: null,
  axis: null,
}

/**
 * Whether any navigator dimension is narrowing the projection.
 *
 * @param filter The current facet filter.
 */
export function hasActiveFacets(filter: FacetFilter): boolean {
  return filter.type !== null || filter.suit !== null || filter.axis !== null
}

/**
 * Whether a single node survives a facet filter.
 *
 * Suit/Axis filters are card-level classifications: a claim, mechanism or step
 * carries no Suit or Axis of its own, so under a Suit/Axis selection only card
 * nodes in that facet remain — their incident nodes follow through the edge
 * filter, not through a semantic claim the ontology never made.
 *
 * @param node The candidate node.
 * @param filter The active filter.
 * @returns `true` when the node matches every active dimension.
 */
export function nodeMatchesFacets(
  node: GraphNode,
  filter: FacetFilter,
): boolean {
  if (filter.type !== null && node.type !== filter.type) return false
  if (filter.suit !== null) {
    if (node.type !== 'card') return false
    if (!node.classification.suits.includes(filter.suit)) return false
  }
  if (filter.axis !== null) {
    if (node.type !== 'card') return false
    if (!node.classification.axes.some((entry) => entry.axis === filter.axis)) {
      return false
    }
  }
  return true
}

/**
 * Apply a facet filter, producing the projection the canvas and inspector read.
 *
 * Edges keep only pairs whose endpoints both survive, so the filtered graph
 * never shows a half-resolved relationship. `meta.nodeCount`/`edgeCount` are
 * recomputed; everything else in `meta` is a corpus fact and passes through.
 * Returns the input object unchanged when no filter is active.
 *
 * @param projection The loaded projection.
 * @param filter The active filter (use {@link NO_FACET_FILTER} for none).
 * @returns A filtered projection, or the same reference when unfiltered.
 */
export function applyFacetFilter(
  projection: GraphProjection,
  filter: FacetFilter,
): GraphProjection {
  if (!hasActiveFacets(filter)) return projection

  const kept = new Set(
    projection.nodes
      .filter((node) => nodeMatchesFacets(node, filter))
      .map((node) => node.id),
  )
  const nodes = projection.nodes.filter((node) => kept.has(node.id))
  const edges = projection.edges.filter(
    (edge) => kept.has(edge.from) && kept.has(edge.to),
  )

  return {
    ...projection,
    nodes,
    edges,
    meta: {
      ...projection.meta,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  }
}

/**
 * Human label for a Suit slug, with a slug-shaped fallback for unknown suits.
 *
 * Exported for the Deck's classification tags: a Suit is displayed from this
 * vocabulary (`fact-rebuttal` reads `Reference`, not `Fact rebuttal`), never
 * re-humanized. Other dimensions must not use it — a Locale called
 * `fact-rebuttal` would be a different word with a different origin.
 *
 * @param slug The `collections.slug` to label.
 * @returns The vocabulary label, or a humanized slug when unknown.
 */
export function suitLabel(slug: string): string {
  return SUIT_LABELS[slug] ?? humanize(slug)
}

/** Human label for a `card_axis` value. */
function axisLabel(axis: CardAxisValue): string {
  return AXIS_LABELS[axis]
}

/**
 * `kebab-slug` → `Kebab slug`. Presentation only; never parsed back.
 *
 * Used for Mechanisms and Locales, which have no label vocabulary of their
 * own, and as the Suit fallback for a slug outside the known five.
 *
 * @param value The slug to humanize.
 * @returns The display form of the slug.
 */
export function humanize(value: string): string {
  return value
    .split('-')
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(' ')
}

/**
 * Render an ontology token as readable words (`HAS_CONCEPT` → `Has concept`).
 *
 * Presentation only — the raw token stays in the `data-*` attributes wherever
 * this is used, so nothing becomes un-addressable. Shared by the inspector and
 * the control strip so a relation word or node type reads the same everywhere.
 *
 * @param token A relation word, edge family, node type or source tag.
 * @returns The token with underscores as spaces and a leading capital.
 */
export function humanizeToken(token: string): string {
  const words = token.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
