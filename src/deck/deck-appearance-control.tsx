/**
 * `DeckAppearanceControl` — the treatment selector on the Decks page.
 *
 * A labelled `<select>` over the three graph treatments. It is presentational:
 * the page owns the chosen treatment and the URL/storage writes, so the control
 * only reports a change. Switching a treatment never touches the light/dark
 * theme — it repaints deck chrome through the `--graph-*` tokens and rewrites
 * `?treatment=`, nothing else.
 */

import {
  GRAPH_TREATMENT_LABELS,
  GRAPH_TREATMENTS,
  type GraphTreatment,
  isGraphTreatment,
} from '../graph/appearance'

/**
 * The appearance selector.
 *
 * @param props.treatment The active treatment.
 * @param props.onChange Reports a valid new treatment from the `<select>`.
 * @returns A label + select, tagged `deck-treatment`.
 */
export function DeckAppearanceControl({
  treatment,
  onChange,
}: {
  treatment: GraphTreatment
  onChange: (treatment: GraphTreatment) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-graph-muted-foreground">
      <span className="hidden sm:inline">Appearance</span>
      <select
        data-testid="deck-treatment"
        value={treatment}
        aria-label="Appearance treatment"
        onChange={(event) => {
          const next = (event.target as HTMLSelectElement).value
          if (isGraphTreatment(next)) onChange(next)
        }}
        className="rounded-md border border-graph-border bg-graph-surface px-2 py-1.5 text-xs font-medium text-foreground"
      >
        {GRAPH_TREATMENTS.map((value) => (
          <option key={value} value={value}>
            {GRAPH_TREATMENT_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  )
}
