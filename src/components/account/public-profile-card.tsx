import { Button } from '@/components/ui/button'
import { normalizeWebsite } from '@/onboarding/wizard'

/**
 * The "Public profile preview" card from the improved profile panel
 * (`62:13294`): identity (initial avatar, name, role badge) and the three
 * public-facing fields, each honest about absence ("Not added").
 *
 * Role is shown exactly as the server owns it — the improved mockup's "Verified
 * researcher" badge is a placeholder ("criteria are not specified in this
 * mockup"), so the real badge reports the account's role and never implies
 * research standing. The designed "Choose visibility" action is omitted: no
 * visibility setting exists in the product, and the panel says so.
 */

/** Human labels for the role ladder. */
const ROLE_LABELS: Readonly<Record<string, string>> = {
  ANONYMOUS: 'Anonymous',
  VERIFIED: 'Verified',
  ACADEMIC: 'Academic',
  RESEARCHER: 'Researcher',
  MODERATOR: 'Moderator',
  ADMIN: 'Admin',
}

/** The first character of the display name, for the initial avatar. */
function initialOf(name: string): string {
  const trimmed = name.trim()
  return trimmed === '' ? '?' : trimmed.charAt(0).toUpperCase()
}

/** Props for {@link PublicProfileCard}. */
export interface PublicProfileCardProps {
  name: string
  bio: string | null
  website: string | null
  location: string | null
  /** The server-owned account role (named to avoid ARIA `role` semantics). */
  accountRole: string | undefined
  onEdit: () => void
}

/**
 * Render the public profile preview card.
 *
 * @param props The account's public-facing fields and the edit callback.
 * @returns The public profile card.
 */
export const PublicProfileCard = ({
  name,
  bio,
  website,
  location,
  accountRole,
  onEdit,
}: PublicProfileCardProps) => (
  <section
    aria-label="Public profile preview"
    className="w-full rounded-xl border border-graph-border bg-graph-surface p-6 xl:w-[610px]"
    data-testid="public-profile-card"
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Public profile preview
    </p>

    <div className="mt-4 flex items-center gap-5">
      <span
        aria-hidden="true"
        className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-graph-accent/10 text-2xl font-bold text-graph-accent"
      >
        {initialOf(name)}
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-2xl font-semibold text-foreground">
          {name || 'Not added'}
        </h2>
        <p className="mt-1 inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {ROLE_LABELS[accountRole ?? 'ANONYMOUS'] ?? 'Anonymous'}
        </p>
      </div>
    </div>

    <dl className="mt-6 divide-y divide-graph-border rounded-lg border border-graph-border">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bio
        </dt>
        <dd
          className="truncate text-sm text-foreground"
          data-testid="profile-bio-value"
        >
          {bio && bio.trim() !== '' ? bio : 'Not added'}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Website
        </dt>
        <dd className="truncate text-sm text-foreground">
          {website && website.trim() !== '' ? (
            <a
              href={normalizeWebsite(website)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-graph-accent underline underline-offset-4 hover:underline"
            >
              {website} <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            'Not added'
          )}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Location
        </dt>
        <dd
          className="truncate text-sm text-foreground"
          data-testid="profile-location-value"
        >
          {location && location.trim() !== '' ? location : 'Not added'}
        </dd>
      </div>
    </dl>

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Shown as your public-facing fields. Visibility settings are not
        available yet.
      </p>
      <Button type="button" variant="outline" onClick={onEdit}>
        Edit profile
      </Button>
    </div>
  </section>
)
