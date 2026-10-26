/**
 * DataCite as a discovery provider.
 *
 * DataCite is the DOI registration agency for research data, software, and other outputs that a
 * journal-centric index under-covers, so it complements the Crossref adapter rather than
 * duplicating it: a search that matters to this corpus can surface a dataset or a report here
 * that Crossref would not return. This adapter reads DataCite's **Public API** for retrieving
 * metadata (`https://api.datacite.org`, no authentication) and follows DataCite's own usage
 * guidance — send a `User-Agent` that names the client and carries a contact address, and stay
 * polite. DataCite releases its metadata under CC0; the current terms still get confirmed in the
 * licence review (report §5), and this adapter returns only normalized fields anyway (see the
 * retention note below).
 *
 * The port boundary is the same as Crossref's and is load-bearing:
 *
 *   1. A discovered record is a **candidate**, never a source and never evidence. Nothing in this
 *      adapter writes to the database or promotes anything.
 *   2. Provenance is mandatory. Every record carries the provider, endpoint, query, and retrieval
 *      time, so a reviewer can re-run the same query and reproduce the candidate.
 *
 * A malformed *item* is skipped so one bad record cannot fail a whole page; a malformed *response*
 * throws a {@link DiscoveryProviderError} so the caller records a provider failure instead of a
 * misleading empty success. An item with no DOI is skipped: DataCite's DOI is its only stable
 * provider record id, and `(provider, provider_record_id)` is what makes ingest idempotent.
 *
 * Scope: this is a deliberately **single-page** slice. One call issues exactly one `/dois`
 * request with a bounded `page[size]` and no `page[number]`/cursor, so a call can never loop over
 * a large result set. Provider pagination is tracked as outstanding on issue #12, not done here.
 *
 * Retention: no `rawPayload` is returned. Retaining a provider record verbatim is governed by the
 * licence and the retention/republication review in `docs/issue-12-plumx-research-report.md` §5,
 * which is **not yet resolved** — so the adapter offers no way to retain the payload at all, and
 * `discovery_candidates.raw_payload` stays reserved and unpopulated. Withholding it from the port
 * is what keeps a boolean from standing in for a reviewed decision.
 *
 * State is passed through, not filtered: DataCite reports a DOI's `state`
 * (`findable`/`registered`/`draft`) and `isActive`, but choosing to ignore a withdrawn or draft
 * record is an *editorial* decision about what a candidate is, and the review workflow — not this
 * mapping — is where that decision belongs. The adapter maps what the provider returns.
 */

import { extractDataciteIdentifiers, normalizeDoi } from '../identifiers'
import {
  type CandidateProvenance,
  type DiscoveredRecord,
  type DiscoveryProvider,
  DiscoveryProviderError,
  type DiscoverySearchInput,
  type SourceTypeValue,
} from '../types'
import { createJsonClient, type FetchLike } from './http'

/** The provider key stored on every DataCite candidate. */
export const DATACITE_PROVIDER = 'datacite'

/**
 * Defensive ceiling on `page[size]`.
 *
 * The service clamps every request to `DISCOVERY_LIMIT_MAX` (100) long before this bound matters,
 * so this exists only so a caller that bypasses the service cannot ask one call for an unbounded
 * page.
 */
export const DATACITE_MAX_ROWS = 1000

/** DataCite provider configuration. */
export type DataciteProviderOptions = {
  /** Injected HTTP client. Defaults to the global `fetch`. */
  readonly fetch?: FetchLike
  /**
   * Contact address advertised in the `User-Agent`, which DataCite asks integrators to supply.
   * Omit only if the deployment has none, in which case requests still work but the client is not
   * identifiable.
   */
  readonly mailto?: string
  /** API base URL. Defaults to the public DataCite API. */
  readonly baseUrl?: string
  /** Per-request timeout in milliseconds. Defaults to 8000. */
  readonly timeoutMs?: number
  /**
   * Minimum spacing between requests, in milliseconds, enforced across calls so a burst of
   * discovery requests cannot hammer DataCite. Defaults to 1000; tests pass `0`.
   */
  readonly minIntervalMs?: number
  /** `User-Agent` product token. Defaults to `as-truth-cards/0.0`. */
  readonly userAgent?: string
}

/**
 * Read a DataCite item's `attributes` as a plain object, or `null` when it is absent or the wrong
 * shape.
 *
 * A `data[]` element stays a `Record<string, unknown>` rather than a closed type, for the same
 * reason the Crossref adapter does: a JSON:API item carries fields (`type`, `relationships`) this
 * adapter deliberately ignores, so the type says "we read `id` and `attributes`, nothing else"
 * without pretending the provider sends only those.
 */
function readAttributes(
  item: Record<string, unknown>,
): Record<string, unknown> | null {
  return typeof item.attributes === 'object' && item.attributes !== null
    ? (item.attributes as Record<string, unknown>)
    : null
}

