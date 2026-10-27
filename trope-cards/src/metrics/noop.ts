import type { MetricObservation, MetricProvider, MetricQuery } from './types.js'

/**
 * No-op metrics provider. Used as default until a real provider is enabled
 * and authorized. Always returns empty observations with no side effects.
 */
export function createNoopMetricProvider(): MetricProvider {
  return {
    name: 'noop',
    async fetch(_query: MetricQuery): Promise<MetricObservation[]> {
      return []
    },
  }
}
