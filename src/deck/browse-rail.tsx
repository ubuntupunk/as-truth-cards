/**
 * `BrowseRail` — the left rail of the Deck workspace (Figma `7:4434`).
 *
 * Per §4.8 this rail is deliberately small: user-created deck CRUD
 * ("Your decks", "New deck") is out of scope until a persistence contract and
 * schema exist, so **no placeholder buttons render**. The two categories the
 * cards listing can actually filter by are **Axis** and **Locale**, so the rail
 * offers the axes and the locale slugs present in the loaded cards (the same
 * "never invent a filter" rule the scope strip obeys). The remaining graph
 * categories (mechanism, concept, collection) are facets of the Graph Explorer,
 * not fields on the deck listing row, so they are surfaced as a single pointer
 * to the existing graph surface rather than dead links.
 *
 * Locale filtering reads `card_locales` (surfaced on the row as
 * `classification.localeSlugs`) and is never inferred from suit or collection —
 * a card curated into the `south-africa` collection is not thereby a South
 * Africa card. The filter is kept dimension-qualified alongside `axis`.
 */

import { cn } from '@/lib/utils'
import type { CardAxisValue } from '../../trope-cards/src/graph/types.ts'
import { AXIS_LABELS, humanize } from '../graph/deck-facets'

/** Props for {@link BrowseRail}. */
export type BrowseRailProps = {
  /** Axes present in the loaded cards, in canonical order. */
  readonly axes: readonly CardAxisValue[]
  /** The axis the deck is currently scoped to, or `null` for all axes. */
  readonly activeAxis: CardAxisValue | null
  /** Report the next axis filter; `null` clears back to all axes. */
  readonly onChange: (axis: CardAxisValue | null) => void
  /** Locale slugs present in the loaded cards, in slug order. */
  readonly locales: readonly string[]
  /** The locale the deck is currently scoped to, or `null` for all locales. */
  readonly activeLocale: string | null
  /** Report the next locale filter; `null` clears back to all locales. */
  readonly onLocaleChange: (locale: string | null) => void
  /** The existing surface the remaining categories live on. */
  readonly graphHref: string
}

/** The row treatment: active rows are filled, inactive rows are quiet. */
function axisRowClasses(active: boolean): string {
  return cn(
    'flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors',
    active
      ? 'bg-graph-muted text-foreground'
      : 'text-graph-muted-foreground hover:bg-graph-muted/60 hover:text-foreground',
  )
}

/**
 * The browse rail.
 *
 * @param props See {@link BrowseRailProps}.
 * @returns An `<aside>` of working axis filters plus a graph pointer.
 */
export function BrowseRail({
  axes,
  activeAxis,
  onChange,
  locales,
  activeLocale,
  onLocaleChange,
  graphHref,
}: BrowseRailProps) {
  return (
    <aside
      data-testid="deck-browse-rail"
      aria-label="Browse categories"
      className="rounded-xl border border-graph-border bg-graph-surface p-4"
    >
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        Browse categories
      </h2>
      <p
        data-testid="browse-rail-scope"
        className="mt-1 text-xs leading-relaxed text-graph-muted-foreground"
      >
        Filter the deck by axis or locale. Mechanism, concept, and collection
        browsing live in the Graph Explorer.
      </p>

      <nav aria-label="Axes" className="mt-3">
        <ul data-testid="browse-rail-axes" className="space-y-1">
          <li>
            <button
              type="button"
              data-testid="browse-rail-axis"
              data-axis="__all__"
              aria-pressed={activeAxis === null}
              onClick={() => onChange(null)}
              className={axisRowClasses(activeAxis === null)}
            >
              All axes
            </button>
          </li>
          {axes.map((axis) => (
            <li key={axis}>
              <button
                type="button"
                data-testid="browse-rail-axis"
                data-axis={axis}
                aria-pressed={activeAxis === axis}
                onClick={() => onChange(activeAxis === axis ? null : axis)}
                className={axisRowClasses(activeAxis === axis)}
              >
                {AXIS_LABELS[axis]}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="Locales" className="mt-4">
        <h3
          data-testid="browse-rail-locales-label"
          className="text-xs font-semibold text-graph-muted-foreground"
        >
          Locale
        </h3>
        <ul data-testid="browse-rail-locales" className="mt-1 space-y-1">
          <li>
            <button
              type="button"
              data-testid="browse-rail-locale"
              data-locale="__all__"
              aria-pressed={activeLocale === null}
              onClick={() => onLocaleChange(null)}
              className={axisRowClasses(activeLocale === null)}
            >
              All locales
            </button>
          </li>
          {locales.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                data-testid="browse-rail-locale"
                data-locale={slug}
                aria-pressed={activeLocale === slug}
                onClick={() =>
                  onLocaleChange(activeLocale === slug ? null : slug)
                }
                className={axisRowClasses(activeLocale === slug)}
              >
                {humanize(slug)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <a
        data-testid="browse-rail-graph-link"
        href={graphHref}
        className="mt-4 inline-block text-xs font-medium text-graph-accent hover:underline"
      >
        Open the Graph Explorer
      </a>
    </aside>
  )
}
