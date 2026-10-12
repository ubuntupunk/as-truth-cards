/**
 * The provider-neutral port for research-source discovery.
 *
 * This module deliberately knows nothing about Crossref, DataCite, OpenAlex, or PlumX.
 * A provider adapter turns one external service into {@link DiscoveredRecord}s; the
 * service and store talk only to this port and the schema, so swapping or adding a
 * provider never touches the review workflow, the database, or the HTTP surface.
 *
 * Two boundaries are load-bearing and encoded here:
 *
 *   1. A discovered record is a **candidate**, never a source and never evidence. The port
 *      cannot return a `sources` row, and nothing in the ingest path writes one.
 *   2. Provenance is mandatory. A provider must say which provider it is, which endpoint
 *      and query produced the record, and when, so a reviewer can re-run the same query and
 *      reproduce the candidate.
 */

import type { sourceType } from '../db/schema/tropeGraph'
import type { NormalizedIdentifier } from './identifiers'

/** The `source_type` vocabulary, as used to hint how a candidate might map onto a source. */
export type SourceTypeValue = (typeof sourceType)['enumValues'][number]

/**
 * Why a provider could not answer.
 *
 * The `kind` is the contract callers switch on, so the HTTP layer can map transport
 * problems to a gateway error without string-matching a message, and so a future retry
 * policy can distinguish "retry" from "never retry".
 */
export type DiscoveryProviderErrorKind =
  | 'http'
  | 'timeout'
  | 'aborted'
  | 'malformed'

/** A provider failure, carrying the failure class and, when known, the HTTP status. */
export class DiscoveryProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: DiscoveryProviderErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'DiscoveryProviderError'
  }
}

/**
 * Where a record came from, recorded on every candidate.
 *
 * `requestedAt` is an ISO-8601 instant. `endpoint` is the provider's own path (not the full
 * URL, so a transient query string is not mistaken for part of the endpoint). Together these
 * make the candidate reproducible: the same endpoint + query + provider re-run is expected
 * to surface the same record.
 */
export type CandidateProvenance = {
  readonly provider: string
  readonly endpoint: string
  readonly query: string
  readonly mailto: string | null
  readonly requestedAt: string
  readonly rowsRequested: number
  readonly totalResults?: number
}

/**
 * One provider record, normalized to the fields the review queue stores.
 *
 * `identifiers` is the full normalized identifier set the provider supplied and is used for
 * reconciliation. `rawPayload` is optional and **off by default**: retaining a provider's
 * record verbatim is subject to that provider's licence, and while the retention/republication
 * review is unresolved the adapter must not persist it. A provider that has a *reviewed* reason
 * to retain the payload sets it explicitly; the store persists it only when present.
 */
export type DiscoveredRecord = {
  readonly provider: string
  readonly providerRecordId: string
  readonly title: string
  readonly authors: string | null
  readonly publicationDate: string | null
  readonly sourceTypeHint: SourceTypeValue | null
  readonly doi: string | null
  readonly url: string | null
  readonly identifiers: readonly NormalizedIdentifier[]
  readonly provenance: CandidateProvenance
  readonly rawPayload?: unknown
  readonly query: string
}

/** A provider search request. `limit` is already validated and clamped by the caller. */
export type DiscoverySearchInput = {
  readonly query: string
  readonly limit: number
  readonly signal?: AbortSignal
}

/**
 * One external metadata source, normalized to the discovery port.
 *
 * Implementations must:
 *   - issue exactly one bounded request per `search` call and respect the provider's rate
 *     limits and contact requirements;
 *   - normalize identifiers deterministically;
 *   - never write to the database and never promote a candidate;
 *   - skip an individual malformed item rather than aborting the whole batch, but throw a
 *     {@link DiscoveryProviderError} when the top-level response is unusable.
 */
export interface DiscoveryProvider {
  /** Stable lower-case provider key stored on every candidate (e.g. `crossref`). */
  readonly name: string
  /**
   * Search the provider.
   *
   * @param input The query, bounded limit, and optional cancellation signal.
   * @returns The normalized records, possibly empty, in provider order.
   * @throws {DiscoveryProviderError} On transport, HTTP, timeout, or top-level shape failure.
   */
  search(input: DiscoverySearchInput): Promise<DiscoveredRecord[]>
}
