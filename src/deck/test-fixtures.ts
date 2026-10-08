/**
 * Shared fixtures for the `src/deck/*.test.tsx` suite.
 *
 * The cards are *listing*-shaped: exactly what `GET /api/graph/cards` returns
 * (`CardRow` + the classification assembly), so a render test can prove the
 * card panel consumes the wire contract rather than a hand-tuned local shape.
 * The classification reuses `FOCUS_CARD_NODE`'s on purpose — it is the
 * fixture that carries every dimension at once, including the `south-africa`
 * Suit *and* `south-africa` Locale with distinct ids, which is the pair a
 * classification chip must keep apart.
 *
 * `walk` is the shared vnode walker (copied from the graph suite's local
 * copy): a pure component is a function, so tests can descend its returned
 * tree, read props, and invoke `onClick` without a DOM.
 */

import type { VNode } from 'preact'
import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import type {
  GraphNode,
  GraphProjection,
} from '../../trope-cards/src/graph/types.ts'
import {
  DEFAULT_VIEW_NAME,
  GRAPH_VIEWS,
} from '../../trope-cards/src/graph/views.ts'
import type { GraphViewDescriptor } from '../graph/projection-guards'
import { CARD_PROJECTION, FOCUS_CARD_NODE, ID } from '../graph/test-fixtures'

/** An open, unverified card carrying all four classification dimensions. */
export const OPEN_CARD: CardListingRow = {
  id: 'bf000000-0000-0000-0000-00000000f001',
  slug: 'an-open-question',
  title: 'An open question about troop levels',
  summary: 'Whether the figure was inflated is still being checked.',
  coreQuestion: 'Was the figure inflated?',
  primaryType: 'CASE',
  epistemicStatus: 'OPEN',
  classification: FOCUS_CARD_NODE.classification,
}

/** An established card with no summary and no authored core question. */
export const ESTABLISHED_CARD: CardListingRow = {
  id: 'bf000000-0000-0000-0000-00000000f002',
  slug: 'an-established-fact',
  title: 'An established case',
  summary: null,
  coreQuestion: null,
  primaryType: 'CASE',
  epistemicStatus: 'ESTABLISHED',
  classification: {
    axes: [{ axis: 'THEOLOGICAL', ordinal: 0, primary: true }],
    suits: ['foundational'],
    suitIds: ['bf000000-0000-0000-0000-00000000f102'],
    mechanismSlugs: [],
    mechanismIds: [],
    localeSlugs: [],
    localeIds: [],
  },
}

/** A contested card classified only by one axis and one Locale. */
export const CONTESTED_CARD: CardListingRow = {
  id: 'bf000000-0000-0000-0000-00000000f003',
  slug: 'a-contested-reading',
  title: 'A contested historical reading',
  summary: 'Two readings of the same event disagree.',
  coreQuestion: null,
  primaryType: 'CASE',
  epistemicStatus: 'CONTESTED',
  classification: {
    axes: [{ axis: 'HISTORICAL', ordinal: 0, primary: true }],
    suits: [],
    suitIds: [],
    mechanismSlugs: [],
    mechanismIds: [],
    localeSlugs: ['south-africa'],
    localeIds: ['bf000000-0000-0000-0000-00000000f103'],
  },
}

/** The three cards, in listing order. */
export const ALL_CARDS: readonly CardListingRow[] = [
  OPEN_CARD,
  ESTABLISHED_CARD,
  CONTESTED_CARD,
]

/** A tree of vnodes and plain values, as JSX nests them. */
type Tree = unknown

/**
 * Collect every vnode in a tree whose type matches, descending into function
 * components by calling them (they are pure, so this is just rendering).
 *
 * @param root A vnode, an array of them, or `null`.
 * @param matches Selects the vnodes to collect.
 * @returns The matching vnodes, in document order.
 */
export function walk(
  root: Tree,
  matches: (vnode: VNode & { props?: Record<string, unknown> }) => boolean,
): (VNode & { props?: Record<string, unknown> })[] {
  const out: (VNode & { props?: Record<string, unknown> })[] = []
  const descend = (value: Tree): void => {
    if (value === null || value === undefined || typeof value !== 'object')
      return
    if (Array.isArray(value)) {
      for (const item of value) descend(item)
      return
    }
    const vnode = value as VNode & { props?: Record<string, unknown> }
    if (matches(vnode)) {
      out.push(vnode)
      return
    }
    if (typeof vnode.type === 'function') {
      descend((vnode.type as (props: unknown) => unknown)(vnode.props))
      return
    }
    descend(vnode.props?.children)
    if (vnode.props) {
      for (const [key, child] of Object.entries(vnode.props)) {
        if (key !== 'children') descend(child)
      }
    }
  }
  descend(root)
  return out
}

