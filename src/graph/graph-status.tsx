/**
 * The Graph Explorer's Classification / Provenance / Reasoning status strip.
 *
 * This is the honest progress readout of a research workspace: three status
 * cells that answer "what does the *corpus* currently support in this view"
 * without ever inventing presence. The semantic distinction the whole strip
 * encodes is the INSTRUCTION one:
 *
 * - **Classification describes an entity** — cards' axes/suits/facets.
 * - **Provenance documents its origin** — the `source` family (`claim_sources`).
 * - **Reasoning connects claims** — the `claim_relation` + `inference` families.
 *
 * The three cells must never be collapsed into one another, and an absent
 * family must never read as a zero result. Every readout is derived from the
 * view descriptor (what the view can even carry) *and* the projection (what the
 * corpus actually returned); the strip is purple-on-projection, never purple
 * on opinion.
 *
 * `deriveGraphStatus` is pure data + pure functions (no JSX) so the whole
 * honesty contract is testable under Node without rendering.
 */

import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'
import type { GraphViewDescriptor } from './projection-guards'

/** The three status cells, matching the INSTRUCTION's shared IA. */
export const STATUS_LABELS = {
  classification: 'Classification',
  provenance: 'Provenance',
  reasoning: 'Reasoning',
} as const

/**
 * How a cell reads on screen.
 *
 * - `ok` — the view carries this dimension and the projection populated it
 *   (or truthfully reports none; the value string says which).
 * - `absent` — the view never asks for this dimension, so there is no fact
 *   to report. Never rendered as a zero.
 * - `data-blocked` — the view wants it but the corpus cannot: a `blockingGap`
 *   or an excluded node type (e.g. "0 rows in sources"). The value still shows
 *   whatever the projection did return; the note names the block.
 * - `pending` — no projection loaded yet; the cell is a dash, not a claim.
 */
export type StatusReadoutState = 'ok' | 'absent' | 'data-blocked' | 'pending'

/** One status cell: what it reports, how, and (when blocked) why. */
export type StatusReadout = {
  /** Classification / Provenance / Reasoning. */
  label: (typeof STATUS_LABELS)[keyof typeof STATUS_LABELS]
  state: StatusReadoutState
  /** The projection-derived value, e.g. "4 cards · 3 facet edges". */
  value: string
  /** Reason only when `state` is `data-blocked`. */
  note?: string
}

/** The three readouts of one status strip. */
export type GraphStatus = {
  classification: StatusReadout
  provenance: StatusReadout
  reasoning: StatusReadout
}

/** Node types that answer the "classification" question for a card graph. */
const CLASSIFICATION_TYPES: readonly string[] = [
  'card',
  'collection',
  'mechanism',
  'concept',
]

/** Node types that answer the "provenance" question. */
const PROVENANCE_TYPES: readonly string[] = ['source']

/** Edge families that answer the "reasoning" question. */
const REASONING_FAMILIES: readonly string[] = ['claim_relation', 'inference']

/** Whether a descriptor carries one of the wanted families. */
function declaresFamily(
  descriptor: GraphViewDescriptor | null,
  families: readonly string[],
): boolean {
  return (
    descriptor?.edgeFamilies.some((family) => families.includes(family)) ??
    false
  )
}

/** Whether a descriptor's nodeTypes include any of the wanted types. */
function declaresType(
  descriptor: GraphViewDescriptor | null,
  types: readonly string[],
): boolean {
  return descriptor?.nodeTypes.some((type) => types.includes(type)) ?? false
}

/**
 * The corpus-level reason a dimension is data-blocked, or `null`.
 *
 * @param descriptor The selected view's rule.
 * @param wantedTypes Node types whose exclusion would block the dimension.
 * @param gapPattern Substrings of `blockingGaps` that signal the same block.
 * @returns The server's own reason string, or `null` when not blocked.
 */
function findBlock(
  descriptor: GraphViewDescriptor | null,
  wantedTypes: readonly string[],
  gapPattern: readonly string[],
): string | null {
  if (descriptor === null) return null
  const excluded = descriptor.excludedNodeTypes.find((entry) =>
    wantedTypes.includes(entry.type),
  )
  if (excluded) return excluded.reason
  const gap = descriptor.blockingGaps.find((gapEntry) =>
    gapPattern.some((marker) => gapEntry.toLowerCase().includes(marker)),
  )
  return gap ?? null
}

/** The pre-load placeholder cells (projection is still pending). */
function pendingStatus(): GraphStatus {
  const pending = (label: StatusReadout['label']): StatusReadout => ({
    label,
    state: 'pending',
    value: '—',
  })
  return {
    classification: pending(STATUS_LABELS.classification),
    provenance: pending(STATUS_LABELS.provenance),
    reasoning: pending(STATUS_LABELS.reasoning),
  }
}

/**
 * Compute the status readouts for a loaded projection and its view rule.
 *
 * Counts are always projection-derived; empty counts are reported as the real
 * numbers (never fabricated presence, never fabricated absence). A dimension
 * the view does not carry gets `absent`; one the view carries but the corpus
 * blocks gets `data-blocked` with the server's own reason.
 *
 * @param projection The loaded projection, or `null` while loading.
 * @param descriptor The selected view's rule, when the catalogue loaded.
 * @returns The three derived readouts.
 */
