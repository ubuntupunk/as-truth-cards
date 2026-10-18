import type { SetupMarker } from '@/onboarding/wizard'

/**
 * The "1 Profile / 2 Appearance / 3 Research preferences" progress strip that
 * heads each setup step card in the improved onboarding panels
 * (`62:12582`-family). Rendered once per visible step; done steps carry a check,
 * the current step is marked with `aria-current="step"`.
 */

/** Props for {@link SetupStrip}. */
export interface SetupStripProps {
  markers: readonly SetupMarker[]
}

/**
 * Render the three-step progress strip.
 *
 * @param props The derived {@link SetupMarker}s for the current state.
 * @returns The strip as an ordered list.
 */
export const SetupStrip = ({ markers }: SetupStripProps) => (
  <ol
    className="flex flex-wrap items-center gap-x-6 gap-y-2"
    data-testid="setup-strip"
    aria-label="Setup progress"
  >
    {markers.map((marker) => (
      <li
        key={marker.label}
        aria-current={marker.current ? 'step' : undefined}
        className={
          marker.current
            ? 'flex items-center gap-2 text-sm font-semibold text-primary'
            : marker.done
              ? 'flex items-center gap-2 text-sm font-medium text-foreground'
              : 'flex items-center gap-2 text-sm font-medium text-muted-foreground'
        }
      >
        <span
          aria-hidden="true"
          className={
            marker.done && !marker.current
              ? 'text-primary'
              : 'text-muted-foreground'
          }
        >
          {marker.done ? '✓' : ''}
        </span>
        {marker.label}
      </li>
    ))}
  </ol>
)
