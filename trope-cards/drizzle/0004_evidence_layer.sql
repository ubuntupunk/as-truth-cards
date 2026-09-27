-- 0004 — Evidence Layer.
--
-- Consolidated from the v0.9 archive (versions/trope-graph-v0.9-evidence-layer/drizzle/0004_evidence_layer.sql).
--
-- Inserts an evidence layer between source and claim:
--   Source → Evidence → Claim → Inference → Conclusion
--
-- A source is a bibliographic object. An evidence item is a located, inspectable
-- portion or observation derived from that source (see docs/EVIDENCE_LAYER.md).
--
-- FIXES APPLIED DURING CONSOLIDATION:
--   1. All objects qualified into the `trope_graph` schema.
--   2. Referential integrity restored. evidence_claims.claim_id,
--      evidence_interpretations.interpretation_id and evidence_inferences.inference_id
--      had no REFERENCES clauses in the archived migration.
--   3. CREATE TABLE IF NOT EXISTS added for idempotency, matching the style of 0002/0003.
--
-- VOCABULARY: `type`, `relation` and `strength` are left as `text` to match
-- src/db/schema/evidenceLayer.ts exactly, which keeps drizzle-kit introspection free of
-- drift. The permitted values are documented in COMMENTs below and in
-- docs/EVIDENCE_LAYER.md. Tightening these to enums is tracked as follow-up work.
--
-- EPISTEMIC SEPARATION: `evidence_items.evidence_status` describes the evidence item.
-- It is NOT the same field as `claims.epistemic_status` and must never overwrite it.
-- Likewise `inference_steps.epistemic_status` describes the reasoning step. These three
-- statuses are deliberately independent and are never collapsed into one.

CREATE TABLE IF NOT EXISTS trope_graph.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  locator text,
  locator_type text,
  evidence_status text NOT NULL DEFAULT 'PRIMARY',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trope_graph.evidence_sources (
  evidence_id uuid NOT NULL REFERENCES trope_graph.evidence_items(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES trope_graph.sources(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'DERIVED_FROM',
  PRIMARY KEY (evidence_id, source_id)
);

CREATE TABLE IF NOT EXISTS trope_graph.evidence_claims (
  evidence_id uuid NOT NULL REFERENCES trope_graph.evidence_items(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES trope_graph.claims(id) ON DELETE CASCADE,
  relation text NOT NULL,
  strength text NOT NULL DEFAULT 'UNSPECIFIED',
  notes text,
  PRIMARY KEY (evidence_id, claim_id)
);

CREATE TABLE IF NOT EXISTS trope_graph.evidence_interpretations (
  evidence_id uuid NOT NULL REFERENCES trope_graph.evidence_items(id) ON DELETE CASCADE,
  interpretation_id uuid NOT NULL REFERENCES trope_graph.interpretations(id) ON DELETE CASCADE,
  relation text NOT NULL,
  PRIMARY KEY (evidence_id, interpretation_id)
);

CREATE TABLE IF NOT EXISTS trope_graph.evidence_inferences (
  evidence_id uuid NOT NULL REFERENCES trope_graph.evidence_items(id) ON DELETE CASCADE,
  inference_id uuid NOT NULL REFERENCES trope_graph.inference_steps(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'USED_BY',
  PRIMARY KEY (evidence_id, inference_id)
);

CREATE INDEX IF NOT EXISTS evidence_items_type_idx ON trope_graph.evidence_items(type);
CREATE INDEX IF NOT EXISTS evidence_items_status_idx ON trope_graph.evidence_items(evidence_status);
CREATE INDEX IF NOT EXISTS evidence_claims_claim_idx ON trope_graph.evidence_claims(claim_id);
CREATE INDEX IF NOT EXISTS evidence_inferences_inference_idx ON trope_graph.evidence_inferences(inference_id);

COMMENT ON TABLE trope_graph.evidence_items IS
  'A located, inspectable portion or observation derived from a source. Not a source, and not a truth verdict.';
COMMENT ON COLUMN trope_graph.evidence_items.type IS
  'One of: QUOTATION, PARAPHRASE, DATA_POINT, DOCUMENT_FEATURE, IMAGE_FEATURE, TESTIMONY, SECONDARY_ASSESSMENT.';
COMMENT ON COLUMN trope_graph.evidence_items.locator IS
  'Where the material sits: page, paragraph, section, chapter, verse, timestamp, figure, table, URL fragment, archive identifier.';
COMMENT ON COLUMN trope_graph.evidence_items.evidence_status IS
  'Status of the evidence item itself. Never overwrites claims.epistemic_status.';
COMMENT ON COLUMN trope_graph.evidence_claims.relation IS
  'Evidential relation asserted by the editor. One of: SUPPORTS, CHALLENGES, QUALIFIES, CONTEXTUALISES, ILLUSTRATES, REPORTS, ATTRIBUTES. Describes the asserted relation only; does not by itself determine claim truth.';
