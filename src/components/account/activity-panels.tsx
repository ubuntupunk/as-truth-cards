import { Button } from '@/components/ui/button'

/**
 * Props for {@link ActivityPanels}.
 */
export interface ActivityPanelsProps {
  /** Opens the Saved cards surface; the page owns the navigation. */
  onOpenSaved: () => void
}

/**
 * My activity content — the text panels beside the account sidebar.
 *
 * The saved-cards list that used to live on this page listed raw slugs and
 * linked into the graph. `/account/saved` is the surface built for that job
 * (titles, summaries, unsave, and an honest unresolved-row state), so this
 * panel points at it rather than keeping a second list that would drift.
 *
 * Participation stays a placeholder because no participation capability ships
 * yet: saying so is honest, while an empty list would read as "you have done
 * nothing".
 *
 * @param props - See {@link ActivityPanelsProps}.
 * @returns The activity page's content panels.
 */
export function ActivityPanels({ onOpenSaved }: ActivityPanelsProps) {
  return (
    <div className="min-w-0 flex-1 space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Account / My activity
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          What you have kept and done.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Activity tied to your account, kept separate from the research
          session.
        </p>
      </header>

      <section
        aria-labelledby="activity-saved-heading"
        className="rounded-xl border border-graph-border bg-graph-surface p-5"
      >
        <h2
          id="activity-saved-heading"
          className="text-lg font-semibold text-foreground"
        >
          Saved cards
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Saving a card is a reading-list action, not a judgement about a
          claim&rsquo;s support. The saved-cards page lists them with their
          titles and lets you remove any of them.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          data-testid="activity-open-saved"
          onClick={onOpenSaved}
        >
          Open saved cards
        </Button>
      </section>

      <section
        aria-labelledby="activity-participation-heading"
        className="rounded-xl border border-graph-border bg-graph-surface p-5"
      >
        <h2
          id="activity-participation-heading"
          className="text-lg font-semibold text-foreground"
        >
          Participation
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Participation tracking is not enabled yet. When feedback and review
          features ship, their account-linked activity will be listed here —
          this page will not invent a history it cannot show.
        </p>
      </section>
    </div>
  )
}
