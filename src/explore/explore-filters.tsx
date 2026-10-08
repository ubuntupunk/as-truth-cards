/**
 * The Explore facet strip and order control — Phase B's `filter` and `sort`
 * over the canonical corpus (ROADMAP §71–96, SPEC §5.3's facet language).
 *
 * The chips are the Deck's own {@link FilterGroup}/{@link ToggleBadge}, so
 * both discovery surfaces offer identical affordances: single-select per
 * dimension, `aria-pressed` on every value, and re-clicking the active value
 * to clear it. What each surface offers differs only because the data does —
 * here a third dimension (Suit) joins axis and research status, and labels
 * come from the same vocabularies the graph publishes (`AXIS_LABELS`,
 * `suitLabel`, `researchStatusLabel`), never from strings invented for this
 * page. That is the whole "no duplicate ontology" rule, applied to controls.
 *
 * The order control hides while a search term is in force: relevance ranking
 * belongs to the server and a sort button that would be ignored is a lie
 * about what the list is ordered by.
 */

import { FilterGroup, ToggleBadge } from '@/components/filter-chips'
import { researchStatusLabel } from '@/deck/deck-status'
import type {
  CardAxisValue,
  EpistemicStatusValue,
} from '../../trope-cards/src/graph/types.ts'
import { AXIS_LABELS, suitLabel } from '../graph/deck-facets'
import { type ExploreQuery, hasActiveFilters } from './explore-model'

/** Props for {@link ExploreFilters}. */
export type ExploreFiltersProps = {
  readonly query: ExploreQuery
  /** Axes present in the loaded cards, canonical order. */
  readonly axes: readonly CardAxisValue[]
  /** Research statuses present, vocabulary order. */
  readonly statuses: readonly EpistemicStatusValue[]
  /** Suits present, vocabulary order (see `availableSuits`). */
  readonly suits: readonly string[]
  /** While a term owns ranking, the order control hides rather than no-ops. */
  readonly searching: boolean
  /** Reports the next query; the page owns the state. */
  readonly onChange: (query: ExploreQuery) => void
}

/**
 * Facet groups (axis, research status, suit), order, and a clear exit.
 *
 * @param props See {@link ExploreFiltersProps}.
 * @returns A `<section>` of filter groups.
 */
export function ExploreFilters({
  query,
  axes,
  statuses,
  suits,
  searching,
  onChange,
}: ExploreFiltersProps) {
  return (
    <section
      data-testid="explore-filters"
      aria-label="Filters"
      className="flex flex-col gap-3 rounded-xl border border-graph-border bg-graph-surface p-3"
    >
      <FilterGroup label="Axis">
        <ToggleBadge
          active={query.axis === null}
          onSelect={() => onChange({ ...query, axis: null })}
        >
          All axes
        </ToggleBadge>
        {axes.map((axis) => (
          <ToggleBadge
            key={axis}
            active={query.axis === axis}
            onSelect={() =>
              onChange({ ...query, axis: query.axis === axis ? null : axis })
            }
          >
            {AXIS_LABELS[axis]}
          </ToggleBadge>
        ))}
      </FilterGroup>

      <FilterGroup label="Research status">
        <ToggleBadge
          active={query.status === null}
          onSelect={() => onChange({ ...query, status: null })}
        >
          All statuses
        </ToggleBadge>
        {statuses.map((status) => (
          <ToggleBadge
            key={status}
            active={query.status === status}
            onSelect={() =>
              onChange({
                ...query,
                status: query.status === status ? null : status,
              })
            }
          >
            {researchStatusLabel(status)}
          </ToggleBadge>
        ))}
      </FilterGroup>

      <FilterGroup label="Suit">
        <ToggleBadge
          active={query.suit === null}
          onSelect={() => onChange({ ...query, suit: null })}
        >
          All suits
        </ToggleBadge>
        {suits.map((suit) => (
          <ToggleBadge
            key={suit}
            active={query.suit === suit}
            onSelect={() =>
              onChange({ ...query, suit: query.suit === suit ? null : suit })
            }
          >
            {suitLabel(suit)}
          </ToggleBadge>
        ))}
      </FilterGroup>

      {searching ? null : (
        <FilterGroup label="Order">
          <ToggleBadge
            active={query.sort === 'title'}
            onSelect={() => onChange({ ...query, sort: 'title' })}
          >
            Title
          </ToggleBadge>
          <ToggleBadge
            active={query.sort === 'status'}
            onSelect={() => onChange({ ...query, sort: 'status' })}
          >
            Status
          </ToggleBadge>
        </FilterGroup>
      )}

      {hasActiveFilters(query) ? (
        <button
          type="button"
          data-testid="explore-clear-filters"
          onClick={() =>
            onChange({ ...query, axis: null, status: null, suit: null })
          }
          className="min-h-[32px] self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Clear filters
        </button>
      ) : null}
    </section>
  )
}
