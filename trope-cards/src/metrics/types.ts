/**
 * Provider-neutral metrics boundary for research sources.
 *
 * A MetricProvider fetches attention/use observations for a source given one of its
 * identifiers. Observations are stored in `source_metrics` with required definitions
 * and limitations; nothing here is treated as evidentiary support.
 */

export type MetricProviderErrorKind =
  | 'http'
  | 'timeout'
  | 'aborted'
  | 'malformed'

export class MetricProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: MetricProviderErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'MetricProviderError'
  }
}

export type MetricObservation = {
  readonly provider: string
  readonly metricKey: string
  readonly metricValue: string
  readonly observedAt: string
  readonly windowStart?: string | null
  readonly windowEnd?: string | null
  readonly definition: string
  readonly limitations?: string | null
  readonly sourceUrl?: string | null
}

export type MetricQuery = {
  readonly identifier: { scheme: string; value: string }
  readonly signal?: AbortSignal
}

export interface MetricProvider {
  readonly name: string
  fetch(query: MetricQuery): Promise<MetricObservation[]>
}
