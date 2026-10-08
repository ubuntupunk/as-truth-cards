/**
 * The Explore search field — the `search` verb of Phase B (ROADMAP §71–96).
 *
 * A labelled, controlled input over `/api/graph/search`: the page owns the
 * raw text, `useCardSearch` owns the trim/debounce/minimum-length, and this
 * component owns nothing but the markup — so no search rule (minimum term,
 * debounce, retry policy) can quietly fork between surfaces that share the
 * same endpoint.
 *
 * Styling follows the canonical control input used across the Graph
 * controls, and the field carries a real `<label>` (visually hidden) rather
 * than a placeholder standing in for one: a placeholder disappears the moment
 * the user types, which is exactly when a screen-reader user still needs it.
 */

/** Props for {@link ExploreSearchField}. */
export type ExploreSearchFieldProps = {
  /** The raw term; unmodified until the page's search hook sees it. */
  readonly value: string
  /** Reports a new raw term (typing or clearing). */
  readonly onChange: (value: string) => void
}

/**
 * The search input.
 *
 * @param props See {@link ExploreSearchFieldProps}.
 * @returns A `<form>`-free labelled search input with an optional clear
 * button.
 */
export function ExploreSearchField({
  value,
  onChange,
}: ExploreSearchFieldProps) {
  return (
    <div className="relative w-full">
      <label htmlFor="explore-search" className="sr-only">
        Search cards
      </label>
      <input
        id="explore-search"
        data-testid="explore-search"
        type="search"
        value={value}
        onInput={(event) => onChange(event.currentTarget.value)}
        placeholder="Search titles and summaries…"
        autoComplete="off"
        spellcheck={false}
        className="h-9 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-graph-focus/30"
      />
      {value === '' ? null : (
        <button
          type="button"
          data-testid="explore-search-clear"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  )
}
