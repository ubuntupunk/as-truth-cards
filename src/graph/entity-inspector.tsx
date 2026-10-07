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
 * - **Status is per node type and never rolled up.** Every status row prints
 *   the value *and* its `source` vocabulary tag (`CONTESTED · epistemic_status`,
 *   `draft · independent_inference_status`, `none`), so a reader cannot absorb a
 *   value while missing which vocabulary it belongs to — the exact collapse Q4
 *   forbids.
 * - **Suit and Locale are separate dimensions.** A node classified under the
 *   `south-africa` Suit and set in the `south-africa` Locale renders two
 *   distinct facet lists, each showing its own `id` next to the shared slug —
 *   the ids are how a consumer tells them apart, per the projection contract.
 * - **Concept and Mechanism come from different sources** and stay separate:
 *   Mechanisms from the card's `classification.mechanismIds`, Concepts from the
 *   incident `HAS_CONCEPT` classification edges.
 * - **A claim relation is not an inference.** The edge panel shows `family` and
 *   `sourceTable` beside every relation word, so `claim_relation: SUPPORTS` and
 *   `card_relationship: SUPPORTS` cannot be visually merged.
 * - **`legacyPrimaryType` is labelled legacy.** It is shown because dropping
 *   authored data is silent loss, and tagged `(legacy, not an axis)` because
 *   nothing may read it as one.
 *
 * The component is pure — props in, string out — which is what lets
 * `preact-render-to-string` test it under Node. Interaction is limited to two
 * navigations: the "Open card" button that moves the projection to another
 * card's slug, and the refocus button: a claim or argument chain re-focuses in
 * the argument view (the registered view whose `focusTypes` accepts both), a
 * source or evidence item in the evidence view (the only one that accepts
 * those).
 */

import type {
  CardClassification,
  GraphEdge,
  GraphNode,
  GraphProjection,
} from '../../trope-cards/src/graph/types.ts'
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
        <DataRow label="Canonical id">
          <code className="text-xs">{node.id}</code>
        </DataRow>
        <DataRow label="Depth">{String(node.depth)}</DataRow>
        <DataRow label="Degree">{String(node.degree)}</DataRow>
        <StatusRow node={node} />
      </dl>

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
        <h3 className="text-base font-semibold">{edge.type.value}</h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {edge.family}
        </span>
      </header>

      <dl className="mt-3 space-y-1.5">
        <DataRow label="From">
          <span className="font-medium">{fromLabel}</span>{' '}
          <code className="text-xs text-muted-foreground">{edge.from}</code>
        </DataRow>
        <DataRow label="To">
          <span className="font-medium">{toLabel}</span>{' '}
          <code className="text-xs text-muted-foreground">{edge.to}</code>
        </DataRow>
        <DataRow label="Family">{edge.family}</DataRow>
        <DataRow label="Relation">{edge.type.value}</DataRow>
        {vocabulary ? <DataRow label="Vocabulary">{vocabulary}</DataRow> : null}
        <DataRow label="Source table">
          <code className="text-xs">{edge.sourceTable}</code>
        </DataRow>
        <DataRow label="Traversal">
          {edge.traversal === 'bidirectional'
            ? 'bidirectional (may be walked against the authored direction)'
            : 'directed (authored direction only)'}
        </DataRow>
      </dl>

      {Object.keys(edge.attributes).length > 0 ? (
        <section className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attributes
          </h4>
          <dl className="mt-2 space-y-1">
            {Object.entries(edge.attributes).map(([key, value]) => (
              <DataRow key={key} label={key}>
                {String(value)}
              </DataRow>
            ))}
          </dl>
        </section>
      ) : null}

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
 * Every `NodeStatus` variant is rendered verbatim: `value`, a tag naming
 * `status.source`, and the vocabulary when the variant declares one. There is
 * no status text that appears without its provenance.
 */
function StatusRow({ node }: { node: GraphNode }) {
  const { status } = node
  const value = status.value === null ? 'none' : String(status.value)
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">Status</dt>
      <dd className="text-right">
        <span>{value}</span>{' '}
        <code className="text-xs text-muted-foreground">
          · {status.source}
          {'vocabulary' in status && status.vocabulary
            ? ` (${status.vocabulary})`
            : ''}
        </code>
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
          <DataRow label="Primary type (legacy)">
            <span>
              {metadata.legacyPrimaryType}
              <span className="text-xs text-muted-foreground">
                {' '}
                — legacy authoring field, not an axis
              </span>
            </span>
          </DataRow>
        </dl>
      </section>

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
 * One parallel slug/id list (Suit, Locale or Mechanism).
 *
 * Slug and id are displayed *together* per item because the same slug can name
 * a Suit and a Locale; the id is what disambiguates them (Q3/Q7).
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
            <span className="font-medium">{pair.slug}</span>{' '}
            <code className="text-xs text-muted-foreground">({pair.id})</code>
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
              </span>{' '}
              <code className="text-xs text-muted-foreground">
                ({conceptId})
              </code>
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
                {edge.type.value} · {edge.sourceTable}
              </div>
              {typeof quote === 'string' && quote.length > 0 ? (
                <div className="mt-0.5 italic">“{quote}”</div>
              ) : null}
              {typeof page === 'string' && page.length > 0 ? (
                <div className="mt-0.5 text-muted-foreground">{page}</div>
              ) : null}
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
      ? 'No evidence in the corpus: trope_graph.evidence_items has 0 rows. Nothing is recorded against this claim — or any claim.'
      : !nodeWasExpanded(projection, node)
        ? 'Not expanded at this depth: the claim sits at the frontier, so evidence may exist beyond the loaded depth.'
        : 'No evidence directed at this claim in the corpus. Nothing in evidence_* supports it — a corpus fact, not a load failure.'
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
                {edge.type.value} · {edge.sourceTable}
                {typeof strength === 'string' && strength.length > 0
                  ? ` · strength ${strength}`
                  : ''}
              </div>
              {typeof quote === 'string' && quote.length > 0 ? (
                <div className="mt-0.5 italic">“{quote}”</div>
              ) : null}
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
                <span className="font-medium">{edge.type.value}</span>
                <span className="text-muted-foreground">{edge.family}</span>
              </div>
              <div className="mt-0.5 text-muted-foreground">
                {direction} {otherLabel}
              </div>
              <div className="mt-0.5 text-muted-foreground">
                {edge.sourceTable} · {edge.traversal}
              </div>
              {Object.keys(edge.attributes).length > 0 ? (
                <div className="mt-0.5 text-muted-foreground">
                  {Object.entries(edge.attributes).map(
                    ([key, value]) => `${key}=${String(value)}`,
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Section>
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
