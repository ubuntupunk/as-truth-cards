-- 0012 — Research-source layer: identity, discovery review queue, transparent metrics.
--
-- Adds the storage for issue #12's provider-neutral research-source system, and extends
-- `sources` with the provenance/verification metadata the issue asks a canonical
-- publication record to carry. It ships nothing that talks to a provider: no PlumX widget,
-- no Elsevier API, no live network code. The point is that the schema is useful with open
-- data and does not wait on the PlumX authorization gate.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
--   - It does not create a "publication" table. `sources` remains the canonical
--     bibliographic record; this migration only adds identity and observation *around* it.
--   - It does not touch `claim_sources` (attribution) or `evidence_claims` (support). A
--     discovered, cited, or popular work is not thereby evidence for any claim, and none of
--     the tables below is an edge in the support chain.
--   - It does not add a relationship vocabulary. The gap for "documents the
--     existence/circulation of a claim" and "discusses / relevant to" is left to a
--     semantics decision (tracked on issue #12); inventing enum members here would change
--     the ontology without that decision.
--
-- IDENTITY. `source_identifiers` is a child table rather than a column per scheme because
-- the set of schemes is open (DOI, PMID, PMCID, arXiv, ISBN, ISSN, SSRN, Scopus, …), and a
-- new provider must not force a schema migration. `unique (scheme, normalized_value)` is
-- the invariant: one persistent identifier resolves to exactly one source.
--
-- DISCOVERY. `discovery_candidates` is a human review queue, not a second source table.
-- `unique (provider, provider_record_id)` makes ingest idempotent; `promoted_source_id` is
-- the only path from a candidate to a canonical source, and it is set by a person.
--
-- METRICS. `source_metrics` stores attention/use as observations with a required
-- `definition`, optional `limitations`, an observation date, and an optional window. It is
-- a first-party, transparent model, deliberately not a PlumX clone. The
-- `unique (source_id, provider, metric_key, observed_at)` key makes re-importing a day's
-- snapshot an update rather than a duplicate.

CREATE TYPE trope_graph.discovery_review_status AS ENUM (
  'CANDIDATE',
  'APPROVED',
  'REJECTED',
  'DEFERRED'
);

-- Provenance/verification metadata on the canonical record. Nullable because the seeded
-- corpus predates any provider retrieval and must not be forced to invent one.
ALTER TABLE trope_graph.sources
  ADD COLUMN IF NOT EXISTS metadata_provider     text,
  ADD COLUMN IF NOT EXISTS metadata_retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata_verified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS access_status         text,
  ADD COLUMN IF NOT EXISTS correction_status     text;

CREATE TABLE IF NOT EXISTS trope_graph.source_identifiers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        uuid NOT NULL REFERENCES trope_graph.sources(id) ON DELETE CASCADE,
  scheme           text NOT NULL,
  value            text NOT NULL,
  normalized_value text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_identifiers_source_idx
  ON trope_graph.source_identifiers (source_id);

CREATE UNIQUE INDEX IF NOT EXISTS source_identifiers_scheme_value_unique_idx
  ON trope_graph.source_identifiers (scheme, normalized_value);

CREATE TABLE IF NOT EXISTS trope_graph.discovery_candidates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           text NOT NULL,
  provider_record_id text NOT NULL,
  title              text NOT NULL,
  authors            text,
  publication_date   date,
  source_type_hint   trope_graph.source_type,
  doi                text,
  url                text,
  identifiers        jsonb,
  provenance         jsonb NOT NULL,
  raw_payload        jsonb,
  query              text,
  retrieved_at       timestamptz NOT NULL DEFAULT now(),
  review_status      trope_graph.discovery_review_status NOT NULL DEFAULT 'CANDIDATE',
  reviewed_by        text,
  reviewed_at        timestamptz,
  review_notes       text,
  promoted_source_id uuid REFERENCES trope_graph.sources(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discovery_candidates_provider_record_unique_idx
  ON trope_graph.discovery_candidates (provider, provider_record_id);

CREATE INDEX IF NOT EXISTS discovery_candidates_review_status_idx
  ON trope_graph.discovery_candidates (review_status);

CREATE INDEX IF NOT EXISTS discovery_candidates_doi_idx
  ON trope_graph.discovery_candidates (doi);

CREATE TABLE IF NOT EXISTS trope_graph.source_metrics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    uuid NOT NULL REFERENCES trope_graph.sources(id) ON DELETE CASCADE,
  provider     text NOT NULL,
  metric_key   text NOT NULL,
  metric_value numeric NOT NULL,
  observed_at  date NOT NULL,
  window_start date,
  window_end   date,
  definition   text NOT NULL,
  limitations  text,
  source_url   text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_metrics_source_idx
  ON trope_graph.source_metrics (source_id);

CREATE UNIQUE INDEX IF NOT EXISTS source_metrics_observation_unique_idx
  ON trope_graph.source_metrics (source_id, provider, metric_key, observed_at);

COMMENT ON TABLE trope_graph.source_identifiers IS
  'Persistent identifiers (DOI, PMID, ISBN, …) for a canonical source. One identifier resolves to exactly one source via unique (scheme, normalized_value).';

COMMENT ON COLUMN trope_graph.source_identifiers.scheme IS
  'One of: DOI, PMID, PMCID, ARXIV, ISBN, ISSN, SSRN, SCOPUS, ACCESSION, URL, OTHER. Open text by design; the enforced rule is the scheme/value uniqueness.';

COMMENT ON TABLE trope_graph.discovery_candidates IS
  'A record proposed by an external metadata provider, held for human review. Not a source and not evidence. Promotion to a canonical source is the explicit promoted_source_id link.';

COMMENT ON TABLE trope_graph.source_metrics IS
  'Recorded attention/use observations for a source, each with a named provider and a required definition. Not a quality or truth signal and not a PlumX clone.';
