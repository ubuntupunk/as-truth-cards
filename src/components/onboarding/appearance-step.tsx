import { Button } from '@/components/ui/button'
import type { GraphTreatment } from '@/graph/appearance'
import type { SetupMarker } from '@/onboarding/wizard'
import { AppearanceSelector } from '../appearance-selector'
import { AppearancePreviews } from './appearance-previews'
import { SetupStrip } from './setup-strip'

/**
 * Setup step 2 — appearance ("Choose your reading room.").
 *
 * Figma authority: "Account / Onboarding — Atmospheric · Improved", appearance
 * step layout (`62:12629`). The choice is persisted to the same device-local
 * storage the Graph page reads (`GRAPH_TREATMENT_STORAGE_KEY`); the panel copy
 * says "on this device" rather than implying the account carries it.
 */

/** Props for {@link AppearanceStep}. */
export interface AppearanceStepProps {
  treatment: GraphTreatment
  markers: readonly SetupMarker[]
  onSelect: (treatment: GraphTreatment) => void
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}

/**
 * Render setup step 2.
 *
 * @param props The current treatment and step callbacks.
 * @returns The step-2 layout: context column plus selector card.
 */
export const AppearanceStep = ({
  treatment,
  markers,
  onSelect,
  onBack,
  onNext,
  onSkip,
}: AppearanceStepProps) => (
  <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
    <div className="flex flex-col gap-3">
      <span className="w-fit rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
        Step 2 of 3
      </span>
      <h2 className="text-2xl leading-tight text-foreground">
        Choose your reading room.
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Optional. Keep the current theme or choose another look; the research
        stays the same.
      </p>
    </div>

    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-xl font-semibold text-foreground">
        Choose an appearance
      </h3>
      <div className="mt-4">
        <SetupStrip markers={markers} />
      </div>

      <div className="mt-6 space-y-5">
        <AppearanceSelector value={treatment} onSelect={onSelect} />
        <AppearancePreviews selected={treatment} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your choice is stored on this device, not on your account.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            ← Back: Profile
          </Button>
          <Button type="button" onClick={onNext}>
            Next: Research preferences →
          </Button>
        </div>
      </div>
    </div>
  </div>
)
