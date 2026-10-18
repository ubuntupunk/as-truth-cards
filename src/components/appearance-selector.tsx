import { GRAPH_TREATMENT_LABELS, type GraphTreatment } from '@/graph/appearance'

/**
 * The segmented "Atmospheric / Editorial / Workspace" appearance selector.
 * Shared by onboarding step 2 and the account page's private-details card,
 * matching the improved panels' segmented control (`62:12650`, `62:13331`).
 */

/** The treatments, in selector order. */
const TREATMENTS: readonly GraphTreatment[] = [
  'atmospheric',
  'editorial',
  'workspace',
]

/** Props for {@link AppearanceSelector}. */
export interface AppearanceSelectorProps {
  value: GraphTreatment
  onSelect: (treatment: GraphTreatment) => void
  /** Optional busy guard: disabled treatments while a write is in flight. */
  disabled?: boolean
}

/**
 * Render the appearance segmented control.
 *
 * @param props The current value and selection callback.
 * @returns Three toggle buttons acting as one labelled control.
 */
export const AppearanceSelector = ({
  value,
  onSelect,
  disabled = false,
}: AppearanceSelectorProps) => (
  <fieldset
    aria-label="Appearance"
    className="m-0 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1"
    data-testid="appearance-selector"
  >
    {TREATMENTS.map((treatment) => {
      const selected = treatment === value
      return (
        <button
          key={treatment}
          type="button"
          aria-pressed={selected}
          disabled={disabled}
          onClick={() => onSelect(treatment)}
          className={
            selected
              ? 'rounded-md bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm'
              : 'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'
          }
        >
          {GRAPH_TREATMENT_LABELS[treatment]}
        </button>
      )
    })}
  </fieldset>
)
