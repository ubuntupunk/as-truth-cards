/**
 * The Cytoscape stylesheet: adapter classes → visual style.
 *
 * Cytoscape receives two inputs from the presentation layer — `elements` (from
 * `cytoscape-adapter.ts`) and this stylesheet — and both are pure data. This
 * module is the *only* place a visual convention is defined, and every rule
 * keys off a class the adapter already puts on an element. No rule reads a
 * semantic field, no rule invents a class, and no rule encodes information the
 * projection did not carry.
 *
 * ## Class → style map
 *
 * | Class | Source | Style |
 * |---|---|---|
 * | `node` | base | ellipse 36px, label below with white halo |
 * | `.type-{nodeType}` | `node.type` | `background-color` from the treatment's node palette |
 * | `.status-{source}` | `status.source` | `border-style` per vocabulary (see {@link STATUS_BORDER_STYLES}) |
 * | `.is-focus` | `isFocus` | amber ring, larger body, raised `z-index` |
 * | `edge` | base | bezier, arrow on `target` (authored direction), relation word as label |
 * | `.family-{family}` | `family` | `line-color`/`target-arrow-color` from the treatment's edge palette |
 * | `.traversal-bidirectional` | `traversal` | dashed line — *traversal* may walk against the arrow |
 * | `.selected` | presentation state (page) | translucent blue overlay |
 *
 * ## Appearance treatments
 *
 * `buildGraphStylesheet(treatment)` repaints the canvas from the treatment's
 * node/edge palettes in `appearance.ts`; everything else (geometry, status
 * borders, focus/selection, the relation-word labels) is identical across
 * treatments. `GRAPH_STYLESHEET` is the atmospheric default, so removing the
 * appearance system would not change the current canvas.
 *
 * ## What is deliberately absent
 *
 * - **`relation-*` selectors.** The adapter emits them, but styling each
 *   relation word would mean enumerating five vocabularies
 *   (`claim_relation_type`, `relationship_type`, …) inside a stylesheet —
 *   exactly the hard-coded ontology the plan forbids. The relation word is
 *   already shown on every edge as `label: data(relation)`, and the edge
 *   inspector renders it alongside its `family` and `sourceTable`. A test
 *   pins the absence so a future "just one more relation color" edit fails
 *   loudly.
 * - **Status *values*.** The adapter classes on `status.source` (the
 *   vocabulary), never on the value. A stylesheet that coloured `CONTESTED`
 *   differently from `ESTABLISHED` would be presenting a cross-type status
 *   comparison as decoration — Q4 keeps status per node type, and the
 *   inspector shows the source tag next to every value.
 * - **Depth/degree gradients.** Presenting hop distance as colour would
 *   imply a semantic scale the projection does not assert.
 *
 * Colour roles are exported so the page legend reads the *same* maps the
 * stylesheet was built from; a legend that restated the palette would be a
 * second source of truth for a purely visual fact.
 */

import type { Css, StylesheetJsonBlock } from 'cytoscape'
import type {
  EdgeFamily,
  GraphNodeType,
  NodeStatus,
} from '../../trope-cards/src/graph/types.ts'
import { GRAPH_TREATMENT_TOKENS, type GraphTreatment } from './appearance.ts'

/**
 * Fill colour per node type (atmospheric palette).
 *
 * Twelve hues for twelve `GraphNodeType` members; typed as
 * `Record<GraphNodeType, …>` so adding a node type to the domain union
 * without choosing its colour is a compile error. The value is the
 * atmospheric treatment's palette so existing imports keep resolving while
 * `buildGraphStylesheet` owns per-treatment repainting.
 */
export const NODE_TYPE_COLORS: Record<GraphNodeType, string> =
  GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors

/**
 * Line/arrow colour per edge family (atmospheric palette).
 *
 * The seven `EdgeFamily` members. Same compile-time guarantee as
 * {@link NODE_TYPE_COLORS}: a new family cannot ship unstyled.
 */
export const EDGE_FAMILY_COLORS: Record<EdgeFamily, string> =
  GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors

/**
 * Border style per status *source* — never per status value.
 *
 * The five `NodeStatus.source` variants. The style says *which vocabulary*
 * the status came from (and that `none` means "no truth claim at all"); the
 * inspector says what the value is.
 */
export const STATUS_BORDER_STYLES: Record<NodeStatus['source'], Css.LineStyle> =
  {
    epistemic_status: 'solid',
    independent_inference_status: 'double',
    evidence_status: 'dotted',
    lifecycle_status: 'dashed',
    none: 'solid',
  }

/** Light border for taxonomy nodes, which carry no truth claim (`source: none`). */
const STATUS_NONE_BORDER = '#cbd5e1'