/**
 * Map a DataCite `resourceTypeGeneral` onto the canonical `source_type` vocabulary, or `null`.
 *
 * This is a *hint* only — not a classification, and it carries no review weight. Matching is
 * case-insensitive so a casing variant still maps. Types that are not an obvious source type in
 * this corpus (Dataset, Software, Image, Audiovisual, Event, …) are left `null` rather than forced
 * into a member, mirroring the Crossref adapter: an honest gap beats a wrong label.
 *
 * @param resourceTypeGeneral The DataCite `types.resourceTypeGeneral` value.
 * @returns A `source_type` hint, or `null`.
 */
export function dataciteSourceTypeHint(
  resourceTypeGeneral: unknown,
): SourceTypeValue | null {
  if (typeof resourceTypeGeneral !== 'string') return null
  return DATACITE_TYPE_HINTS[resourceTypeGeneral.trim().toLowerCase()] ?? null
}

/** The DataCite `resourceTypeGeneral` vocabulary this adapter can hint, keyed lower-case. */
const DATACITE_TYPE_HINTS: Record<string, SourceTypeValue> = {
  journalarticle: 'ACADEMIC',
  conferencepaper: 'ACADEMIC',
  conferenceproceeding: 'ACADEMIC',
  datapaper: 'ACADEMIC',
  dissertation: 'ACADEMIC',
  preprint: 'ACADEMIC',
  peerreview: 'ACADEMIC',
  studyregistration: 'ACADEMIC',
  journal: 'ACADEMIC',
  text: 'ACADEMIC',
  book: 'BOOK',
  bookchapter: 'BOOK',
  report: 'INSTITUTIONAL',
  standard: 'INSTITUTIONAL',
  outputmanagementplan: 'INSTITUTIONAL',
  service: 'INSTITUTIONAL',
}

/**
 * Read `types.resourceTypeGeneral`, the value {@link dataciteSourceTypeHint} maps.
 *
 * @param attributes The record's `attributes` object, or `null`.
 * @returns The raw value, or `null` when `types` is absent or the wrong shape.
 */
function readResourceTypeGeneral(
  attributes: Record<string, unknown> | null,
): unknown {
  if (attributes === null) return null
  const types = attributes.types
  if (typeof types !== 'object' || types === null) return null
  return (types as { resourceTypeGeneral?: unknown }).resourceTypeGeneral
}

/**
 * Read the bibliographic title from a DataCite record.
 *
 * Prefers the first `titles[].title`, then the `container.title` (which names the venue a
 * book chapter or article sits in), and returns `null` when neither is usable.
 *
 * @param attributes The record's `attributes` object, or `null`.
 * @returns The title, or `null`.
 */
function readTitle(attributes: Record<string, unknown> | null): string | null {
  if (attributes === null) return null

  const titles = attributes.titles
  if (Array.isArray(titles)) {
    for (const entry of titles) {
      if (typeof entry !== 'object' || entry === null) continue
      const title = (entry as { title?: unknown }).title
      if (typeof title === 'string' && title.trim().length > 0) {
        return title.trim()
      }
    }
  }

  const container = attributes.container
  if (typeof container === 'object' && container !== null) {
    const title = (container as { title?: unknown }).title
    if (typeof title === 'string' && title.trim().length > 0)
      return title.trim()
  }

  return null
}

/**
 * Render DataCite creators as a display string, or `null` when none are listed.
 *
 * Prefers each creator's `name` (DataCite's already-formatted printed form, e.g. `Doe, Jane`) and
 * falls back to composing `familyName, givenName` when `name` is absent.
 *
 * @param creators The `attributes.creators` value.
 * @returns A `; `-joined display string, or `null`.
 */
function formatCreators(creators: unknown): string | null {
  if (!Array.isArray(creators)) return null
  const names: string[] = []
  for (const entry of creators) {
    if (typeof entry !== 'object' || entry === null) continue
    const person = entry as {
      name?: unknown
      familyName?: unknown
      givenName?: unknown
    }
    const literal = typeof person.name === 'string' ? person.name.trim() : ''
    const family =
      typeof person.familyName === 'string' ? person.familyName.trim() : ''
    const given =
      typeof person.givenName === 'string' ? person.givenName.trim() : ''
    const rendered = literal || [family, given].filter(Boolean).join(', ')
    if (rendered.length > 0) names.push(rendered)
  }
  return names.length > 0 ? names.join('; ') : null
}

/**
 * Read the full issued date from a DataCite `dates[]` list, or `null`.
 *
 * `discovery_candidates.publication_date` is a SQL `date`, so only a complete calendar date is
 * storable. A `publicationYear`, or a `YYYY`/`YYYY-MM` issued date, is therefore left `null`
 * rather than padded out: inventing a month and day would fabricate precision the provider never
 * asserted. A date outside the calendar is rejected too, because one bad value would otherwise
 * fail the whole ingest batch.
 *
 * @param dates The `attributes.dates` value.
 * @returns A `YYYY-MM-DD` date, or `null`.
 */
