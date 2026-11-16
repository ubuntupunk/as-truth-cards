/**
 * Presentational Saved cards panel.
 *
 * Every state the page can be in is a prop, so this component never fetches and never
 * owns session state. That keeps the honest states testable with the string renderer the
 * rest of the account tests use, and keeps the page's job (join, unsave, error handling)
 * separate from what the panel looks like.
 *
 * In-app links arrive through the optional `link` prop rather than importing
 * `react-router-dom` directly. `AccountNav` and `Footer` cannot be render-tested for the
 * same reason: a `Link` reads router context, which the server-rendered test harness does
 * not provide. Injecting the link keeps SPA navigation in the app and lets the tests
 * render the real copy, including the unresolved-slug explanation.
 *
 * **Never a dead link, never a silent drop.** A saved slug the listing could not resolve
 * is still listed, by slug, with the neutral explanation that it is not available right
 * now — the panel does not claim the card was deleted, because an unresolved row can also
 * mean it fell outside the listing page.
 */

import type { ComponentChildren } from 'preact'
import { Link } from 'react-router-dom'
import type { SavedCardsPanelState } from '@/account/saved-cards-model'
import { savedCardHref } from '@/account/saved-cards-model'

/** The props an in-app link is rendered with. */
export type PanelLinkProps = {
  readonly to: string
  readonly className?: string
  readonly children: ComponentChildren
}

/** Renders an in-app link. Injected so the panel is renderable without a router. */
export type PanelLink = (props: PanelLinkProps) => ComponentChildren

/** Props for {@link SavedCardsPanel}. */
export type SavedCardsPanelProps = {
  readonly state: SavedCardsPanelState
  /** Unsave handler; omitted when the surface is not interactive. */
  readonly onUnsave?: (slug: string) => void
  /** Slug whose unsave request is in flight, so its button can say so. */
  readonly unsavingSlug?: string | null
  /** Non-fatal notice (for example a failed unsave that was rolled back). */
  readonly notice?: string | null
  /** Link renderer; defaults to the SPA `Link`. Tests pass an anchor. */
  readonly link?: PanelLink
}

/** The production link: client-side navigation via react-router. */
const routerLink: PanelLink = ({ to, className, children }) => (
  <Link to={to} className={className}>
    {children}
  </Link>
)

/**
 * Render the saved-cards list with explicit loading, signed-out, error, and empty states.
 *
 * @param props See {@link SavedCardsPanelProps}.
 * @returns The panel as a labelled section.
 */
export function SavedCardsPanel({
  state,
  onUnsave,
  unsavingSlug = null,
  notice = null,
  link = routerLink,
}: SavedCardsPanelProps) {
  return (
    <section
      data-testid="saved-cards"
      aria-labelledby="saved-cards-heading"
      className="rounded-xl border border-graph-border bg-graph-surface p-5"
    >
      <h2
        id="saved-cards-heading"
        className="text-lg font-semibold text-foreground"
      >
        Saved cards
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cards you saved to your account. Saving is not a judgement about a
        claim&rsquo;s support; it is a reading list.
      </p>

      {notice !== null && (
        <p
          data-testid="saved-cards-notice"
          role="status"
          aria-live="polite"
          className="mt-3 text-xs font-medium text-destructive"
        >
          {notice}
        </p>
      )}

      <div className="mt-4">
        {renderBody(state, onUnsave, unsavingSlug, link)}
      </div>
    </section>
  )
}

/**
 * Render one state's body.
 *
 * Split from the shell so every branch is a small, readable return rather than a stack of
 * nested ternaries.
 *
 * @param state Current panel state.
 * @param onUnsave Unsave handler, when interactive.
 * @param unsavingSlug Slug with a request in flight.
 * @returns The body for the state.
 */
function renderBody(
  state: SavedCardsPanelState,
  onUnsave: ((slug: string) => void) | undefined,
  unsavingSlug: string | null,
  link: PanelLink,
) {
  const AppLink = link

  if (state.kind === 'loading') {
    return (
      <p
        data-testid="saved-cards-loading"
        className="text-sm text-muted-foreground"
      >
        Loading saved cards…
      </p>
    )
  }

  if (state.kind === 'signed-out') {
    return (
      <p
        data-testid="saved-cards-signed-out"
        className="text-sm text-muted-foreground"
      >
        <AppLink
          to={state.signInHref}
          className="font-medium text-graph-accent hover:underline"
        >
          Sign in
        </AppLink>{' '}
        to see the cards you saved to your account.
      </p>
    )
  }

  if (state.kind === 'error') {
    return (
      <p
        data-testid="saved-cards-error"
        role="alert"
        className="text-sm text-destructive"
      >
        {state.message}
      </p>
    )
  }

  if (state.entries.length === 0 && state.unresolvedSlugs.length === 0) {
    return (
      <p
        data-testid="saved-cards-empty"
        className="text-sm text-muted-foreground"
      >
        No saved cards yet.{' '}
        <AppLink
          to="/"
          className="font-medium text-graph-accent hover:underline"
        >
          Browse the deck
        </AppLink>{' '}
        and save one.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {state.entries.length > 0 && (
        <ul data-testid="saved-cards-list" className="space-y-2">
          {state.entries.map((entry) => {
            const unsaving = entry.slug === unsavingSlug
            return (
              <li
                key={entry.slug}
                data-testid="saved-card"
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <AppLink
                    to={savedCardHref(entry.slug)}
                    className="text-sm font-semibold text-foreground hover:underline"
                  >
                    {entry.title}
                  </AppLink>
                  {entry.summary !== null && entry.summary.trim() !== '' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.summary}
                    </p>
                  )}
                </div>
                {onUnsave !== undefined && (
                  <button
                    type="button"
                    disabled={unsaving}
                    onClick={() => onUnsave(entry.slug)}
                    aria-label={`Unsave ${entry.title}`}
                    className="min-h-[44px] shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"
                  >
                    {unsaving ? 'Unsaving…' : 'Unsave'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {state.unresolvedSlugs.length > 0 && (
        <div data-testid="saved-cards-unresolved">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Not available right now
          </h3>
          <ul className="mt-2 space-y-1">
            {state.unresolvedSlugs.map((slug) => (
              <li
                key={slug}
                className="rounded-lg border border-dashed border-border px-3 py-2 font-mono text-xs text-muted-foreground"
              >
                {slug}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            These saved entries could not be matched to a card in the listing.
          </p>
        </div>
      )}
    </div>
  )
}
