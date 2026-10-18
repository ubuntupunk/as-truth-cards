import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type {
  ProfileField,
  ProfileFieldErrors,
  ProfileFormValues,
} from '@/onboarding/wizard'

/**
 * The "Edit profile" section from the improved profile panel (`62:13347`):
 * the four public-facing fields with the project's honest framing, revealed by
 * the public card's "Edit profile" action.
 */

/** Props for {@link EditProfileForm}. */
export interface EditProfileFormProps {
  values: ProfileFormValues
  errors: ProfileFieldErrors
  saving: boolean
  error: string | null
  onFieldChange: (field: ProfileField, value: string) => void
  onSave: () => void
  onCancel: () => void
}

/**
 * Render the edit-profile form section.
 *
 * @param props Form values, validation errors and save/cancel callbacks.
 * @returns The edit-profile section.
 */
export const EditProfileForm = ({
  values,
  errors,
  saving,
  error,
  onFieldChange,
  onSave,
  onCancel,
}: EditProfileFormProps) => (
  <section
    aria-label="Edit profile"
    className="rounded-xl border border-graph-border bg-graph-surface p-6"
    data-testid="edit-profile-form"
  >
    <h2 className="text-xl font-semibold text-foreground">Edit profile</h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Edit the public-facing fields only. Email and security are managed in
      Settings.
    </p>

    {error ? (
      <p
        role="alert"
        className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        data-testid="edit-profile-error"
      >
        {error}
      </p>
    ) : null}

    <form
      className="mt-6 space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <div className="space-y-2">
        <Label
          htmlFor="edit-name"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Display name
        </Label>
        <Input
          id="edit-name"
          name="name"
          value={values.name}
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'edit-name-error' : undefined}
          onChange={(event) => onFieldChange('name', event.currentTarget.value)}
        />
        {errors.name ? (
          <p
            id="edit-name-error"
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="edit-bio"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Bio <span className="font-normal normal-case">Optional</span>
        </Label>
        <Textarea
          id="edit-bio"
          name="bio"
          rows={3}
          value={values.bio}
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby={errors.bio ? 'edit-bio-error' : undefined}
          onChange={(event) => onFieldChange('bio', event.currentTarget.value)}
        />
        {errors.bio ? (
          <p
            id="edit-bio-error"
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
            htmlFor="edit-website"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Website <span className="font-normal normal-case">Optional</span>
          </Label>
          <Input
            id="edit-website"
            name="website"
            value={values.website}
            aria-invalid={errors.website ? true : undefined}
            aria-describedby={errors.website ? 'edit-website-error' : undefined}
            onChange={(event) =>
              onFieldChange('website', event.currentTarget.value)
            }
          />
          {errors.website ? (
            <p
              id="edit-website-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.website}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="edit-location"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Location <span className="font-normal normal-case">Optional</span>
          </Label>
          <Input
            id="edit-location"
            name="location"
            value={values.location}
            aria-invalid={errors.location ? true : undefined}
            aria-describedby={
              errors.location ? 'edit-location-error' : undefined
            }
            onChange={(event) =>
              onFieldChange('location', event.currentTarget.value)
            }
          />
          {errors.location ? (
            <p
              id="edit-location-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.location}
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        These details describe you. They don't verify credentials or validate
        your research.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  </section>
)