function issuedDate(dates: unknown): string | null {
  if (!Array.isArray(dates)) return null
  for (const entry of dates) {
    if (typeof entry !== 'object' || entry === null) continue
    const dateType = (entry as { dateType?: unknown }).dateType
    const date = (entry as { date?: unknown }).date
    if (typeof dateType !== 'string' || typeof date !== 'string') continue
    if (dateType.trim().toLowerCase() !== 'issued') continue

    const value = date.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) continue
    const parsed = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(parsed.getTime())) continue
    if (parsed.toISOString().slice(0, 10) === value) return value
  }
  return null
}

/**
 * Map one DataCite item onto a discovery record.
 *
 * Only the normalized bibliographic fields and provenance are returned — never the item verbatim,
 * because the retention review (report §5) is unresolved.
 *
 * @param item A `data[]` element.
 * @param context The query and provenance shared by the batch.
 * @returns The record, or `null` when the item has no DOI (DataCite's only stable record id).
 */
export function mapDataciteItem(
  item: Record<string, unknown>,
  context: { readonly query: string; readonly provenance: CandidateProvenance },
): DiscoveredRecord | null {
  const attributes = readAttributes(item)

  const rawDoi =
    attributes !== null && typeof attributes.doi === 'string'
      ? attributes.doi
      : typeof item.id === 'string'
        ? item.id
        : null
  if (rawDoi === null) return null

  return {
    provider: DATACITE_PROVIDER,
    providerRecordId: rawDoi.trim(),
    title: readTitle(attributes) ?? rawDoi.trim(),
    authors: formatCreators(attributes?.creators),
    publicationDate: issuedDate(attributes?.dates),
    sourceTypeHint: dataciteSourceTypeHint(readResourceTypeGeneral(attributes)),
    doi: normalizeDoi(rawDoi),
    url:
      attributes !== null && typeof attributes.url === 'string'
        ? attributes.url
        : null,
    identifiers:
      attributes === null ? [] : extractDataciteIdentifiers(attributes),
    provenance: context.provenance,
    query: context.query,
  }
}

/** Extract `data` from a DataCite payload, or `null` when the shape is wrong. */
function readItems(payload: unknown): Record<string, unknown>[] | null {
  if (typeof payload !== 'object' || payload === null) return null
  const data = (payload as { data?: unknown }).data
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : null
}

/** Read `meta.total` when present, for provenance. */
function readTotalResults(payload: unknown): number | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const meta = (payload as { meta?: unknown }).meta
  if (typeof meta !== 'object' || meta === null) return undefined
  const total = (meta as { total?: unknown }).total
  return typeof total === 'number' ? total : undefined
}

/**
 * Build the DataCite discovery provider.
 *
 * @param options Optional injected fetch, contact address, and tuning knobs.
 * @returns A {@link DiscoveryProvider} for DataCite.
 */
export function createDataciteProvider(
  options: DataciteProviderOptions = {},
): DiscoveryProvider {
  const baseUrl = (options.baseUrl ?? 'https://api.datacite.org').replace(
    /\/+$/,
    '',
  )
  const mailto = options.mailto?.trim() || null
  const client = createJsonClient({
    fetch: options.fetch,
    timeoutMs: options.timeoutMs,
    minIntervalMs: options.minIntervalMs,
    userAgent: options.userAgent,
    mailto,
  })

  return {
    name: DATACITE_PROVIDER,

    async search(input: DiscoverySearchInput): Promise<DiscoveredRecord[]> {
      const query = input.query.trim()
      if (query.length === 0) {
        throw new DiscoveryProviderError(
          DATACITE_PROVIDER,
          'malformed',
          'a DataCite query must not be empty',
        )
      }
      const rows = Math.max(1, Math.min(input.limit, DATACITE_MAX_ROWS))

      const params = new URLSearchParams({
        query,
        'page[size]': String(rows),
      })
      const url = `${baseUrl}/dois?${params.toString()}`

      const payload = await client.get(url, {
        provider: DATACITE_PROVIDER,
        label: 'DataCite',
        signal: input.signal,
      })

      const items = readItems(payload)
      if (items === null) {
        throw new DiscoveryProviderError(
          DATACITE_PROVIDER,
          'malformed',
          'DataCite response did not contain data[]',
        )
      }

      const provenance: CandidateProvenance = {
        provider: DATACITE_PROVIDER,
        endpoint: '/dois',
        query,
        mailto,
        requestedAt: new Date().toISOString(),
        rowsRequested: rows,
        totalResults: readTotalResults(payload),
      }

      const records: DiscoveredRecord[] = []
      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const record = mapDataciteItem(item, { query, provenance })
        if (record !== null) records.push(record)
      }
      return records
    },
  }
}
