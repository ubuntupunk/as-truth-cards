/**
 * Crossref as a discovery provider.
 *
 * Crossref's REST API (`https://api.crossref.org`) is the first open-metadata adapter
 * because it is the broadest openly licensed index of DOI-registered works and its usage
 * terms are explicit: identify your client, stay polite, and do not republish beyond the
 * licence. This adapter issues one bounded request per call, sends the contact address the
 * "polite pool" asks for, and normalizes the response into provider-neutral records.
 *
 * The adapter never touches the database. It returns records; the service and store decide
 * whether any of them become candidates, and a human decides whether a candidate becomes a
 * source. A malformed *item* is skipped so one bad record cannot fail a whole page; a
 * malformed *response* throws a {@link DiscoveryProviderError} so the caller records a
 * provider failure instead of an empty, misleading success.
 *
 * Scope: this is a deliberately **single-page** slice. One call issues exactly one `/works`
 * request with a bounded `rows` and no `offset`/cursor, so a call can never loop over a
 * large result set. Provider pagination is tracked as outstanding on issue #12, not done
 * here.
 *
 * Licensing note: Crossref metadata is made available under Crossref's terms. Retaining the
 * provider record verbatim is governed by those terms, and the retention/republication review
 * in `docs/issue-12-plumx-research-report.md` §5 is **not yet resolved** — so this adapter
 * offers no way to retain it at all. Only the normalized bibliographic fields and provenance
 * are returned. The `discovery_candidates.raw_payload` column stays reserved and unpopulated
 * until that review produces a recorded basis for retention; withholding `rawPayload` from the
 * port is what keeps a boolean from standing in for a reviewed decision.
 */

import { extractCrossrefIdentifiers, normalizeDoi } from '../identifiers'
import {
  type CandidateProvenance,
  type DiscoveredRecord,
  type DiscoveryProvider,
  DiscoveryProviderError,
  type DiscoverySearchInput,
  type SourceTypeValue,
} from '../types'

/** The provider key stored on every Crossref candidate. */
export const CROSSREF_PROVIDER = 'crossref'

/** Crossref rejects `rows` above this; the service clamps to it as a hard ceiling. */
export const CROSSREF_MAX_ROWS = 1000

/** A conservative default page size for an interactive discovery query. */
export const CROSSREF_DEFAULT_ROWS = 10

/**
 * The minimal `fetch` shape this adapter uses, declared structurally so tests can inject a
 * mocked fetch without importing the DOM lib and so the adapter does not depend on the
 * global `fetch` type being present in every compilation unit.
 */
export type FetchResponseLike = {
  readonly ok: boolean
  readonly status: number
  readonly statusText?: string
  json(): Promise<unknown>
}

/** A `fetch`-compatible function. Matches the global `fetch` and accepts a mock. */
export type FetchLike = (
  url: string,
  init: {
    readonly headers: Record<string, string>
    readonly signal: AbortSignal
  },
) => Promise<FetchResponseLike>

/** Crossref provider configuration. */
export type CrossrefProviderOptions = {
  /** Injected HTTP client. Defaults to the global `fetch`. */
  readonly fetch?: FetchLike
  /**
   * Contact address sent to Crossref's polite pool (as the `mailto` parameter and in the
   * `User-Agent`). Strongly recommended by Crossref; omit only if the deployment has none,
   * in which case requests still work but are not eligible for the polite pool.
   */
  readonly mailto?: string
  /** API base URL. Defaults to the public Crossref API. */
  readonly baseUrl?: string
  /** Per-request timeout in milliseconds. Defaults to 8000. */
  readonly timeoutMs?: number
  /**
   * Minimum spacing between requests, in milliseconds, enforced across calls so a burst of
   * discovery requests cannot hammer Crossref. Defaults to 1000; tests pass `0`.
   */
  readonly minIntervalMs?: number
  /** `User-Agent` product token. Defaults to `as-truth-cards/0.0`. */
  readonly userAgent?: string
}

/** The fields of one Crossref `message.items[]` element this adapter reads. */
type CrossrefItem = {
  readonly DOI?: unknown
  readonly URL?: unknown
  readonly title?: unknown
  readonly subtitle?: unknown
  readonly 'container-title'?: unknown
  readonly author?: unknown
  readonly issued?: unknown
  readonly type?: unknown
  readonly ISSN?: unknown
  readonly ISBN?: unknown
}

