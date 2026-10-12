import {
  date,
  index,
  jsonb,
  numeric,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { tropeGraph } from './namespace'
import { sources, sourceType } from './tropeGraph'

/**
 * The research-source layer: how a canonical `sources` row is identified, how a
 * candidate from an external metadata provider is held for review before it becomes one,
 * and what recorded attention a source has attracted.
 *
 * This layer exists to keep three things apart that a "publication tracking" feature
 * tends to collapse:
 *
 *   1. **Identity** — a source is identified by persistent identifiers (DOI and
 *      friends), stored in {@link sourceIdentifiers}, so two records for one work can be
 *      reconciled without trusting a title string. `sources` itself remains the
 *      bibliographic record; identifiers are a child table because the set of schemes is
 *      open-ended and a new scheme must not require a column per provider.
 *   2. **Discovery** — {@link discoveryCandidates} is a *review queue*, not a second
 *      source table. A provider (Crossref, DataCite, OpenAlex, OpenCitations, …) can
 *      propose a record; a human decides whether it becomes a curated `sources` row.
 *      Nothing here is evidence, and nothing here is a citation of a claim.
 *   3. **Metrics** — {@link sourceMetrics} records attention/use as *observations with
 *      provenance*, never as rigor or truth. Every row states what it measures, where it
 *      came from, over what window, and what it cannot tell you.
 *
 * None of these tables is a PlumX integration. PlumX is one optional provider behind an
 * authorization gate; the schema is provider-neutral on purpose so the system is useful
 * with open data whether or not that gate ever opens.
 */

/**
 * Where a {@link discoveryCandidates} row sits in the human review workflow.
 *
 * `CANDIDATE` is the only automatically-assigned state. `APPROVED` does not itself create
 * a `sources` row — promotion is a separate, explicit link recorded in
 * `promoted_source_id` — so "approved" and "canonical" stay distinguishable.
 */
export const discoveryReviewStatus = tropeGraph.enum(
  'discovery_review_status',
  ['CANDIDATE', 'APPROVED', 'REJECTED', 'DEFERRED'],
)

/**
 * A persistent identifier attached to a canonical source.
 *
 * `scheme` is deliberately `text`, not an enum. The set of identifier schemes is open —
 * DOI, PMID, PMCID, arXiv, ISBN, ISSN, SSRN, Scopus, a repository accession number, a
 * canonical URL — and closing it would mean a migration every time a provider is added.
 * The permitted starting vocabulary is documented on the column; the value that is
 * actually enforced is the uniqueness rule below.
 *
 * `unique (scheme, normalized_value)` is the point of the table: one identifier resolves
 * to exactly one source, so a discovery candidate carrying a known DOI can be recognized
 * as already-canonical instead of being re-added under a different title. `normalized_value`
 * holds the scheme's normalization (lower-cased, trimmed, and for DOIs the bare `10.…`
 * form) and is what lookups and the uniqueness rule use; `value` keeps the identifier as
 * the source printed it, for display and for audit.
 */
export const sourceIdentifiers = tropeGraph.table(
  'source_identifiers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    /** One of: DOI, PMID, PMCID, ARXIV, ISBN, ISSN, SSRN, SCOPUS, ACCESSION, URL, OTHER. */
    scheme: text('scheme').notNull(),
    /** The identifier as printed by the source. */
    value: text('value').notNull(),
    /** Scheme-normalized form used for lookup and the uniqueness rule. */
    normalizedValue: text('normalized_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('source_identifiers_source_idx').on(table.sourceId),
    unique('source_identifiers_scheme_value_unique_idx').on(
      table.scheme,
      table.normalizedValue,
    ),
  ],
)

/**
 * A record proposed by an external metadata provider, held until a human reviews it.
 *
 * This is a queue, not a source. It exists so discovery is *reviewable*: every row keeps
 * the provider that produced it, the provider's own record id, the query that found it, and
 * when it was retrieved, so a later reviewer can re-run the same query and get the same
 * candidate. `raw_payload` retains the provider record as received; it is subject to that
 * provider's licence and must not be republished beyond what the licence allows.
 *
 * `unique (provider, provider_record_id)` makes ingest idempotent — re-running a discovery
 * query cannot duplicate a candidate — and is the second half of the duplicate-reconciliation
 * story begun by {@link sourceIdentifiers}. `source_type_hint` is only a guess at how the
 * candidate would map onto the `source_type` vocabulary; it is not a classification and
 * carries no review weight.
 *
 * A candidate becomes canonical only when `promoted_source_id` points at a `sources` row
 * that a human created or matched. Nothing about being discovered, cited, or popular makes
 * a candidate evidence for any claim: promotion is a curation act, and the support chain
 * still runs through `claim_sources` / `evidence_claims`, never through this table.
 */
export const discoveryCandidates = tropeGraph.table(
  'discovery_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Provider that returned the record, e.g. `crossref`, `datacite`, `openalex`. */
    provider: text('provider').notNull(),
    /** The provider's own stable identifier for the record. */
    providerRecordId: text('provider_record_id').notNull(),
    title: text('title').notNull(),
    authors: text('authors'),
    publicationDate: date('publication_date'),
    /** A guess at the candidate's `source_type`; not a classification. */
    sourceTypeHint: sourceType('source_type_hint'),
    doi: text('doi'),
    url: text('url'),
    /** All persistent identifiers the provider supplied, for reconciliation. */
    identifiers: jsonb('identifiers'),
    /** Provider, endpoint, and request metadata; never null, so provenance is always present. */
    provenance: jsonb('provenance').notNull(),
    /** The provider record as received. Retained under the provider's licence terms. */
    rawPayload: jsonb('raw_payload'),
    /** The query that surfaced this candidate, for reproducibility. */
    query: text('query'),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewStatus: discoveryReviewStatus('review_status')
      .notNull()
      .default('CANDIDATE'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),
    /** Set only when a human promotes this candidate onto a canonical source. */
    promotedSourceId: uuid('promoted_source_id').references(() => sources.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('discovery_candidates_provider_record_unique_idx').on(
      table.provider,
      table.providerRecordId,
    ),
    index('discovery_candidates_review_status_idx').on(table.reviewStatus),
    index('discovery_candidates_doi_idx').on(table.doi),
  ],
)

/**
 * A recorded observation about a source's attention or use.
 *
 * This is a **first-party, transparent** metrics model, not a PlumX clone and not a
 * popularity score. Each row is one value from one named provider, and it carries the
 * fields that make the number interpretable rather than impressive:
 *
 *   - `provider` — where the number came from (e.g. `opencitations`).
 *   - `metricKey` — what it is (e.g. `citation_count`), a stable key, not a label.
 *   - `observedAt` — the date the observation applies to; part of the uniqueness key so
 *     re-importing the same day's snapshot updates rather than duplicates.
 *   - `windowStart` / `windowEnd` — the window the value covers, when it is windowed.
 *   - `definition` — what the metric means, required, so no bare number is stored.
 *   - `limitations` — coverage gaps, bias, or "cannot be compared across fields".
 *   - `sourceUrl` — a permalink back to the provider record.
 *   - `retrievedAt` — when we fetched it.
 *
 * A citation count is a count of citing works, not a verdict on the cited work, and a
 * download is a download. Nothing in this table may be read as evidentiary support for a
 * claim; see `docs/EVIDENCE_LAYER.md` and SPEC §8.
 */
export const sourceMetrics = tropeGraph.table(
  'source_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    metricKey: text('metric_key').notNull(),
    metricValue: numeric('metric_value').notNull(),
    /** The date the observation applies to. Part of the uniqueness key. */
    observedAt: date('observed_at').notNull(),
    windowStart: date('window_start'),
    windowEnd: date('window_end'),
    /** What the metric means. Required — a value without a definition is not stored. */
    definition: text('definition').notNull(),
    /** Coverage gaps and caveats. */
    limitations: text('limitations'),
    sourceUrl: text('source_url'),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('source_metrics_source_idx').on(table.sourceId),
    unique('source_metrics_observation_unique_idx').on(
      table.sourceId,
      table.provider,
      table.metricKey,
      table.observedAt,
    ),
  ],
)
