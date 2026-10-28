/**
 * Research Metrics component — provider-neutral, renders gracefully with no data.
 *
 * Metrics are indicators of recorded attention/use, not measures of truth,
 * rigor, or evidentiary strength. Nothing here is treated as supporting evidence.
 */

import type { ComponentChildren } from 'preact'

export type ResearchMetric = {
  readonly key: string
  readonly label: string
  readonly value: string | number
  readonly definition: string
  readonly limitations?: string | null
  readonly provider?: string | null
  readonly sourceUrl?: string | null
}

export type ResearchMetricsProps = {
  readonly metrics: readonly ResearchMetric[]
  readonly isLoading?: boolean
  readonly error?: unknown
  readonly className?: string
}

/**
 * Renders research metrics with honest empty/loading/error states.
 */
export function ResearchMetrics({
  metrics,
  isLoading = false,
  error = null,
  className = '',
}: ResearchMetricsProps) {
  if (isLoading) {
    return (
      <section
        data-testid="research-metrics"
        className={`rounded-xl border border-graph-border bg-graph-surface p-4 ${className}`}
      >
        <h3 className="text-sm font-semibold text-foreground">
          Research metrics
        </h3>
        <p className="mt-2 text-xs text-graph-muted-foreground">
          Loading metrics…
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <section
        data-testid="research-metrics"
        className={`rounded-xl border border-graph-border bg-graph-surface p-4 ${className}`}
      >
        <h3 className="text-sm font-semibold text-foreground">
          Research metrics
        </h3>
        <p className="mt-2 text-xs text-graph-muted-foreground">
          Metrics unavailable.
        </p>
      </section>
    )
  }

  if (metrics.length === 0) {
    return (
      <section
        data-testid="research-metrics"
        className={`rounded-xl border border-graph-border bg-graph-surface p-4 ${className}`}
      >
        <h3 className="text-sm font-semibold text-foreground">
          Research metrics
        </h3>
        <p className="mt-2 text-xs text-graph-muted-foreground">
          No metrics available for this source. Metrics indicate recorded
          attention or use, not evidentiary strength.
        </p>
      </section>
    )
  }

  return (
    <section
      data-testid="research-metrics"
      className={`rounded-xl border border-graph-border bg-graph-surface p-4 ${className}`}
    >
      <h3 className="text-sm font-semibold text-foreground">
        Research metrics
      </h3>
      <p className="mt-1 text-xs text-graph-muted-foreground">
        Indicators of recorded attention or use — not measures of truth, rigor,
        or evidentiary strength.
      </p>
      <dl className="mt-3 space-y-2">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="flex items-start justify-between gap-4"
          >
            <dt className="text-xs text-graph-muted-foreground">
              {metric.label}
              <span className="sr-only">: {metric.definition}</span>
            </dt>
            <dd className="text-sm font-medium text-foreground">
              {metric.sourceUrl ? (
                <a
                  href={metric.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline-offset-2 hover:underline"
                  title={metric.definition}
                >
                  {metric.value}
                </a>
              ) : (
                <span title={metric.definition}>{metric.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
