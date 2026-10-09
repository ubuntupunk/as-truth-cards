/**
 * The Entity Inspector — the semantic side panel of the Graph page.
 *
 * Issue #3 §4.1 boundary, enforced structurally: the inspector reads the **domain
 * projection** via the selected node's canonical id and never touches Cytoscape.
 * Cytoscape selection is presentation state carried up to the page as
 * `{ kind, id }`; the inspector re-finds that entity inside `projection.nodes` /
 * `projection.edges`, so a graph whose elements were re-rendered, re-laid-out or
 * re-styled can never feed the inspector anything but the projection itself.
 *
 * Rendering rules that keep the ontology honest:
 *
 * - **Status is per node type and never rolled up.** Every status row prints the
 *   value *and* the words for its source vocabulary (`CONTESTED · Epistemic
 *   status`), so a reader cannot absorb a value while missing which vocabulary
 *   it belongs to — the exact collapse Q4 forbids. An `epistemic_status` value
 *   is rendered through {@link cardStatusLabel}, the same approved token Decks
 *   and Explore use (`OPEN · UNVERIFIED`, `CONTEXT-DEPENDENT`), never as the
 *   raw enum; the schema token itself stays in the row's `data-*` attributes.
 * - **Suit and Locale are separate dimensions.** A node classified under the
 *   `south-africa` Suit and set in the `south-africa` Locale renders two
 *   distinct facet lists under their own headings; the underlying ids are kept
 *   for tooling in each row's `data-id`, not shown in the default read.
 * - **Concept and Mechanism come from different sources** and stay separate:
 *   Mechanisms from the card's `classification.mechanismIds`, Concepts from the
 *   incident `HAS_CONCEPT` classification edges.
 * - **A claim relation is not an inference.** The edge panel names each relation
 *   in words and shows its `family` beside it, so `claim_relation: SUPPORTS` and
 *   `card_relationship: SUPPORTS` cannot be visually merged. The backing table
 *   name is schema detail, kept behind Technical details.
 * - **`legacyPrimaryType` is secondary.** It is retained for migration but moved
 *   behind Technical details, labelled `(legacy, not an axis)`, because dropping
 *   authored data is silent loss while nothing may read it as a classification.
 * - **Canonical ids and backing tables are opt-in.** Schema identifiers live in
 *   `data-*` attributes and a collapsed Technical details disclosure, never in
 *   the default research read (SPEC §10: presentation does not leak the model).
 *
 * The component is pure — props in, string out — which is what lets
 * `preact-render-to-string` test it under Node. Interaction is limited to two
 * navigations: the "Open card" button that moves the projection to another
 * card's slug, and the refocus button: a claim or argument chain re-focuses in
 * the argument view (the registered view whose `focusTypes` accepts both), a
 * source or evidence item in the evidence view (the only one that accepts
 * those).
 */

import { cardStatusLabel } from '@/deck/deck-status'
import type {
  CardClassification,
  CardNode,
  GraphEdge,
  GraphNode,
  GraphProjection,
} from '../../trope-cards/src/graph/types.ts'
import {
  ARGUMENT_VIEW_NAME,
  EVIDENCE_VIEW_NAME,
} from '../../trope-cards/src/graph/views.ts'
import {
  AXIS_LABELS,
  AXIS_ORDER,
  SUIT_DOT_COLORS,
  SUIT_LABELS,
} from './deck-facets'
import type { GraphViewDescriptor } from './projection-guards'

/** Selection state as the page sees it: presentation-only entity identity. */
export type InspectorSelection =
  | { readonly kind: 'node'; readonly id: string }
  | { readonly kind: 'edge'; readonly id: string }
  | null

/**
 * Node types the inspector offers to re-focus the projection onto.
 *
 * Exactly the non-card types whose uuid a registered view accepts as a focus:
 * `claim` and `argument_chain` in the argument view, `source` and
 * `evidence_item` in the evidence view. A type outside this set could be
 * handed to the handler and silently 404.
 */
export type RefocusTarget =
  | 'claim'
  | 'argument_chain'
  | 'source'
  | 'evidence_item'

/** Button copy per refocusable type, so no type falls through to a generic label. */
const REFOCUS_LABELS: Record<RefocusTarget, string> = {
  claim: 'Focus claim',
  argument_chain: 'Focus argument',
  source: 'Focus source',
  evidence_item: 'Focus evidence',
}

/**
 * The view a refocus target must open in.
 *
 * `claim` and `argument_chain` belong to the argument view; `source` and
 * `evidence_item` to the evidence view. Co-located with {@link RefocusTarget}
 * and its labels so the type, its copy and its destination cannot drift apart —
 * and so both the Graph Explorer and the Sources surface refocus through one
 * mapping rather than two copies of the same ternary.
 *
 * @param type A refocusable node type.
 * @returns The registered view name that accepts it.
 */
export function refocusView(type: RefocusTarget): string {
  return type === 'claim' || type === 'argument_chain'
    ? ARGUMENT_VIEW_NAME
    : EVIDENCE_VIEW_NAME
}