/**
 * Map a Crossref `type` onto the canonical `source_type` vocabulary, or `null` when the
 * mapping is not obvious. This is a *hint* only; it is not a classification and carries no
 * review weight.
 *
 * @param type The Crossref work type.
 * @returns A `source_type` hint, or `null`.
 */
export function crossrefSourceTypeHint(type: unknown): SourceTypeValue | null {
  if (typeof type !== 'string') return null
  switch (type) {
    case 'journal-article':
    case 'book-chapter':
    case 'proceedings-article':
    case 'posted-content':
    case 'dissertation':
      return 'ACADEMIC'
    case 'book':
    case 'monograph':
    case 'edited-book':
      return 'BOOK'
    case 'report':
    case 'report-component':
    case 'standard':
      return 'INSTITUTIONAL'
    case 'journal':
    case 'reference-entry':
    case 'component':
    case 'dataset':
    default:
      return null
  }
}

/** Read the first non-empty string from a value that Crossref may send as a string array. */
function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim().length > 0)
        return entry.trim()
    }
  }
  return null
}

/** Format a Crossref `date-parts` triple as `yyyy-mm-dd`, or `null` when it is incomplete. */
function formatIssuedDate(issued: unknown): string | null {
  if (typeof issued !== 'object' || issued === null) return null
  const parts = (issued as { 'date-parts'?: unknown })['date-parts']
  if (!Array.isArray(parts) || parts.length === 0) return null
  const first = parts[0]
  if (!Array.isArray(first)) return null
  const [year, month, day] = first
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null
  }
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${year}-${pad(month as number)}-${pad(day as number)}`
}

/** Render Crossref authors as a display string, or `null` when none are listed. */
function formatAuthors(author: unknown): string | null {
  if (!Array.isArray(author)) return null
  const names: string[] = []
  for (const entry of author) {
    if (typeof entry !== 'object' || entry === null) continue
    const person = entry as {
      given?: unknown
      family?: unknown
      name?: unknown
    }
    const family = typeof person.family === 'string' ? person.family.trim() : ''
    const given = typeof person.given === 'string' ? person.given.trim() : ''
    const literal = typeof person.name === 'string' ? person.name.trim() : ''
    const rendered = literal || [family, given].filter(Boolean).join(', ')
    if (rendered.length > 0) names.push(rendered)
  }
  return names.length > 0 ? names.join('; ') : null
}

/**
 * Map one Crossref item onto a discovery record.
 *
 * Only the normalized bibliographic fields and provenance are returned — never the item
 * verbatim, because the retention review (report §5) is unresolved.
 *
 * @param item A `message.items[]` element.
 * @param context The query and provenance shared by the batch.
 * @returns The record, or `null` when the item has no usable DOI (the only stable provider
 * record id Crossref offers).
 */
export function mapCrossrefItem(
  item: CrossrefItem,
  context: { readonly query: string; readonly provenance: CandidateProvenance },
): DiscoveredRecord | null {
  const rawDoi = typeof item.DOI === 'string' ? item.DOI : null
  const doi = rawDoi === null ? null : normalizeDoi(rawDoi)
  if (rawDoi === null) return null

  const identifiers = extractCrossrefIdentifiers(item)
  const title =
    firstString(item.title) ??
    firstString(item['container-title']) ??
    firstString(item.subtitle) ??
    rawDoi

  return {
    provider: CROSSREF_PROVIDER,
    providerRecordId: rawDoi.trim(),
    title,
    authors: formatAuthors(item.author),
    publicationDate: formatIssuedDate(item.issued),
    sourceTypeHint: crossrefSourceTypeHint(item.type),
    doi,
    url: typeof item.URL === 'string' ? item.URL : null,
    identifiers,
    provenance: context.provenance,
    query: context.query,
  }
}

/** Extract `message.items` from a Crossref payload, or `null` when the shape is wrong. */
function readItems(payload: unknown): CrossrefItem[] | null {
  if (typeof payload !== 'object' || payload === null) return null
  const message = (payload as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return null
  const items = (message as { items?: unknown }).items
  return Array.isArray(items) ? (items as CrossrefItem[]) : null
}

/** Read `message.total-results` when present, for provenance. */
function readTotalResults(payload: unknown): number | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const message = (payload as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return undefined
  const total = (message as { 'total-results'?: unknown })['total-results']
  return typeof total === 'number' ? total : undefined
}

/**
 * Build the Crossref discovery provider.
 *
 * @param options Optional injected fetch, contact address, and tuning knobs.
 * @returns A {@link DiscoveryProvider} for Crossref.
 */
export function createCrossrefProvider(
  options: CrossrefProviderOptions = {},
): DiscoveryProvider {
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike)
  const baseUrl = (options.baseUrl ?? 'https://api.crossref.org').replace(
    /\/+$/,
    '',
  )
  const timeoutMs = options.timeoutMs ?? 8000
  const minIntervalMs = options.minIntervalMs ?? 1000
  const userAgent = options.userAgent ?? 'as-truth-cards/0.0'
  const mailto = options.mailto?.trim() || null

  let nextAllowedAt = 0
  let gate: Promise<void> = Promise.resolve()

  const waitForSlot = async (): Promise<void> => {
    if (minIntervalMs <= 0) return
    const run = gate.then(async () => {
      const wait = nextAllowedAt - Date.now()
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait))
      }
      nextAllowedAt = Date.now() + minIntervalMs
    })
    gate = run.catch(() => undefined)
    await run
  }

  return {
    name: CROSSREF_PROVIDER,

    async search(input: DiscoverySearchInput): Promise<DiscoveredRecord[]> {
      const query = input.query.trim()
      if (query.length === 0) {
        throw new DiscoveryProviderError(
          CROSSREF_PROVIDER,
          'malformed',
          'a Crossref query must not be empty',
        )
      }
      const rows = Math.max(1, Math.min(input.limit, CROSSREF_MAX_ROWS))

      const params = new URLSearchParams({ query, rows: String(rows) })
      if (mailto) params.set('mailto', mailto)
      const url = `${baseUrl}/works?${params.toString()}`

      await waitForSlot()

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const onExternalAbort = (): void => controller.abort()
      input.signal?.addEventListener('abort', onExternalAbort, { once: true })

      const headers: Record<string, string> = { Accept: 'application/json' }
      headers['User-Agent'] = mailto
        ? `${userAgent} (mailto:${mailto})`
        : userAgent

      let response: FetchResponseLike
      try {
        response = await doFetch(url, { headers, signal: controller.signal })
      } catch (error) {
        if (controller.signal.aborted) {
          const kind = input.signal?.aborted ? 'aborted' : 'timeout'
          throw new DiscoveryProviderError(
            CROSSREF_PROVIDER,
            kind,
            kind === 'timeout'
              ? `Crossref request timed out after ${timeoutMs}ms`
              : 'Crossref request was aborted',
          )
        }
        const reason = error instanceof Error ? error.message : String(error)
        throw new DiscoveryProviderError(
          CROSSREF_PROVIDER,
          'http',
          `Crossref request failed: ${reason}`,
        )
      } finally {
        clearTimeout(timer)
        input.signal?.removeEventListener('abort', onExternalAbort)
      }

      if (!response.ok) {
        throw new DiscoveryProviderError(
          CROSSREF_PROVIDER,
          'http',
          `Crossref responded with HTTP ${response.status}`,
          response.status,
        )
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new DiscoveryProviderError(
          CROSSREF_PROVIDER,
          'malformed',
          'Crossref returned a body that is not valid JSON',
        )
      }

      const items = readItems(payload)
      if (items === null) {
        throw new DiscoveryProviderError(
          CROSSREF_PROVIDER,
          'malformed',
          'Crossref response did not contain message.items[]',
        )
      }

      const provenance: CandidateProvenance = {
        provider: CROSSREF_PROVIDER,
        endpoint: '/works',
        query,
        mailto,
        requestedAt: new Date().toISOString(),
        rowsRequested: rows,
        totalResults: readTotalResults(payload),
      }

      const records: DiscoveredRecord[] = []
      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const record = mapCrossrefItem(item, { query, provenance })
        if (record !== null) records.push(record)
      }
      return records
    },
  }
}
