/**
 * The Deck's scope/filter badges — SPEC §6.1, item 1 of the discovery
 * composition.
 *
 * Four controls, exactly the four the spec names: card count, axis filter,
 * research-status filter, repeat policy. They are *badges* — compact, muted,
 * and interactive only where a corresponding filter exists — so the count is
 * a plain badge and the three filters are toggle badges with `aria-pressed`.
 *
 * What this strip must never do: invent a filter. The axis and status lists
 * are the ones actually present in the loaded cards ({@link availableAxes} /
 * {@link availableStatuses} in `deck-model.ts`), so an axis no card carries is
 * not offered as a control that can only ever return nothing. Selecting is
 * single-select per dimension and re-clicking the active value clears it, the
 * same behaviour as the graph facet popover.
 */

import { cn } from '@/lib/utils'
import type {
  CardAxisValue,
  EpistemicStatusValue,
} from '../../trope-cards/src/graph/types.ts'
import { AXIS_LABELS } from '../graph/deck-facets'
import type { DeckScope } from './deck-model'
import { researchStatusLabel } from './deck-status'

/** Props for {@link DeckScopeBadges}. */
export type DeckScopeBadgesProps = {
  /** Server total for the unfiltered listing. */
  readonly total: number
  /** How many cards the server actually returned in this page. */
  readonly served: number
  /** How many cards the active scope keeps. */
  readonly shown: number
  readonly scope: DeckScope
  /** Axes present in the loaded cards, in canonical order. */
  readonly axes: readonly CardAxisValue[]
  /** Research statuses present in the loaded cards, in vocabulary order. */
  readonly statuses: readonly EpistemicStatusValue[]
  /** Reports the next scope; the page owns the state. */
  readonly onChange: (scope: DeckScope) => void
}

/** The muted, compact badge shell shared by every chip in the strip. */
const BADGE =
  'inline-flex min-h-[34px] items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors'

/**
 * The count badge's text: how many cards are in play, and — only when the
 * server held more than one page — that the page is a prefix of the listing.
 *
 * @param total Server total for the unfiltered listing.
 * @param served How many cards arrived in this page.
 * @param shown How many the active scope keeps.
 * @returns The badge text, e.g. `47 cards` or `6 of 47 cards`.
 */
function countLabel(total: number, served: number, shown: number): string {
  const scopeSuffix = shown === total ? '' : ` of ${total}`
  const base = `${shown}${scopeSuffix} card${shown === 1 ? '' : 's'}`
  return served === total ? base : `${base} (first ${served} loaded)`
}

/**
 * One group of filter badges.
 *
 * A `<fieldset>`/`<legend>` rather than an ARIA `role="group"`: the legend is
 * the group's real accessible name, it works without scripting, and a set of
 * filters *is* a form control group semantically — the axis chips are not
 * just visually near the word "Axis".
 */
function FilterGroup({
  label,
  children,
}: {
  label: string
  children: import('preact').ComponentChildren
}) {
  return (
    <fieldset className="m-0 border-0 p-0" data-filter-group={label}>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </legend>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </fieldset>
  )
}

/** One toggle badge. Active state is carried by `aria-pressed` and text weight. */
function ToggleBadge({
  active,
  onSelect,
  children,
}: {
  active: boolean
  onSelect: () => void
  children: import('preact').ComponentChildren
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        BADGE,
        active
          ? 'border-foreground/30 bg-foreground text-background'
          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/**
 * The scope badge strip above the featured card.
 *
 * @param props See {@link DeckScopeBadgesProps}.
 * @returns A `<section>` of count + filter badges.
 */
export function DeckScopeBadges({
  total,
  served,
  shown,
  scope,
  axes,
  statuses,
  onChange,
}: DeckScopeBadgesProps) {
  return (
    <section
      data-testid="deck-scope"
      aria-label="Deck scope"
      className="flex flex-col gap-3 rounded-xl border border-graph-border bg-graph-surface p-3"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          data-testid="deck-scope-count"
          className={cn(BADGE, 'border-border bg-muted/60 text-foreground')}
        >
          {countLabel(total, served, shown)}
        </span>
        <button
          type="button"
          aria-pressed={scope.withoutRepeats}
          onClick={() =>
            onChange({ ...scope, withoutRepeats: !scope.withoutRepeats })
          }
          data-testid="deck-scope-repeat"
          className={cn(
            BADGE,
            scope.withoutRepeats
              ? 'border-foreground/30 bg-foreground text-background'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          Without repeats
        </button>
      </div>

      <FilterGroup label="Axis">
        <ToggleBadge
          active={scope.axis === null}
          onSelect={() => onChange({ ...scope, axis: null })}
        >
          All axes
        </ToggleBadge>
        {axes.map((axis) => (
          <ToggleBadge
            key={axis}
            active={scope.axis === axis}
            onSelect={() =>
              onChange({ ...scope, axis: scope.axis === axis ? null : axis })
            }
          >
            {AXIS_LABELS[axis]}
          </ToggleBadge>
        ))}
      </FilterGroup>

      <FilterGroup label="Research status">
        <ToggleBadge
          active={scope.status === null}
          onSelect={() => onChange({ ...scope, status: null })}
        >
          All statuses
        </ToggleBadge>
        {statuses.map((status) => (
          <ToggleBadge
            key={status}
            active={scope.status === status}
            onSelect={() =>
              onChange({
                ...scope,
                status: scope.status === status ? null : status,
              })
            }
          >
            {researchStatusLabel(status)}
          </ToggleBadge>
        ))}
      </FilterGroup>
    </section>
  )
}