export function deriveGraphStatus(
  projection: GraphProjection | null,
  descriptor: GraphViewDescriptor | null,
): GraphStatus {
  if (projection === null) return pendingStatus()

  const cards = projection.nodes.filter((node) => node.type === 'card').length
  const facetEdges = projection.edges.filter(
    (edge) => edge.family === 'classification',
  ).length
  const sourceNodes = projection.nodes.filter(
    (node) => node.type === 'source',
  ).length
  const sourceEdges = projection.edges.filter(
    (edge) => edge.family === 'source',
  ).length
  const relationEdges = projection.edges.filter((edge) =>
    REASONING_FAMILIES.includes(edge.family),
  ).length
  const relationOnly = projection.edges.filter(
    (edge) => edge.family === 'claim_relation',
  ).length
  const inferenceOnly = relationEdges - relationOnly

  const classificationDeclared =
    declaresFamily(descriptor, ['classification']) ||
    declaresType(descriptor, CLASSIFICATION_TYPES)
  const provenanceDeclared =
    declaresFamily(descriptor, ['source']) ||
    declaresType(descriptor, PROVENANCE_TYPES)
  const reasoningDeclared = declaresFamily(descriptor, REASONING_FAMILIES)

  const classificationBlock = findBlock(descriptor, CLASSIFICATION_TYPES, [
    'mechanism',
    'concept',
    'card_axes',
    'suit',
    'locale',
  ])
  const provenanceBlock = findBlock(descriptor, PROVENANCE_TYPES, ['source'])
  const reasoningBlock = findBlock(
    descriptor,
    [],
    ['claim_relation', 'inference'],
  )

  return {
    classification: {
      label: STATUS_LABELS.classification,
      state: !classificationDeclared
        ? 'absent'
        : classificationBlock !== null
          ? 'data-blocked'
          : 'ok',
      value: `${cards} card${cards === 1 ? '' : 's'} · ${facetEdges} facet edge${
        facetEdges === 1 ? '' : 's'
      }`,
      ...(classificationBlock !== null ? { note: classificationBlock } : {}),
    },
    provenance: {
      label: STATUS_LABELS.provenance,
      state: !provenanceDeclared
        ? 'absent'
        : provenanceBlock !== null
          ? 'data-blocked'
          : 'ok',
      value: `${sourceNodes} source node${
        sourceNodes === 1 ? '' : 's'
      } · ${sourceEdges} attribution edge${sourceEdges === 1 ? '' : 's'}`,
      ...(provenanceBlock !== null ? { note: provenanceBlock } : {}),
    },
    reasoning: {
      label: STATUS_LABELS.reasoning,
      state: !reasoningDeclared
        ? 'absent'
        : reasoningBlock !== null
          ? 'data-blocked'
          : 'ok',
      value: `${relationOnly} claim relation${
        relationOnly === 1 ? '' : 's'
      } · ${inferenceOnly} inference edge${inferenceOnly === 1 ? '' : 's'}`,
      ...(reasoningBlock !== null ? { note: reasoningBlock } : {}),
    },
  }
}

/** The per-state tailwind treatments for a status cell. */
const STATE_TREATMENT: Record<StatusReadoutState, string> = {
  ok: 'border-graph-border/70 bg-graph-surface text-foreground',
  absent: 'border-graph-border/50 bg-graph-muted text-muted-foreground',
  'data-blocked':
    'border-graph-status-warn/40 bg-graph-status-warn/10 text-amber-700 dark:text-amber-300',
  pending: 'border-graph-border/50 bg-graph-muted text-muted-foreground',
}

/** The state label shown under each value, so a blocked cell never looks ok. */
const STATE_CAPTION: Record<StatusReadoutState, string | null> = {
  ok: null,
  absent: 'not in this view',
  'data-blocked': 'data-blocked',
  pending: null,
}

/**
 * The status strip at the foot of the Graph Explorer workspace body.
 *
 * Renders Classification, Provenance and Reasoning from
 * {@link deriveGraphStatus}. Exactly the three cells of the shared IA; a cell
 * is never merged, hidden, or turned into a fabricated zero.
 *
 * @param props.projection The loaded projection, or `null` while loading.
 * @param props.descriptor The selected view's rule, when loaded.
 * @returns A `<section>` with the three readouts.
 */
export function GraphStatusStrip({
  projection,
  descriptor,
}: {
  projection: GraphProjection | null
  descriptor: GraphViewDescriptor | null
}) {
  const status = deriveGraphStatus(projection, descriptor)
  const cells: readonly (keyof GraphStatus)[] = [
    'classification',
    'provenance',
    'reasoning',
  ]
  return (
    <section
      data-testid="graph-status"
      aria-label="Graph status: classification, provenance, reasoning"
      className="rounded-xl border border-graph-border bg-graph-surface"
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-graph-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Classification describes an entity</span>
          <span className="text-graph-muted-foreground">·</span>
          <span>Provenance documents its origin</span>
          <span className="text-graph-muted-foreground">·</span>
          <span>Reasoning connects claims</span>
        </div>
      </div>
      <div className="grid gap-px sm:grid-cols-3">
        {cells.map((key) => {
          const readout = status[key]
          const caption = STATE_CAPTION[readout.state]
          return (
            <div
              key={key}
              data-readout={key}
              data-state={readout.state}
              className={`p-4 ${STATE_TREATMENT[readout.state]}`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {readout.label}
              </div>
              <div className="mt-1 text-sm font-medium">{readout.value}</div>
              {caption !== null ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {caption}
                </div>
              ) : null}
              {readout.note !== undefined ? (
                <div
                  className="mt-0.5 text-xs text-muted-foreground"
                  data-block-note
                >
                  {readout.note}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
