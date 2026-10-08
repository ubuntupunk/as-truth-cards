/**
 * One Explore result tile — Phase B's "allow a discovered card to enter card
 * detail, graph exploration, or research" (ROADMAP §87).
 *
 * Two shapes, honestly different: a **row** is a loaded listing row and shows
 * everything the listing carries — title, summary, the research-status badge,
 * and the graph's own classification chips; a **hit** is a search result
 * whose row never arrived in the loaded page, so it shows the fields the
 * search index actually returns and *says* that status and classification
 * are not here, rather than rendering an empty badge or a fabricated
 * `unknown` that would look like a research state.
 *
 * Both offer the same two handoffs as plain anchors, matching the Deck's own
 * `Explore in graph` transition: card detail on the Deck (`/?focus=`, which
 * the Deck lands on and keeps in its URL) and graph exploration
 * (`/graph?focus=`). Research handoff arrives with Phase D; until it exists
 * there is no control pretending otherwise.
 */

import { ClassificationChips } from '@/deck/classification-tags'
import { StatusBadge } from '@/deck/status-badge'
import type { ExploreResult } from './explore-model'

/** Props for {@link ResultCard}. */
export type ResultCardProps = {
  readonly result: ExploreResult
}

/**
 * One result tile.
 *
 * @param props See {@link ResultCardProps}.
 * @returns An `<li>` for the page's result list.
 */
export function ResultCard({ result }: ResultCardProps) {
  // Narrow on the union itself at each use: TS cannot carry a discriminant
  // through an intermediate variable.
  const slug = result.kind === 'row' ? result.card.slug : result.hit.slug
  const title = result.kind === 'row' ? result.card.title : result.hit.title
  const summary =
    result.kind === 'row' ? result.card.summary : result.hit.summary

  return (
    <li
      data-testid="explore-result"
      data-kind={result.kind}
      className="flex flex-col gap-2 rounded-xl border border-graph-border bg-graph-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3
          data-testid="explore-result-title"
          className="text-sm font-semibold leading-snug text-foreground"
        >
          {title}
        </h3>
        {result.kind === 'row' ? (
          <StatusBadge status={result.card.epistemicStatus} />
        ) : null}
      </div>

      {summary === null ? null : (
        <p
          data-testid="explore-result-summary"
          className="text-sm text-muted-foreground"
        >
          {summary}
        </p>
      )}

      {result.kind === 'row' ? (
        <ClassificationChips classification={result.card.classification} />
      ) : (
        <p
          data-testid="explore-result-hit-note"
          className="text-xs text-muted-foreground"
        >
          From the search index — status and classification load with the card.
        </p>
      )}

      <div
        data-testid="explore-result-actions"
        className="mt-auto flex flex-wrap gap-2 pt-1"
      >
        <a
          href={`/?focus=${encodeURIComponent(slug)}`}
          className="min-h-[36px] rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Read card
        </a>
        <a
          href={`/graph?focus=${encodeURIComponent(slug)}`}
          className="min-h-[36px] rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Explore in graph
        </a>
      </div>
    </li>
  )
}