/**
 * Every `<button>` in a rendered tree or vnode.
 *
 * @param root The tree to search.
 * @returns The button vnodes found.
 */
export function buttons(root: Tree): (VNode & {
  props?: Record<string, unknown>
})[] {
  return walk(root, (vnode) => vnode.type === 'button')
}

/**
 * The buttons whose direct text child equals `label`.
 *
 * @param root The tree to search.
 * @param label The exact button label.
 * @returns The matching button vnodes.
 */
export function buttonsLabelled(
  root: Tree,
  label: string,
): ReturnType<typeof buttons> {
  return buttons(root).filter((button) => button.props?.children === label)
}

/**
 * The text a button's children render, flattened — an icon child is skipped
 * and the label parts are joined, so `Read front & back` matches whether the
 * JSX kept it as one string or several.
 *
 * @param button The button vnode to read.
 * @returns Its concatenated text.
 */
export function childText(button: VNode & { props?: unknown }): string {
  const children = (button.props as { children?: Tree } | undefined)?.children
  const parts: string[] = []
  const collect = (value: Tree): void => {
    if (typeof value === 'string' || typeof value === 'number')
      parts.push(String(value))
    else if (Array.isArray(value)) for (const item of value) collect(item)
  }
  collect(children)
  return parts.join('')
}

/**
 * The first button whose rendered text includes `text`.
 *
 * @param root The tree to search.
 * @param text The substring to look for.
 * @returns The matching button, or `undefined`.
 */
export function buttonByText(
  root: Tree,
  text: string,
): (VNode & { props?: Record<string, unknown> }) | undefined {
  return buttons(root).find((button) => childText(button).includes(text))
}

/**
 * The `card-argument-taxonomy` descriptor as the catalogue actually ships it.
 *
 * Built from the server's own view rule instead of a hand-typed literal, so a
 * view change (a type admitted, an exclusion reworded) reaches these tests the
 * moment the server changes. The deck reads every count through this
 * descriptor, and a stale copy would be testing a view nobody serves — the
 * shared graph fixture's synthetic view, for instance, excludes `source`, the
 * one dimension a real depth-2 payload always carries.
 *
 * @returns The descriptor `/api/graph/views` reports for the default view.
 */
function descriptorOfDefaultView(): GraphViewDescriptor {
  const rule = GRAPH_VIEWS.get(DEFAULT_VIEW_NAME)
  if (rule === undefined) {
    throw new Error(`no view rule named "${DEFAULT_VIEW_NAME}"`)
  }
  return { ...rule, populated: true, blockingGaps: [] }
}

/** The default view's descriptor, for deriving previews in tests. */
export const CARD_VIEW: GraphViewDescriptor = descriptorOfDefaultView()

/** `claim --ATTRIBUTED_TO--> source`, as `claim_sources` projects it. */
const SOURCE_ATTRIBUTION_EDGE: GraphProjection['edges'][number] = {
  id: `source|${ID.claimOne}|ATTRIBUTED_TO|${ID.sourceS}`,
  family: 'source',
  type: { family: 'source', value: 'ATTRIBUTED_TO' },
  sourceTable: 'claim_sources',
  from: ID.claimOne,
  to: ID.sourceS,
  attributes: {},
  traversal: 'directed',
}

/**
 * The rich projection with its claim→source attribution edge.
 *
 * The shared graph fixture ships the source *node* with no edge to it, which
 * is a payload the server never produces: attribution is exactly how a source
 * becomes reachable. The deck's provenance count and its sources reading list
 * both walk edges, so without this edge they would report an absence the real
 * projection does not have.
 */
export const DECK_PROJECTION: GraphProjection = {
  ...CARD_PROJECTION,
  edges: [...CARD_PROJECTION.edges, SOURCE_ATTRIBUTION_EDGE],
  meta: {
    ...CARD_PROJECTION.meta,
    edgeCount: CARD_PROJECTION.meta.edgeCount + 1,
  },
}

/**
 * What a depth-1 request returns: everything the projection reached in one
 * hop, and nothing beyond it.
 *
 * This is the shape behind the deck's original fabricated-zeros bug — no
 * `inference_step`, no `source` at all — so a readout over it must say the
 * dimension sits deeper rather than reporting `0`.
 */
export const SHALLOW_PROJECTION: GraphProjection = (() => {
  const nodes = CARD_PROJECTION.nodes.filter((node) => node.depth <= 1)
  const present = new Set(nodes.map((node) => node.id))
  const edges = CARD_PROJECTION.edges.filter(
    (edge) => present.has(edge.from) && present.has(edge.to),
  )
  return {
    ...CARD_PROJECTION,
    depth: 1,
    nodes,
    edges,
    meta: {
      ...CARD_PROJECTION.meta,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      reachedDepth: 1,
    },
  }
})()

