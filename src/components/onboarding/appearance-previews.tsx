import { GRAPH_TREATMENT_LABELS, type GraphTreatment } from '@/graph/appearance'

/**
 * The appearance preview thumbnails shown in setup step 2.
 *
 * The previews are stylised miniatures, not live renders: each one communicates
 * its treatment's page/surface/accent relationship at a glance. Colours here
 * mirror the three treatments' chrome as designed in the improved panels; they
 * are decorative previews, so they intentionally do not consume the token
 * system (the selected treatment is applied app-wide through the real chrome
 * tokens once persisted).
 */

/** The three treatments, in selector order. */
const PREVIEW_TREATMENTS: readonly GraphTreatment[] = [
  'atmospheric',
  'editorial',
  'workspace',
]

/** Decorative palette per treatment for the miniature cards. */
const PREVIEW_STYLES: Readonly<
  Record<
    GraphTreatment,
    { page: string; surface: string; line: string; text: string }
  >
> = {
  atmospheric: {
    page: '#101b30',
    surface: '#203455',
    line: '#9fbffd',
    text: '#a3afc5',
  },
  editorial: {
    page: '#f6efe3',
    surface: '#ffffff',
    line: '#b4530f',
    text: '#7a6a55',
  },
  workspace: {
    page: '#eef1f7',
    surface: '#ffffff',
    line: '#2563eb',
    text: '#5d6b80',
  },
}

/** Props for {@link AppearancePreviews}. */
export interface AppearancePreviewsProps {
  selected: GraphTreatment
}

/**
 * Render the three miniature theme previews.
 *
 * @param props The currently selected treatment.
 * @returns The preview row.
 */
export const AppearancePreviews = ({ selected }: AppearancePreviewsProps) => (
  <div
    className="grid gap-4 sm:grid-cols-3"
    data-testid="appearance-previews"
    aria-hidden="true"
  >
    {PREVIEW_TREATMENTS.map((treatment) => {
      const style = PREVIEW_STYLES[treatment]
      return (
        <div
          key={treatment}
          className="rounded-lg border p-3"
          style={{ backgroundColor: style.page, borderColor: style.line }}
          data-selected={treatment === selected}
        >
          <div
            className="rounded-md p-2"
            style={{ backgroundColor: style.surface }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="text-[9px] font-bold"
                style={{ color: style.line }}
              >
                TROPE DECK
              </span>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: style.line }}
              />
            </div>
            <p
              className="text-[10px] font-semibold"
              style={{ color: style.line }}
            >
              A line of inquiry
            </p>
            <div className="mt-1 flex gap-1">
              <span
                className="h-1 w-4"
                style={{ backgroundColor: style.line }}
              />
              <span
                className="h-1 w-2.5"
                style={{ backgroundColor: style.text }}
              />
              <span
                className="h-1 w-2.5"
                style={{ backgroundColor: style.text }}
              />
            </div>
            <div
              className="my-2 h-px w-full"
              style={{ backgroundColor: style.text }}
            />
            <p className="text-[9px]" style={{ color: style.text }}>
              Card → Claim → Source
            </p>
          </div>
          <p
            className="mt-2 flex items-center justify-between text-xs font-semibold"
            style={{ color: style.line }}
          >
            {GRAPH_TREATMENT_LABELS[treatment]}
            {treatment === selected ? <span>✓</span> : null}
          </p>
        </div>
      )
    })}
  </div>
)
