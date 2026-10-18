import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type {
  ProfileField,
  ProfileFieldErrors,
  ProfileFormValues,
  SetupMarker,
} from '@/onboarding/wizard'
import { SetupStrip } from './setup-strip'

/**
 * Setup step 1 — the profile form ("A name, not a credential.").
 *
 * Figma authority: "Account / Onboarding — Atmospheric · Improved", profile
 * step layout (`62:12572`). Presentational: the page owns the wizard state and
 * passes values, errors and callbacks down, so this panel renders identically
 * under the string-based test harness.
 */

/** Props for {@link ProfileStep}. */
export interface ProfileStepProps {
  values: ProfileFormValues
  errors: ProfileFieldErrors
  saving: boolean
  markers: readonly SetupMarker[]
  onFieldChange: (field: ProfileField, value: string) => void
  onNext: () => void
  onSkip: () => void
  onExit: () => void
}

/**
 * Render setup step 1.
 *
 * @param props Values, errors and callbacks for the profile step.
 * @returns The step-1 layout: context column plus form card.
 */
export const ProfileStep = ({
  values,
  errors,
  saving,
  markers,
  onFieldChange,
  onNext,
  onSkip,
  onExit,
}: ProfileStepProps) => (
  <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10">
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Step 1 of 3
      </p>
      <h2 className="text-2xl leading-tight text-foreground">
        A name, not a credential.
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Tell others a little about yourself. Profile details and participation
        do not establish research validity.
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        You can skip setup. Email stays in private account details—not your
        public bio.
      </p>
    </div>

    <div className="rounded-xl border border-graph-border bg-graph-surface p-6">
      <h3 className="text-xl font-semibold text-foreground">
        Start with the basics
      </h3>
      <div className="mt-4">
        <SetupStrip markers={markers} />
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          onNext()
        }}
      >
        <div className="space-y-2">
          <Label
            htmlFor="profile-name"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Display name
          </Label>
          <Input
            id="profile-name"
            name="name"
            value={values.name}
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'profile-name-error' : undefined}
            onChange={(event) =>
              onFieldChange('name', event.currentTarget.value)
            }
          />
          {errors.name ? (
            <p
              id="profile-name-error"
              role="alert"
              className="text-xs text-destructive"
              data-testid="profile-name-error"
            >
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="profile-bio"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Bio <span className="font-normal normal-case">Optional</span>
          </Label>
          <Textarea
            id="profile-bio"
            name="bio"
            rows={3}
            value={values.bio}
            placeholder="Not added"
            aria-invalid={errors.bio ? true : undefined}
            aria-describedby={errors.bio ? 'profile-bio-error' : undefined}
            onChange={(event) =>
              onFieldChange('bio', event.currentTarget.value)
            }
          />
          {errors.bio ? (
            <p
              id="profile-bio-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.bio}
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="profile-website"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Website <span className="font-normal normal-case">Optional</span>
            </Label>
            <Input
              id="profile-website"
              name="website"
              value={values.website}
              placeholder="Not added"
              aria-invalid={errors.website ? true : undefined}
              aria-describedby={
                errors.website ? 'profile-website-error' : undefined
              }
              onChange={(event) =>
                onFieldChange('website', event.currentTarget.value)
              }
            />
            {errors.website ? (
              <p
                id="profile-website-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.website}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="profile-location"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Location <span className="font-normal normal-case">Optional</span>
            </Label>
            <Input
              id="profile-location"
              name="location"
              value={values.location}
              placeholder="Not added"
              aria-invalid={errors.location ? true : undefined}
              aria-describedby={
                errors.location ? 'profile-location-error' : undefined
              }
              onChange={(event) =>
                onFieldChange('location', event.currentTarget.value)
              }
            />
            {errors.location ? (
              <p
                id="profile-location-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.location}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onSkip}>
            Skip for now
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="ghost" onClick={onExit}>
              Back to account
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Next: Appearance →'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  </div>
)