/** A neighbour card's claim, reasoning step and source: not this card's rows. */
const NEIGHBOUR_NODES: readonly GraphNode[] = [
  {
    id: 'bf000000-0000-0000-0000-000000000112',
    type: 'claim',
    label: "A neighbour card's claim",
    depth: 2,
    isFocus: false,
    degree: 3,
    status: { source: 'epistemic_status', value: 'CONTESTED' },
    metadata: {
      claimType: 'HISTORICAL',
      description: 'Asserted by another card, not by the featured one.',
      cardId: ID.cardTwo,
    },
  },
  {
    id: 'bf000000-0000-0000-0000-000000000122',
    type: 'inference_step',
    label: "A neighbour card's step",
    depth: 3,
    isFocus: false,
    degree: 2,
    status: {
      source: 'independent_inference_status',
      value: 'draft',
      vocabulary: 'uncontrolled',
    },
    metadata: {
      description: "Bridges the neighbour card's claims.",
      inferenceType: 'DEDUCTIVE',
      notes: null,
      isCanonical: true,
      cardId: ID.cardTwo,
      chains: [],
      premises: [],
      conclusions: [],
    },
  },
  {
    id: 'bf000000-0000-0000-0000-000000000172',
    type: 'source',
    label: "A neighbour card's source",
    depth: 3,
    isFocus: false,
    degree: 1,
    status: { source: 'none', value: null },
    metadata: {
      title: "A neighbour card's source",
      author: 'B. Author',
      publisher: 'B Press',
      citation: 'B. Author, Another source (B Press, 2026).',
      url: 'https://example.test/neighbour',
      sourceType: 'PRIMARY_DOCUMENT',
    },
  },
]

const NEIGHBOUR_EDGES: GraphProjection['edges'] = [
  {
    id: 'domain|bf000000-0000-0000-0000-000000000002|ASSERTS|bf000000-0000-0000-0000-000000000112',
    family: 'domain',
    type: { family: 'domain', value: 'ASSERTS' },
    sourceTable: 'claims',
    from: ID.cardTwo,
    to: 'bf000000-0000-0000-0000-000000000112',
    attributes: {},
    traversal: 'directed',
  },
  {
    id: 'claim_relation|bf000000-0000-0000-0000-000000000011|SUPPORTS|bf000000-0000-0000-0000-000000000112',
    family: 'claim_relation',
    type: { family: 'claim_relation', value: 'SUPPORTS' },
    sourceTable: 'claim_relations',
    from: ID.claimOne,
    to: 'bf000000-0000-0000-0000-000000000112',
    attributes: {},
    traversal: 'bidirectional',
  },
  {
    id: 'source|bf000000-0000-0000-0000-000000000112|ATTRIBUTED_TO|bf000000-0000-0000-0000-000000000172',
    family: 'source',
    type: { family: 'source', value: 'ATTRIBUTED_TO' },
    sourceTable: 'claim_sources',
    from: 'bf000000-0000-0000-0000-000000000112',
    to: 'bf000000-0000-0000-0000-000000000172',
    attributes: {},
    traversal: 'directed',
  },
  {
    id: 'inference|bf000000-0000-0000-0000-000000000112|PREMISE_OF|bf000000-0000-0000-0000-000000000122',
    family: 'inference',
    type: { family: 'inference', value: 'PREMISE_OF' },
    sourceTable: 'inference_premises',
    from: 'bf000000-0000-0000-0000-000000000112',
    to: 'bf000000-0000-0000-0000-000000000122',
    attributes: { role: 'PRIMARY', ordinal: 0 },
    traversal: 'bidirectional',
  },
]

/**
 * The depth-2 reality: a neighbour card's claim, step and source hang off the
 * featured card's own rows.
 *
 * This is what makes card-scoped counting necessary — a payload-wide count
 * would report the neighbour's claim, step and source as this card's.
 */
export const NEIGHBOUR_PROJECTION: GraphProjection = {
  ...DECK_PROJECTION,
  nodes: [...DECK_PROJECTION.nodes, ...NEIGHBOUR_NODES],
  edges: [...DECK_PROJECTION.edges, ...NEIGHBOUR_EDGES],
  meta: {
    ...DECK_PROJECTION.meta,
    nodeCount: DECK_PROJECTION.nodes.length + NEIGHBOUR_NODES.length,
    edgeCount: DECK_PROJECTION.edges.length + NEIGHBOUR_EDGES.length,
  },
}

/** The featured card's uuid in every fixture above. */
export const FEATURED_CARD_ID = ID.focusCard