/**
 * Render an ontology token as readable words (`HAS_CONCEPT` → `Has concept`).
 *
 * Presentation only: the raw token still travels in the `data-*` attributes
 * and the `Vocabulary` row, so nothing becomes un-addressable — the reader
 * sees prose where the wire sees a token. Derives nothing: a token maps to
 * the same words every time, and an unrecognised one still renders as words
 * rather than being guessed at.
 *
 * @param token A relation word, edge family or source tag from the graph.
 * @returns The token with underscores as spaces and a leading capital.
 */
function humanizeToken(token: string): string {
  const words = token.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Look up a node in the projection by its canonical id.
 *
 * @param projection The loaded projection.
 * @param id A `GraphNode.id`.
 * @returns The node, or `null` when the projection does not contain it.
 */
export function findNodeById(
  projection: GraphProjection,
  id: string,
): GraphNode | null {
  return projection.nodes.find((node) => node.id === id) ?? null
}

/**
 * Look up an edge in the projection by its deterministic buildEdgeId composite.
 *
 * @param projection The loaded projection.
 * @param id A `GraphEdge.id`.
 * @returns The edge, or `null` when the projection does not contain it.
 */
export function findEdgeById(
  projection: GraphProjection,
  id: string,
): GraphEdge | null {
  return projection.edges.find((edge) => edge.id === id) ?? null
}

/**
 * The edges that touch a node, in projection order.
 *
 * Both directions count, but each edge is reported once, `from`/`to` always
 * preserving authored direction.
 *
 * @param projection The loaded projection.
 * @param nodeId A canonical node id.
 * @returns Every edge whose `from` or `to` equals `nodeId`.
 */
export function incidentEdges(
  projection: GraphProjection,
  nodeId: string,
): GraphEdge[] {
  return projection.edges.filter(
    (edge) => edge.from === nodeId || edge.to === nodeId,
  )
}

/**
 * Resolve an endpoint id to its display label.
 *
 * @param projection The loaded projection.
 * @param id A node or edge id.
 * @returns The node's label, or `id` itself when the projection lacks it.
 */
export function resolveNodeLabel(
  projection: GraphProjection,
  id: string,
): string {
  return findNodeById(projection, id)?.label ?? id
}

/**
 * The Entity Inspector panel.
 *
 * @param props.projection The loaded, validated projection — the inspector's
 * only source of truth.
 * @param props.selection The current presentation selection, or `null`.
 * @param props.onNavigateCard Optional handler fired by a card's "Open card"
 * button; it receives the card's canonical slug.
 * @param props.onRefocus Optional handler fired by a refocusable node's focus
 * button; it receives the node id and which refocusable type it is, so the page
 * can move `focus` and switch `view` in one write.
 * @param props.descriptor The selected view's rule, when the page has it.
 * Provenance and evidence blocks use it to tell "this view cannot carry
 * attribution/evidence" apart from "it can and the corpus has none"; without
 * it those empty states are suppressed rather than guessed.
 * @returns A semantic side panel describing the selected node or edge.
 * @example
 * ```tsx
 * <EntityInspector
 *   projection={projection}
 *   selection={{ kind: 'node', id: selectedId }}
 *   onNavigateCard={(slug) => setSearchParams({ focus: slug })}
 *   onRefocus={(id, type) => refocus(id, type)}
 *   descriptor={selectedDescriptor}
 * />
 * ```
 */
export function EntityInspector({
  projection,
  selection,
  onNavigateCard,
  onRefocus,
  descriptor,
}: {
  projection: GraphProjection
  selection: InspectorSelection
  onNavigateCard?: (slug: string) => void
  onRefocus?: (id: string, type: RefocusTarget) => void
  descriptor?: GraphViewDescriptor | null
}) {
  if (selection === null) {
    return (
      <aside className="rounded-xl border p-4 text-sm text-muted-foreground">
        Select a node or an edge in the graph to inspect it. The inspector reads
        only the projection — never the canvas.
      </aside>
    )
  }

  if (selection.kind === 'node') {
    const node = findNodeById(projection, selection.id)
    if (node === null) {
      return (
        <aside className="rounded-xl border p-4 text-sm text-muted-foreground">
          Selected node is no longer in this projection.
        </aside>
      )
    }
    return (
      <NodePanel
        projection={projection}
        node={node}
        onNavigateCard={onNavigateCard}
        onRefocus={onRefocus}
        descriptor={descriptor}
      />
    )
  }

  const edge = findEdgeById(projection, selection.id)
  if (edge === null) {
    return (
      <aside className="rounded-xl border p-4 text-sm text-muted-foreground">
        Selected edge is no longer in this projection.
      </aside>
    )
  }
  return <EdgePanel projection={projection} edge={edge} />
}

/** Semantic markup for one inspected node. */
function NodePanel({
  projection,
  node,
  onNavigateCard,
  onRefocus,
  descriptor,
}: {
  projection: GraphProjection
  node: GraphNode
  onNavigateCard?: (slug: string) => void
  onRefocus?: (id: string, type: RefocusTarget) => void
  descriptor?: GraphViewDescriptor | null
}) {
  const refocusType: RefocusTarget | null =
    node.type === 'claim' ||
    node.type === 'argument_chain' ||
    node.type === 'source' ||
    node.type === 'evidence_item'
      ? node.type
      : null
  return (
    <aside
      className="rounded-xl border p-4"
      data-node-type={node.type}
      data-node-id={node.id}
    >
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-tight">{node.label}</h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {node.type}
        </span>
      </header>
      {node.isFocus ? (
        <p className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          focus node
        </p>
      ) : null}
      {onRefocus !== undefined && refocusType !== null && !node.isFocus ? (
        <button
          type="button"
          data-testid="focus-entity"
          data-entity-type={refocusType}
          data-entity-id={node.id}
          onClick={() => onRefocus(node.id, refocusType)}
          className="mt-3 w-full rounded border border-input px-1.5 py-1 text-xs hover:bg-muted"
        >
          {REFOCUS_LABELS[refocusType]}
        </button>
      ) : null}

      <dl className="mt-3 space-y-1.5 text-sm">
        <DataRow label="Depth">{String(node.depth)}</DataRow>
        <DataRow label="Degree">{String(node.degree)}</DataRow>
        <StatusRow node={node} />
      </dl>

      <TechnicalDetails>
        <dl className="space-y-1.5 text-sm">
          <DataRow label="Canonical id">
            <code className="text-xs">{node.id}</code>
          </DataRow>
          {node.type === 'card' ? (
            <DataRow label="Primary type (legacy)">
              <span>
                {node.metadata.legacyPrimaryType}
                <span className="text-xs text-muted-foreground">
                  {' '}
                  — legacy authoring field, not an axis
                </span>
              </span>
            </DataRow>
          ) : null}
        </dl>
      </TechnicalDetails>

      {node.type === 'card' ? (
        <CardSections
          projection={projection}
          node={node}
          onNavigateCard={onNavigateCard}
        />
      ) : (
        <MetadataSections
          projection={projection}
          node={node}
          descriptor={descriptor}
        />
      )}

      <RelationshipsSection projection={projection} nodeId={node.id} />
    </aside>
  )
}

/** The inspected edge: relation word, family, provenance and endpoints. */
function EdgePanel({
  projection,
  edge,
}: {
  projection: GraphProjection
  edge: GraphEdge
}) {
  const fromLabel = resolveNodeLabel(projection, edge.from)
  const toLabel = resolveNodeLabel(projection, edge.to)
  const vocabulary = 'vocabulary' in edge.type ? edge.type.vocabulary : null
  return (
    <aside
      className="rounded-xl border p-4 text-sm"
      data-edge-id={edge.id}
      data-family={edge.family}
      data-relation={edge.type.value}
      data-source-table={edge.sourceTable}
      data-traversal={edge.traversal}
    >
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold">
          {humanizeToken(edge.type.value)}
        </h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {humanizeToken(edge.family)}
        </span>
      </header>

      <dl className="mt-3 space-y-1.5">
        <DataRow label="From">
          <span className="font-medium">{fromLabel}</span>
        </DataRow>
        <DataRow label="To">
          <span className="font-medium">{toLabel}</span>
        </DataRow>
        <DataRow label="Family">{humanizeToken(edge.family)}</DataRow>
        <DataRow label="Relation">{humanizeToken(edge.type.value)}</DataRow>
        {vocabulary ? <DataRow label="Vocabulary">{vocabulary}</DataRow> : null}
      </dl>

      <TechnicalDetails>
        <dl className="space-y-1.5 text-sm">
          <DataRow label="From id">
            <code className="text-xs">{edge.from}</code>
          </DataRow>
          <DataRow label="To id">
            <code className="text-xs">{edge.to}</code>
          </DataRow>
          <DataRow label="Source table">
            <code className="text-xs">{edge.sourceTable}</code>
          </DataRow>
          <DataRow label="Traversal">
            {edge.traversal === 'bidirectional'
              ? 'bidirectional (may be walked against the authored direction)'
              : 'directed (authored direction only)'}
          </DataRow>
          {Object.entries(edge.attributes).map(([key, value]) => (
            <DataRow key={key} label={key}>
              {String(value)}
            </DataRow>
          ))}
        </dl>
      </TechnicalDetails>

      <Note>
        Authored direction is always shown as given; a bidirectional edge means
        traversal may also approach from the other end.
      </Note>
    </aside>
  )
}

/** A single `dt`/`dd` fact row. */
function DataRow({
  label,
  children,
}: {
  label: string
  children: import('preact').ComponentChildren
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

/**
 * The status row, always labelled with its vocabulary source (Q4).
 *
 * The value is the approved user-facing token: an `epistemic_status` renders
 * through {@link cardStatusLabel} (`OPEN · UNVERIFIED`, `CONTEXT-DEPENDENT`),
 * matching Decks and Explore, so the same status never reads two ways across
 * surfaces. Other variants keep their authored value — an inference step's
 * status is uncontrolled free text and must not be relabelled. The source
 * vocabulary is named in words (`Epistemic status`), never as a raw schema
 * token, while the untranslated value and source stay addressable through the
 * row's `data-*` attributes.
 *
 * @param props.node The inspected node, carrying its tagged status.
 */
function StatusRow({ node }: { node: GraphNode }) {
  const { status } = node
  const value =
    status.value === null
      ? 'none'
      : status.source === 'epistemic_status'
        ? cardStatusLabel(status.value)
        : String(status.value)
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">Status</dt>
      <dd
        className="text-right"
        data-status={status.value ?? 'none'}
        data-status-source={status.source}
      >
        <span>{value}</span>
        {status.source === 'none' ? null : (
          <>
            {' '}
            <code className="text-xs text-muted-foreground">
              · {humanizeToken(status.source)}
              {'vocabulary' in status && status.vocabulary
                ? ` (${status.vocabulary})`
                : ''}
            </code>
          </>
        )}
      </dd>
    </div>
  )
}

/** Card-specific classification sections (Axis, Suit, Locale, Mechanism, Concept). */
function CardSections({
  projection,
  node,
  onNavigateCard,
}: {
  projection: GraphProjection
  node: Extract<GraphNode, { type: 'card' }>
  onNavigateCard?: (slug: string) => void
}) {
  const { metadata, classification } = node
  return (
    <>
      <section className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Card
        </h4>
        <dl className="mt-2 space-y-1.5 text-sm">
          <DataRow label="Slug">
            <span className="flex items-center gap-2">
              <code className="text-xs">{metadata.slug}</code>
              {onNavigateCard ? (
                <button
                  type="button"
                  data-testid="open-card"
                  data-slug={metadata.slug}
                  onClick={() => onNavigateCard(metadata.slug)}
                  className="rounded border border-input px-1.5 py-0.5 text-xs hover:bg-muted"
                >
                  Open card
                </button>
              ) : null}
            </span>
          </DataRow>
          {metadata.summary ? (
            <DataRow label="Summary">{metadata.summary}</DataRow>
          ) : null}
          {metadata.coreQuestion ? (
            <DataRow label="Core question">{metadata.coreQuestion}</DataRow>
          ) : null}
        </dl>
      </section>

      <CardFrontVisuals projection={projection} node={node} />

      <AxesSection axes={classification.axes} />
      <FacetSection
        heading="Suits"
        kind="suit"
        pairs={pairsOf(classification.suits, classification.suitIds)}
      />
      <FacetSection
        heading="Locales"
        kind="locale"
        pairs={pairsOf(classification.localeSlugs, classification.localeIds)}
      />
      <FacetSection
        heading="Mechanisms"
        kind="mechanism"
        pairs={pairsOf(
          classification.mechanismSlugs,
          classification.mechanismIds,
        )}
      />
      <ConceptSection projection={projection} nodeId={node.id} />
    </>
  )
}

/**
 * The card's ordered Axis assignments.
 *
 * `primary` is derived from `ordinal === 0`, never from the legacy type.
 */
function AxesSection({ axes }: { axes: CardClassification['axes'] }) {
  if (axes.length === 0) return null
  return (
    <section className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Axes (ordered)
      </h4>
      <ol className="mt-2 space-y-1 text-sm">
        {axes.map((assignment) => (
          <li
            key={assignment.axis}
            data-testid="axis"
            data-axis={assignment.axis}
            data-primary={assignment.primary}
            data-ordinal={assignment.ordinal}
          >
            <span className="font-medium">{assignment.axis}</span>
            {assignment.primary ? (
              <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                primary
              </span>
            ) : null}
            <span className="ml-1 text-xs text-muted-foreground">
              (ordinal {assignment.ordinal})
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * The card's visual badge layer, folded in from the deleted `CardFront` panel:
 * tinted Suit badges, outline Axis pills in canonical order, and the
 * Mechanisms &amp; concepts pills — the same fixed-vocabulary encoding rules
 * the card front used. It sits above the ordered axis data rows, which keep
 * the `data-testid="axis"` / `data-primary` / `data-ordinal` hooks.
 *
 * @param props.projection The loaded projection (names resolve through it).
 * @param props.node The inspected card.
 */
function CardFrontVisuals({
  projection,
  node,
}: {
  projection: GraphProjection
  node: CardNode
}) {
  const { mechanisms, concepts } = classificationPills(projection, node)
  const hasPills = mechanisms.length > 0 || concepts.length > 0
  return (
    <>
      {node.classification.suits.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {node.classification.suits.map((suit) => {
            const color = SUIT_DOT_COLORS[suit] ?? '#94a3b8'
            return (
              <span
                key={suit}
                data-suit={suit}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-foreground/80"
                style={{ backgroundColor: `${color}1f` }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                {SUIT_LABELS[suit] ?? humanize(suit)}
              </span>
            )
          })}
        </div>
      ) : null}

      {node.classification.axes.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium text-muted-foreground">
            Axis
          </span>
          {axesInOrder(node).map((axis) => (
            <span
              key={axis}
              data-axis={axis}
              className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-foreground/80"
            >
              {AXIS_LABELS[axis]}
            </span>
          ))}
        </div>
      ) : null}

      {hasPills ? (
        <div className="mt-4 border-t pt-3" data-testid="mechanism-concepts">
          <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">
            Mechanisms &amp; concepts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              ...mechanisms.map((label) => ({
                kind: 'mechanism' as const,
                label,
              })),
              ...concepts.map((label) => ({ kind: 'concept' as const, label })),
            ].map(({ kind, label }) => (
              <span
                key={`${kind}:${label}`}
                data-pill={kind}
                className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

/**
 * The mechanism and concept pill labels reachable from a card.
 *
 * A card's authored classification edges are the only place Mechanism and
 * Concept *names* live (the classification bag carries slugs and ids only), so
 * names are resolved through the projection's edges and nodes — the target
 * node label, then the edge's authored `attributes.name`, then nothing.
 *
 * @param projection The loaded projection.
 * @param card The inspected card node.
 * @returns `{ mechanisms, concepts }` label lists, each sorted, de-duplicated.
 */
function classificationPills(
  projection: GraphProjection,
  card: CardNode,
): { mechanisms: readonly string[]; concepts: readonly string[] } {
  const byKind: Record<'mechanism' | 'concept', string[]> = {
    mechanism: [],
    concept: [],
  }
  for (const edge of projection.edges) {
    if (edge.family !== 'classification' || edge.from !== card.id) continue
    let kind: 'mechanism' | 'concept'
    if (edge.type.value === 'HAS_MECHANISM') kind = 'mechanism'
    else if (edge.type.value === 'HAS_CONCEPT') kind = 'concept'
    else continue
    const target = projection.nodes.find((node) => node.id === edge.to)
    const authored =
      typeof edge.attributes.name === 'string'
        ? edge.attributes.name
        : undefined
    const label = target?.label ?? authored
    if (label === undefined || label.trim() === '') continue
    if (!byKind[kind].some((existing) => existing === label))
      byKind[kind].push(label)
  }
  for (const kind of Object.keys(byKind) as ('mechanism' | 'concept')[]) {
    byKind[kind].sort((a, b) => a.localeCompare(b))
  }
  return { mechanisms: byKind.mechanism, concepts: byKind.concept }
}

/**
 * The card's axes in canonical presentation order.
 *
 * @param card The inspected card node.
 * @returns The card's axe values, in `AXIS_ORDER`.
 */
function axesInOrder(card: CardNode): readonly string[] {
  const present = new Set(card.classification.axes.map((axis) => axis.axis))
  return AXIS_ORDER.filter((axis) => present.has(axis))
}

/**
 * Convert a slug to a display label for values the fixture vocabulary does not
 * cover (dash-to-space, capitalised).
 *
 * @param slug A kebab-case slug.
 * @returns A humanised display string.
 */
function humanize(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * One parallel slug/id list (Suit, Locale or Mechanism).
 *
 * Only the slug is shown: the section heading names the dimension, so the same
 * slug under Suits and under Locales stays distinct without a raw id in the
 * default read. The id remains on the row's `data-id` for tooling.
 */
function FacetSection({
  heading,
  kind,
  pairs,
}: {
  heading: string
  kind: 'suit' | 'locale' | 'mechanism'
  pairs: readonly { slug: string; id: string }[]
}) {
  if (pairs.length === 0) return null
  return (
    <section className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h4>
      <ul className="mt-2 space-y-1 text-sm">
        {pairs.map((pair) => (
          <li
            key={pair.id}
            data-testid={kind}
            data-kind={kind}
            data-slug={pair.slug}
            data-id={pair.id}
          >
            <span className="font-medium">{pair.slug}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A card's Concepts, read from its incident `HAS_CONCEPT` classification edges.
 *
 * Concepts have no bag in `CardClassification` — they exist only as edges — so
 * this is where the inspector reads them, and it resolves the other endpoint
 * through the projection rather than trusting a stored label.
 */
function ConceptSection({
  projection,
  nodeId,
}: {
  projection: GraphProjection
  nodeId: string
}) {
  const conceptEdges = incidentEdges(projection, nodeId).filter(
    (edge) =>
      edge.family === 'classification' && edge.type.value === 'HAS_CONCEPT',
  )
  if (conceptEdges.length === 0) return null
  return (
    <section className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Concepts
      </h4>
      <ul className="mt-2 space-y-1 text-sm">
        {conceptEdges.map((edge) => {
          const conceptId =
            edge.from === nodeId ? (edge.to ?? '') : (edge.from ?? '')
          return (
            <li
              key={edge.id}
              data-testid="concept"
              data-kind="concept"
              data-id={conceptId}
            >
              <span className="font-medium">
                {resolveNodeLabel(projection, conceptId)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Type-specific metadata for every non-card node type. */
/**
 * Whether a node at this depth was actually expanded by the BFS.
 *
 * A node discovered on the last executed hop sits at the frontier: its own
 * rows were never requested, so an empty result about it is a limit of the
 * request, not a fact about the corpus. Truncation cuts expansion arbitrarily,
 * which makes the same caveat apply to every node.
 *
 * @param projection The loaded projection, carrying `depth` and `meta.truncated`.
 * @param node The inspected node.
 * @returns `true` only when this node's own rows were fully requested.
 */
function nodeWasExpanded(
  projection: GraphProjection,
  node: GraphNode,
): boolean {
  return !projection.meta.truncated && node.depth < projection.depth
}

/**
 * A claim's source attribution: the `claim_sources` rows projected as
 * `claim -> source` edges, with the authored quote and page carried by the edge.
 *
 * Rendered only when the view declares the source family or the projection
 * actually contains attribution edges — a view that never asks for provenance
 * gets no empty-state claim, because "this view does not carry attribution" and
 * "this claim is unsourced" must not read the same. When the view does declare
 * the family and no edge exists, the note distinguishes a corpus fact (the
 * claim was expanded and has no attribution) from a depth limit (it sits at
 * the frontier).
 *
 * @param props.projection The loaded projection.
 * @param props.descriptor The selected view's rule, when known.
 * @param props.node The inspected claim.
 * @returns The Provenance section, or `null` when this view cannot carry one.
 */
function ProvenanceSection({
  projection,
  descriptor,
  node,
}: {
  projection: GraphProjection
  descriptor?: GraphViewDescriptor | null
  node: GraphNode
}) {
  const edges = projection.edges.filter(
    (edge) =>
      edge.family === 'source' &&
      (edge.from === node.id || edge.to === node.id),
  )
  const declares = descriptor?.edgeFamilies.includes('source') ?? false
  if (edges.length === 0 && !declares) return null

  if (edges.length === 0) {
    return (
      <Section title="Provenance">
        <Note>
          {nodeWasExpanded(projection, node)
            ? 'No source attribution recorded for this claim in the corpus.'
            : 'Not expanded at this depth: the claim sits at the frontier, so attribution may exist beyond the loaded depth.'}
        </Note>
      </Section>
    )
  }

  return (
    <Section title={`Provenance (${edges.length})`}>
      <ul className="space-y-2">
        {edges.map((edge) => {
          const sourceId = edge.from === node.id ? edge.to : edge.from
          const quote = edge.attributes.quoteOrExcerpt
          const page = edge.attributes.pageReference
          return (
            <li
              key={edge.id}
              className="rounded border border-input p-2 text-xs"
              data-provenance-edge={edge.id}
              data-source-table={edge.sourceTable}
            >
              <div className="font-medium">
                {resolveNodeLabel(projection, sourceId)}
              </div>
              <div className="text-muted-foreground">
                {humanizeToken(edge.type.value)}
              </div>
              {typeof quote === 'string' && quote.length > 0 ? (
                <div className="mt-0.5 italic">“{quote}”</div>
              ) : null}
              {typeof page === 'string' && page.length > 0 ? (
                <div className="mt-0.5 text-muted-foreground">{page}</div>
              ) : null}
              <TechnicalDetails>
                <div>
                  Source table: <code>{edge.sourceTable}</code>
                </div>
              </TechnicalDetails>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/**
 * The evidence directed at a claim: the `evidence_claims` rows projected as
 * `evidence_item -> claim` edges, with relation and strength from the edge.
 *
 * The three empty states are deliberately different sentences, because they
 * are different facts: the corpus has zero evidence rows at all (missing
 * evidence — reported from the view's own `blockingGaps`), the claim was
 * expanded against a non-empty corpus and has none (unsupported claim), or
 * the claim sits at the depth limit (not yet asked). A view that does not
 * traverse the evidence family renders nothing.
 *
 * @param props.projection The loaded projection.
 * @param props.descriptor The selected view's rule, when known.
 * @param props.node The inspected claim.
 * @returns The Evidence section, or `null` when this view cannot carry one.
 */
function EvidenceSection({
  projection,
  descriptor,
  node,
}: {
  projection: GraphProjection
  descriptor?: GraphViewDescriptor | null
  node: GraphNode
}) {
  const edges = projection.edges.filter(
    (edge) =>
      edge.family === 'evidence' &&
      edge.sourceTable === 'evidence_claims' &&
      (edge.from === node.id || edge.to === node.id),
  )
  const declares = descriptor?.edgeFamilies.includes('evidence') ?? false
  if (edges.length === 0 && !declares) return null

  if (edges.length === 0) {
    const corpusEmpty =
      descriptor?.blockingGaps.some((gap) => gap.includes('evidence_items')) ??
      false
    const note = corpusEmpty
      ? 'No evidence is recorded in the corpus at all, so none is recorded against this claim — or any claim. A corpus fact, not a load failure.'
      : !nodeWasExpanded(projection, node)
        ? 'Not expanded at this depth: the claim sits at the frontier, so evidence may exist beyond the loaded depth.'
        : 'No evidence is recorded against this claim. A corpus fact, not a load failure.'
    return (
      <Section title="Evidence">
        <Note>{note}</Note>
      </Section>
    )
  }

  return (
    <Section title={`Evidence (${edges.length})`}>
      <ul className="space-y-2">
        {edges.map((edge) => {
          const evidenceId = edge.from === node.id ? edge.to : edge.from
          const evidenceNode = findNodeById(projection, evidenceId)
          const strength = edge.attributes.strength
          const quote =
            evidenceNode?.type === 'evidence_item'
              ? evidenceNode.metadata.quoteOrExcerpt
              : null
          return (
            <li
              key={edge.id}
              className="rounded border border-input p-2 text-xs"
              data-evidence-edge={edge.id}
              data-source-table={edge.sourceTable}
            >
              <div className="font-medium">
                {resolveNodeLabel(projection, evidenceId)}
              </div>
              <div className="text-muted-foreground">
                {humanizeToken(edge.type.value)}
                {typeof strength === 'string' && strength.length > 0
                  ? ` · strength ${strength}`
                  : ''}
              </div>
              {typeof quote === 'string' && quote.length > 0 ? (
                <div className="mt-0.5 italic">“{quote}”</div>
              ) : null}
              <TechnicalDetails>
                <div>
                  Source table: <code>{edge.sourceTable}</code>
                </div>
              </TechnicalDetails>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function MetadataSections({
  projection,
  node,
  descriptor,
}: {
  projection: GraphProjection
  node: Exclude<GraphNode, { type: 'card' }>
  descriptor?: GraphViewDescriptor | null
}) {
  switch (node.type) {
    case 'claim':
      return (
        <>
          <Section title="Claim">
            <DataRow label="Claim type">{node.metadata.claimType}</DataRow>
            {node.metadata.description ? (
              <DataRow label="Description">{node.metadata.description}</DataRow>
            ) : null}
            <DataRow label="Card id">
              <code className="text-xs">{node.metadata.cardId}</code>
            </DataRow>
          </Section>
          <ProvenanceSection
            projection={projection}
            descriptor={descriptor}
            node={node}
          />
          <EvidenceSection
            projection={projection}
            descriptor={descriptor}
            node={node}
          />
        </>
      )
    case 'inference_step':
      return (
        <Section title="Inference step">
          <DataRow label="Description">{node.metadata.description}</DataRow>
          <DataRow label="Inference type">
            {node.metadata.inferenceType}
          </DataRow>
          <DataRow label="Canonical">
            {node.metadata.isCanonical ? 'yes' : 'no'}
          </DataRow>
          {node.metadata.notes ? (
            <DataRow label="Notes">{node.metadata.notes}</DataRow>
          ) : null}
          <DataRow label="Card id">
            <code className="text-xs">{node.metadata.cardId}</code>
          </DataRow>
          {node.metadata.chains.length > 0 ? (
            <div className="mt-2">
              <h5 className="text-xs font-semibold text-muted-foreground">
                Chains
              </h5>
              <ul className="mt-1 list-inside list-disc text-xs">
                {node.metadata.chains.map((chain) => (
                  <li key={chain.id}>
                    {chain.label} · {chain.kind}
                    {chain.role ? ` · role ${chain.role}` : ''}
                    {chain.ordinal !== null ? ` · ${chain.ordinal}` : ''} ·{' '}
                    <code className="text-xs text-muted-foreground">
                      via {chain.membershipSource}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {node.metadata.premises.length > 0 ? (
            <div className="mt-2">
              <h5 className="text-xs font-semibold text-muted-foreground">
                Premises
              </h5>
              <ul className="mt-1 list-inside list-disc text-xs">
                {node.metadata.premises.map((premise) => (
                  <li key={`${premise.claimId}-${premise.ordinal}`}>
                    {resolveNodeLabel(projection, premise.claimId)} ·{' '}
                    {premise.role} · {premise.ordinal}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {node.metadata.conclusions.length > 0 ? (
            <div className="mt-2">
              <h5 className="text-xs font-semibold text-muted-foreground">
                Conclusions
              </h5>
              <ul className="mt-1 list-inside list-disc text-xs">
                {node.metadata.conclusions.map((conclusion) => (
                  <li key={`${conclusion.claimId}-${conclusion.ordinal}`}>
                    {resolveNodeLabel(projection, conclusion.claimId)} ·{' '}
                    {conclusion.ordinal}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      )
    case 'argument_chain':
      return (
        <Section title="Argument chain">
          <DataRow label="Label">{node.metadata.label}</DataRow>
          <DataRow label="Description">{node.metadata.description}</DataRow>
          <DataRow label="Kind">{node.metadata.kind}</DataRow>
          <DataRow label="Card id">
            <code className="text-xs">{node.metadata.cardId}</code>
          </DataRow>
          <DataRow label="Steps">
            <code className="text-xs">
              {node.metadata.stepIds.length} step
              {node.metadata.stepIds.length === 1 ? '' : 's'}
            </code>
          </DataRow>
        </Section>
      )
    case 'collection':
    case 'mechanism':
    case 'concept':
      return (
        <Section title={node.type}>
          <DataRow label="Slug">
            <code className="text-xs">{node.metadata.slug}</code>
          </DataRow>
          {node.metadata.description ? (
            <DataRow label="Description">{node.metadata.description}</DataRow>
          ) : null}
          {node.metadata.definition ? (
            <DataRow label="Definition">{node.metadata.definition}</DataRow>
          ) : null}
        </Section>
      )
    case 'source':
      return (
        <Section title="Source">
          <DataRow label="Title">{node.metadata.title}</DataRow>
          {node.metadata.author ? (
            <DataRow label="Author">{node.metadata.author}</DataRow>
          ) : null}
          {node.metadata.publisher ? (
            <DataRow label="Publisher">{node.metadata.publisher}</DataRow>
          ) : null}
          {node.metadata.citation ? (
            <DataRow label="Citation">{node.metadata.citation}</DataRow>
          ) : null}
          {node.metadata.url ? (
            <DataRow label="URL">
              <code className="text-xs">{node.metadata.url}</code>
            </DataRow>
          ) : null}
          <DataRow label="Source type">{node.metadata.sourceType}</DataRow>
        </Section>
      )
    case 'evidence_item':
      return (
        <Section title="Evidence item">
          <DataRow label="Evidence type">{node.metadata.evidenceType}</DataRow>
          {node.metadata.locator ? (
            <DataRow label="Locator">{node.metadata.locator}</DataRow>
          ) : null}
          {node.metadata.quoteOrExcerpt ? (
            <DataRow label="Quote">{node.metadata.quoteOrExcerpt}</DataRow>
          ) : null}
          {node.metadata.strength ? (
            <DataRow label="Strength">{node.metadata.strength}</DataRow>
          ) : null}
        </Section>
      )
    case 'case':
      return (
        <Section title="Case">
          <DataRow label="Title">{node.metadata.title}</DataRow>
          {node.metadata.description ? (
            <DataRow label="Description">{node.metadata.description}</DataRow>
          ) : null}
          {node.metadata.dateStart ? (
            <DataRow label="Start">{node.metadata.dateStart}</DataRow>
          ) : null}
          {node.metadata.dateEnd ? (
            <DataRow label="End">{node.metadata.dateEnd}</DataRow>
          ) : null}
          {node.metadata.location ? (
            <DataRow label="Location">{node.metadata.location}</DataRow>
          ) : null}
        </Section>
      )
    case 'interpretation':
      return (
        <Section title="Interpretation">
          <DataRow label="Title">{node.metadata.title}</DataRow>
          <DataRow label="Description">{node.metadata.description}</DataRow>
          <DataRow label="Card id">
            <code className="text-xs">{node.metadata.cardId}</code>
          </DataRow>
        </Section>
      )
    case 'question':
      return (
        <Section title="Question">
          <DataRow label="Question">{node.metadata.question}</DataRow>
          {node.metadata.description ? (
            <DataRow label="Description">{node.metadata.description}</DataRow>
          ) : null}
        </Section>
      )
  }
}

/** All edges touching a node, so the inspector keeps the projection in view. */
function RelationshipsSection({
  projection,
  nodeId,
}: {
  projection: GraphProjection
  nodeId: string
}) {
  const edges = incidentEdges(projection, nodeId)
  if (edges.length === 0) return null
  return (
    <Section title={`Relationships (${edges.length})`}>
      <ul className="space-y-2">
        {edges.map((edge) => {
          const otherId = edge.from === nodeId ? edge.to : edge.from
          const otherLabel = resolveNodeLabel(projection, otherId)
          const direction =
            edge.from === nodeId ? '← arrives from' : '→ points to'
          return (
            <li
              key={edge.id}
              className="rounded border border-input p-2 text-xs"
              data-relationship-edge={edge.id}
              data-relationship-family={edge.family}
              data-relationship-relation={edge.type.value}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  {humanizeToken(edge.type.value)}
                </span>
                <span className="text-muted-foreground">
                  {humanizeToken(edge.family)}
                </span>
              </div>
              <div className="mt-0.5 text-muted-foreground">
                {direction} {otherLabel}
              </div>
              <TechnicalDetails>
                <div>
                  Source table: <code>{edge.sourceTable}</code>
                </div>
                <div>Traversal: {edge.traversal}</div>
                {Object.keys(edge.attributes).length > 0 ? (
                  <div>
                    {Object.entries(edge.attributes).map(
                      ([key, value]) => `${key}=${String(value)}`,
                    )}
                  </div>
                ) : null}
              </TechnicalDetails>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/**
 * A collapsed disclosure for schema-level detail.
 *
 * Canonical ids, legacy authoring fields, backing-table names and raw edge
 * attributes are kept for tooling and migration but do not belong in the
 * default research read. They render inside a native `<details>` so the reader
 * opts in; the markup is still server-rendered, so the copy and `data-*` hooks
 * stay present for tests and for consumers that need the untranslated value.
 *
 * @param props.children The technical facts to reveal on demand.
 */
function TechnicalDetails({
  children,
}: {
  children: import('preact').ComponentChildren
}) {
  return (
    <details
      data-testid="technical-details"
      className="mt-3 text-xs text-muted-foreground"
    >
      <summary className="cursor-pointer select-none">
        Technical details
      </summary>
      <div className="mt-1.5">{children}</div>
    </details>
  )
}

/** A titled block of fact rows. */
function Section({
  title,
  children,
}: {
  title: string
  children: import('preact').ComponentChildren
}) {
  return (
    <section className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <dl className="mt-2 space-y-1.5 text-sm">{children}</dl>
    </section>
  )
}

/** Small explanatory footnote, styled to stay visually quiet. */
function Note({ children }: { children: import('preact').ComponentChildren }) {
  return (
    <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
      {children}
    </p>
  )
}

/** Zip two parallel slug/id arrays into facet pairs. */
function pairsOf(
  slugs: readonly string[],
  ids: readonly string[],
): readonly { slug: string; id: string }[] {
  return slugs.map((slug, index) => ({
    slug,
    id: ids[index] ?? '',
  }))
}
