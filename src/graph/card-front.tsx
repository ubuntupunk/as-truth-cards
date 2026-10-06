/**
 * The card-front panel — the `trope_deck_axis_suit_ui.html` detail surface for
 * the graph's focused card.
 *
 * It renders **only** the focus card's own record (never a selection), straight
 * from the *original* projection so the navigator's facets never disturb it:
 *
 * - a tinted icon block and the card title;
 * - a **Suit** badge row, coloured with the same palette as the navigator
 *   (`SUIT_DOT_COLORS`), from `classification.suits`;
 * - an **Axis** pill row in canonical `AXIS_ORDER`, from
 *   `classification.axes`. These are fixed-vocabulary and rendered as outline
 *   pills, keeping them visually distinct from the filled mechanism/concept
 *   pills below (the axis-memo §4 encoding rule);
 * - the card description (`metadata.summary`, falling back to `coreQuestion`);
 * - a **Mechanisms & concepts** pill row, sourced from the card's
 *   `classification` edges (`HAS_MECHANISM` / `HAS_CONCEPT`) — names resolve
 *   from the edge's target node label, falling back to the authored
 *   `attributes.name`, and never invented when neither exists.
 *
 * `focusCard` is nullable on purpose: `pages/Graph.tsx` hides the panel (renders
 * `null`) unless the focus actually is a card.
 */

import type {
  CardNode,
  GraphProjection,
} from '../../trope-cards/src/graph/types.ts'
import {
  AXIS_LABELS,
  AXIS_ORDER,
  SUIT_DOT_COLORS,
  SUIT_LABELS,
} from './deck-facets'

type PillKind = 'mechanism' | 'concept'

/**
 * The card-front panel.
 *
 * @param props.projection The focused card's projection (unfiltered).
 * @param props.focusCard The focused card node, or `null` to render nothing.
 * @returns A card-front `<aside>`, or `null` when `focusCard` is `null`.
 */
export function CardFront({
  projection,
  focusCard,
}: {
  projection: GraphProjection
  focusCard: CardNode | null
}) {
  if (focusCard === null) return null
  const { mechanisms, concepts } = classificationPills(projection, focusCard)
  const hasPills = mechanisms.length > 0 || concepts.length > 0
  return (
    <aside
      className="rounded-xl border bg-background p-4"
      data-testid="card-front"
    >
      <header className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"
          data-testid="card-front-icon"
          aria-hidden="true"
        >
          <BuildingIcon className="h-5 w-5" />
        </div>
        <h2 className="min-w-0 text-base font-semibold leading-6 text-foreground">
          {focusCard.label}
        </h2>
      </header>

      {focusCard.classification.suits.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {focusCard.classification.suits.map((suit) => {
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

      {focusCard.classification.axes.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium text-muted-foreground">
            Axis
          </span>
          {axesInOrder(focusCard).map((axis) => (
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

      {descriptionOf(focusCard) !== null ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {descriptionOf(focusCard)}
        </p>
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
    </aside>
  )
}

/**
 * The mechanism and concept pill labels reachable from a focused card.
 *
 * A card's authored classification edges are the only place Mechanism and
 * Concept *names* live (the classification bag carries slugs and ids only), so
 * names are resolved through the projection's edges and nodes — the target
 * node label, then the edge's authored `attributes.name`, then nothing.
 *
 * @param projection The focused card's unfiltered projection.
 * @param focusCard The focused card node.
 * @returns `{ mechanisms, concepts }` label lists, each sorted, de-duplicated.
 */
function classificationPills(
  projection: GraphProjection,
  focusCard: CardNode,
): { mechanisms: readonly string[]; concepts: readonly string[] } {
  const byKind: Record<PillKind, string[]> = { mechanism: [], concept: [] }
  for (const edge of projection.edges) {
    if (edge.family !== 'classification' || edge.from !== focusCard.id) continue
    let kind: PillKind
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
  for (const kind of Object.keys(byKind) as PillKind[]) {
    byKind[kind].sort((a, b) => a.localeCompare(b))
  }
  return { mechanisms: byKind.mechanism, concepts: byKind.concept }
}

/**
 * The card's axes in canonical presentation order.
 *
 * @param focusCard The focused card node.
 * @returns The card's axe values, in `AXIS_ORDER`.
 */
function axesInOrder(focusCard: CardNode): readonly string[] {
  const present = new Set(
    focusCard.classification.axes.map((axis) => axis.axis),
  )
  return AXIS_ORDER.filter((axis) => present.has(axis))
}

/**
 * The card's lead description text.
 *
 * @param focusCard The focused card node.
 * @returns `metadata.summary` if set, else `coreQuestion`, else `null`.
 */
function descriptionOf(focusCard: CardNode): string | null {
  return focusCard.metadata.summary ?? focusCard.metadata.coreQuestion
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

/** Building glyph for the tinted icon block (never a linked icon library). */
function BuildingIcon({ className }: { className?: string }) {
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
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 9h2a2 2 0 0 1 2 2v10" />
      <path d="M3 21h18" />
      <path d="M8 7h.01M12 7h.01M8 11h.01M12 11h.01M8 15h.01M12 15h.01" />
    </svg>
  )
}
