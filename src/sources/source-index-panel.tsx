/**
 * `SourceIndexPanel` — the canonical source index rail.
 *
 * The index half of the Sources surface: every source the corpus holds, with
 * the metadata it actually carries and its attribution count. It is pure —
 * props in, vnodes out — so the node test suite renders it directly.
 *
 * The copy draws the SPEC §8.2 line the whole surface exists to keep: a
 * bibliography entry attached to a claim is a *provenance lead*, and the count
 * beside it is attributions, not verifications. Selecting a source only changes
 * which provenance neighbourhood the workspace below shows; it never turns a
 * row into evidence.
 */

import type { SourceSummary } from '../graph/projection-guards'
import {
  attributionSummary,
  humanizeSourceType,
  sourceMetadataLines,
} from './source-model'

/**
 * The source index rail.
 *
 * @param props.sources The loaded sources, or `[]` while loading.
 * @param props.total The server-reported total for the index.
 * @param props.isPending Whether the index request is in flight.
 * @param props.error The index request's error, or `null`.
 * @param props.selectedId The currently selected source id, or `null`.
 * @param props.onSelect Called with a source id to trace its provenance.
 * @param props.onSave Called with a source to save it to the research session;
 * omitted hides the save affordance.
 * @param props.isSaved Whether a source id is already in the research session.
 * @returns The source index section.
 */
export function SourceIndexPanel({
  sources,
  total,
  isPending,
  error,
  selectedId,
  onSelect,
  onSave,
  isSaved,
}: {
  sources: readonly SourceSummary[]
  total: number
  isPending: boolean
  error: Error | null
  selectedId: string | null
  onSelect: (id: string) => void
  onSave?: (source: SourceSummary) => void
  isSaved?: (id: string) => boolean
}) {
  return (
    <section
      data-testid="source-index"
      aria-label="Canonical sources"
      className="rounded-xl border border-graph-border bg-graph-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Sources
        </h2>
        <span
          data-testid="source-index-count"
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {total} source{total === 1 ? '' : 's'}
        </span>
      </div>

      <p
        data-testid="source-index-scope"
        className="mt-1 text-xs text-graph-muted-foreground"
      >
        Canonical bibliography. A source attributed to a claim is a provenance
        lead, not verified evidence.
      </p>

      {isPending ? (
        <p
          data-testid="source-index-loading"
          className="mt-3 text-xs text-graph-muted-foreground"
        >
          Loading sources…
        </p>
      ) : error !== null ? (
        <p
          data-testid="source-index-error"
          className="mt-3 rounded-lg border border-graph-status-warn/40 bg-graph-status-warn/10 p-3 text-xs text-amber-700 dark:text-amber-300"
        >
          Could not load sources: {error.message}
        </p>
      ) : sources.length === 0 ? (
        <p
          data-testid="source-index-empty"
          className="mt-3 rounded-lg border border-dashed p-3 text-xs text-graph-muted-foreground"
        >
          No sources in the corpus yet.
        </p>
      ) : (
        <ul data-testid="source-index-list" className="mt-3 space-y-2">
          {sources.map((source) => {
            const selected = source.id === selectedId
            const saved = isSaved?.(source.id) ?? false
            const metadata = sourceMetadataLines(source)
            return (
              <li
                key={source.id}
                data-source-id={source.id}
                data-source-type={source.sourceType}
                data-selected={selected ? 'true' : 'false'}
                className={`rounded-lg border p-2 ${
                  selected
                    ? 'border-graph-accent bg-graph-muted'
                    : 'border-graph-border'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium">
                    {source.title}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {humanizeSourceType(source.sourceType)}
                  </span>
                </div>

                {metadata.length > 0 ? (
                  <dl
                    data-testid="source-index-metadata"
                    className="mt-1 space-y-0.5 text-[11px] text-graph-muted-foreground"
                  >
                    {metadata.map((line) => (
                      <div key={line.label} className="flex gap-1">
                        <dt className="font-medium">{line.label}</dt>
                        <dd className="min-w-0 truncate">{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p
                    data-testid="source-index-no-metadata"
                    className="mt-1 text-[11px] text-graph-muted-foreground"
                  >
                    No further metadata recorded.
                  </p>
                )}

                {source.url !== null ? (
                  <a
                    data-testid="source-index-url"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-1 block truncate text-[11px] text-graph-accent underline-offset-2 hover:underline"
                  >
                    {source.url}
                  </a>
                ) : null}

                <div
                  data-testid="source-index-attribution"
                  className="mt-1 text-[11px] text-graph-muted-foreground"
                >
                  {attributionSummary(source.claimSourceCount)}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="source-index-select"
                    data-source-id={source.id}
                    aria-pressed={selected}
                    onClick={() => onSelect(source.id)}
                    className="rounded border border-input px-2 py-1 text-xs hover:bg-muted"
                  >
                    Trace provenance
                  </button>
                  {onSave !== undefined && isSaved !== undefined ? (
                    <button
                      type="button"
                      data-testid="source-index-save"
                      data-source-id={source.id}
                      disabled={saved}
                      onClick={() => onSave(source)}
                      className="rounded border border-input px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saved ? 'In session' : 'Save to research'}
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