/**
 * Build the Cytoscape stylesheet for one appearance treatment.
 *
 * Only the node/edge palettes vary per treatment — geometry, status borders,
 * focus/selection, and edge labels are shared. Callers wanting the default
 * canvas need no argument.
 *
 * @param treatment The appearance treatment; defaults to `'atmospheric'`.
 * @returns The stylesheet, as `cytoscape({ style })` consumes it.
 * @example
 * ```ts
 * const cy = cytoscape({
 *   container,
 *   elements,
 *   style: buildGraphStylesheet(treatment),
 * })
 * ```
 */
export function buildGraphStylesheet(
  treatment: GraphTreatment = 'atmospheric',
): StylesheetJsonBlock[] {
  const { nodeColors, edgeColors } = GRAPH_TREATMENT_TOKENS[treatment]
  return [
    // --- nodes: base -------------------------------------------------------
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        color: '#0f172a',
        'font-size': 11,
        'text-outline-color': '#ffffff',
        'text-outline-width': 2,
        'text-wrap': 'ellipsis',
        'text-max-width': '140',
        shape: 'ellipse',
        width: 36,
        height: 36,
        'background-color': '#94a3b8',
        'border-width': 2,
        'border-style': 'solid',
        'border-color': '#334155',
      },
    },
    // --- nodes: one fill per type -----------------------------------------
    ...nodeTypeRules(nodeColors),
    // --- nodes: status vocabulary border ----------------------------------
    ...statusRules(),
    // --- nodes: focus marker (wins over .type-* at equal specificity) ------
    {
      selector: '.is-focus',
      style: {
        width: 48,
        height: 48,
        'border-width': 5,
        'border-color': '#d97706',
        'z-index': 10,
      },
    },
    // --- edges: base -------------------------------------------------------
    {
      selector: 'edge',
      style: {
        label: 'data(relation)',
        'font-size': 9,
        color: '#0f172a',
        'text-outline-color': '#ffffff',
        'text-outline-width': 2,
        'text-rotation': 'autorotate',
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.9,
        width: 1.6,
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        'line-style': 'solid',
      },
    },
    // --- edges: one line colour per family --------------------------------
    ...edgeFamilyRules(edgeColors),
    // --- edges: walk rule != authored direction ---------------------------
    {
      selector: '.traversal-bidirectional',
      style: {
        // The arrow (authored direction) is unchanged; the dash says "traversal
        // may also walk against this arrow". It is a walk rule, not a claim
        // that the edge is weaker or unauthoritative.
        'line-style': 'dashed',
      },
    },
    // --- presentation state (page-owned, last so it wins) ------------------
    {
      selector: '.selected',
      style: {
        'overlay-color': '#2563eb',
        'overlay-opacity': 0.18,
        'overlay-padding': 6,
      },
    },
  ]
}

/**
 * The atmospheric stylesheet, as `cytoscape({ style })` consumes it.
 *
 * Order matters and is part of the contract: base selectors first, then
 * `.type-*`/`.family-*`, then `.status-*`, then the presentation-state rules
 * (`.is-focus`, `.selected`) last so they win at equal specificity. A test
 * asserts each selector appears exactly once, because a duplicated rule
 * silently turns cascade order into a bug.
 *
 * @example
 * ```ts
 * const cy = cytoscape({ container, elements, style: GRAPH_STYLESHEET })
 * ```
 */
export const GRAPH_STYLESHEET: StylesheetJsonBlock[] =
  buildGraphStylesheet('atmospheric')

/** `.type-*` fill rules, in `GraphNodeType` declaration order. */
function nodeTypeRules(
  nodeColors: Record<GraphNodeType, string>,
): StylesheetJsonBlock[] {
  return (Object.keys(nodeColors) as GraphNodeType[]).map((type) => ({
    selector: `.type-${type}`,
    style: { 'background-color': nodeColors[type] },
  }))
}

/** `.status-*` border rules; `none` gets the lighter "no truth claim" border. */
function statusRules(): StylesheetJsonBlock[] {
  return (Object.keys(STATUS_BORDER_STYLES) as NodeStatus['source'][]).map(
    (source) => ({
      selector: `.status-${source}`,
      style: {
        'border-style': STATUS_BORDER_STYLES[source],
        ...(source === 'none' ? { 'border-color': STATUS_NONE_BORDER } : {}),
      },
    }),
  )
}

/** `.family-*` line/arrow rules, in `EdgeFamily` declaration order. */
function edgeFamilyRules(
  edgeColors: Record<EdgeFamily, string>,
): StylesheetJsonBlock[] {
  return (Object.keys(edgeColors) as EdgeFamily[]).map((family) => ({
    selector: `.family-${family}`,
    style: {
      'line-color': edgeColors[family],
      'target-arrow-color': edgeColors[family],
    },
  }))
}
