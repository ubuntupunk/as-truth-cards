import { initialOf } from '@/components/account/public-profile-card'
import { Button, buttonVariants } from '@/components/ui/button'

/**
 * The "Profile photo" panel: upload, review and remove the account avatar
 * from the Settings page.
 *
 * Deliberately hook-free — all state arrives as props and every transition
 * leaves as a callback, so the whole upload flow is testable by invoking the
 * component as a plain function and calling the handlers, the same way the
 * deck tests drive `FeaturedCard`. The page owns the state.
 *
 * The file picker needs no JavaScript to open: the visible "Choose image"
 * control is a `<label>` bound to a visually-hidden but focusable `<input
 * type="file">`, so keyboard users reach the input itself in the tab order
 * and screen readers announce it through its label — no invisible
 * click-triggering shim, and nothing for a stripped-down browser to break.
 */

/** The avatar dimension every consumer renders it at. */
const AVATAR_DISPLAY_CLASS = 'h-[72px] w-[72px]'

/** Props for {@link AvatarPanel}. */
export interface AvatarPanelProps {
  /** Display name, for the initials fallback and the image alt. */
  name: string
  /** The current avatar URL from `user.image`, or `null` when none is stored. */
  imageUrl: string | null
  /** The file chosen for upload but not yet uploaded. */
  draftFile: File | null
  /** Why the chosen draft was refused (client validation), or `null`. */
  draftError: string | null
  /** Which write operation is in flight. */
  busy: 'idle' | 'uploading' | 'removing'
  /** The last failed write's message, or `null`. */
  error: string | null
  /** The last successful write's confirmation, or `null`. */
  status: string | null
  /** A file was chosen (or the picker was cancelled: `null`). */
  onChoose: (file: File | null) => void
  /** The chosen draft was dismissed without uploading. */
  onCancelDraft: () => void
  /** Upload the chosen draft. */
  onUpload: () => void
  /** Remove the stored avatar. */
  onRemove: () => void
}

/**
 * A size a person can read, for the chosen-file line.
 *
 * @param bytes The file's size in bytes.
 * @returns The size in kilobytes, never `0 KB` for a small non-empty file.
 */
function humanKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Render the profile-photo panel.
 *
 * @param props See {@link AvatarPanelProps}.
 * @returns The settings avatar panel.
 */
export const AvatarPanel = ({
  name,
  imageUrl,
  draftFile,
  draftError,
  busy,
  error,
  status,
  onChoose,
  onCancelDraft,
  onUpload,
  onRemove,
}: AvatarPanelProps) => {
  const hasAvatar = imageUrl !== null && imageUrl !== ''
  const idle = busy === 'idle'
  const uploadable = draftFile !== null && draftError === null

  return (
    <section
      aria-label="Profile photo"
      className="rounded-xl border border-graph-border bg-graph-surface p-6"
      data-testid="avatar-panel"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Profile photo
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        {hasAvatar ? (
          <img
            src={imageUrl as string}
            alt=""
            className={`${AVATAR_DISPLAY_CLASS} shrink-0 rounded-full object-cover`}
            data-testid="avatar-image"
          />
        ) : (
          <span
            aria-hidden="true"
            className={`${AVATAR_DISPLAY_CLASS} flex shrink-0 items-center justify-center rounded-full bg-graph-accent/10 text-2xl font-bold text-graph-accent`}
            data-testid="avatar-initials"
          >
            {initialOf(name)}
          </span>
        )}

        <div className="min-w-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            Your photo is public alongside your display name. It is profile
            presentation, not a research credential. PNG, JPEG or WebP, up to
            512&nbsp;KB.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="avatar-file-input"
              className={
                idle
                  ? buttonVariants({ variant: 'outline' })
                  : `${buttonVariants({ variant: 'outline' })} cursor-not-allowed opacity-60`
              }
              data-testid="avatar-choose-label"
            >
              Choose image
            </label>

            {draftFile !== null ? (
              <>
                <Button
                  type="button"
                  onClick={onUpload}
                  disabled={!idle || !uploadable}
                  data-testid="avatar-upload"
                >
                  {busy === 'uploading' ? 'Uploading…' : 'Upload'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancelDraft}
                  disabled={!idle}
                  data-testid="avatar-cancel-draft"
                >
                  Cancel
                </Button>
              </>
            ) : null}

            {hasAvatar ? (
              <Button
                type="button"
                variant="outline"
                onClick={onRemove}
                disabled={!idle}
                data-testid="avatar-remove"
              >
                {busy === 'removing' ? 'Removing…' : 'Remove'}
              </Button>
            ) : null}
          </div>

          {draftFile !== null ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="avatar-draft-file"
            >
              {draftFile.name} · {humanKb(draftFile.size)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Visually hidden but focusable: the label opens it with a pointer,
          the tab order reaches it with a keyboard, and its accessible name
          comes from the bound label. */}
      <input
        id="avatar-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Choose an image file"
        data-testid="avatar-file-input"
        disabled={!idle}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null
          onChoose(file)
          // Reset so choosing the same file again re-reports it.
          event.currentTarget.value = ''
        }}
      />

      {draftError !== null ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          data-testid="avatar-draft-error"
        >
          {draftError}
        </p>
      ) : null}

      {error !== null ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          data-testid="avatar-error"
        >
          {error}
        </p>
      ) : null}

      {status !== null ? (
        <p
          role="status"
          className="mt-4 text-sm text-muted-foreground"
          data-testid="avatar-status"
        >
          {status}
        </p>
      ) : null}
    </section>
  )
}
