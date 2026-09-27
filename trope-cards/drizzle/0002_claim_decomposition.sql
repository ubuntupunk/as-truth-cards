-- 0002 — Claim Decomposition Engine.
--
-- Consolidated from the v0.7 archive (versions/trope-graph-v0.7-claim-decomposition/drizzle/0002_claim_decomposition.sql).
--
-- Adds explicit reasoning structure: premises, conclusions, inference steps, and
-- typed claim-to-claim relations.
--
-- FIXES APPLIED DURING CONSOLIDATION:
--   1. All objects qualified into the `trope_graph` schema.
--   2. Referential integrity restored. The archived migration declared card_id and
--      claim_id as bare `uuid NOT NULL` with no REFERENCES clause, which allowed the
--      claim graph to be orphaned silently. Foreign keys are now declared.
--   3. Uniqueness moved from named UNIQUE constraints to named UNIQUE INDEXes so the
--      SQL matches the index names declared in src/db/schema/claimDecomposition.ts.
--      A UNIQUE constraint and a unique index are not equivalent to drizzle-kit's
--      introspection and produced spurious schema drift.
--
-- NOTE: `epistemic_status` here stays `text` rather than trope_graph.epistemic_status.
-- Inference status is deliberately independent of claim status (see
-- docs/CLAIM_DECOMPOSITION_ENGINE.md, "epistemic separation"), and is left as text so
-- the reasoning layer can evolve without an enum migration.

DO $$ BEGIN
  CREATE TYPE trope_graph.claim_relation_type AS ENUM (
    'SUPPORTS','CHALLENGES','QUALIFIES','CONTRADICTS','CONTEXTUALISES',
    'EXEMPLIFIES','REQUIRES','GENERALISES','EQUATES',
    'ANACHRONISTICALLY_MAPS','RETROSPECTIVELY_IDENTIFIES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.inference_type AS ENUM (
    'DEDUCTIVE','INDUCTIVE','ABDUCTIVE','ANALOGICAL','HISTORICAL_CONTINUITY',
    'RETROSPECTIVE_IDENTITY','ANACHRONISTIC_MAPPING','GENERALISATION',
    'EQUIVALENCE','CAUSAL','NORMATIVE','UNSPECIFIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.inference_premise_role AS ENUM (
    'PRIMARY','CONTEXT','BRIDGE','COUNTERPREMISE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Inference steps -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS trope_graph.inference_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text NOT NULL,
  inference_type trope_graph.inference_type NOT NULL DEFAULT 'UNSPECIFIED',
  epistemic_status text NOT NULL DEFAULT 'OPEN',
  notes text,
  is_canonical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inference_steps_card_idx ON trope_graph.inference_steps(card_id);

-- Premises ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trope_graph.inference_premises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inference_step_id uuid NOT NULL REFERENCES trope_graph.inference_steps(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES trope_graph.claims(id) ON DELETE CASCADE,
  role trope_graph.inference_premise_role NOT NULL DEFAULT 'PRIMARY',
  ordinal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inference_premises_inference_idx ON trope_graph.inference_premises(inference_step_id);
CREATE INDEX IF NOT EXISTS inference_premises_claim_idx ON trope_graph.inference_premises(claim_id);
CREATE UNIQUE INDEX IF NOT EXISTS inference_premises_unique_idx ON trope_graph.inference_premises(inference_step_id, claim_id);

-- Conclusions ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trope_graph.inference_conclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inference_step_id uuid NOT NULL REFERENCES trope_graph.inference_steps(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES trope_graph.claims(id) ON DELETE CASCADE,
  ordinal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inference_conclusions_inference_idx ON trope_graph.inference_conclusions(inference_step_id);
CREATE INDEX IF NOT EXISTS inference_conclusions_claim_idx ON trope_graph.inference_conclusions(claim_id);
CREATE UNIQUE INDEX IF NOT EXISTS inference_conclusions_unique_idx ON trope_graph.inference_conclusions(inference_step_id, claim_id);

-- Claim-to-claim relations --------------------------------------------------

CREATE TABLE IF NOT EXISTS trope_graph.claim_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_claim_id uuid NOT NULL REFERENCES trope_graph.claims(id) ON DELETE CASCADE,
  target_claim_id uuid NOT NULL REFERENCES trope_graph.claims(id) ON DELETE CASCADE,
  relation_type trope_graph.claim_relation_type NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_relations_source_idx ON trope_graph.claim_relations(source_claim_id);
CREATE INDEX IF NOT EXISTS claim_relations_target_idx ON trope_graph.claim_relations(target_claim_id);
CREATE INDEX IF NOT EXISTS claim_relations_type_idx ON trope_graph.claim_relations(relation_type);
CREATE UNIQUE INDEX IF NOT EXISTS claim_relations_unique_idx ON trope_graph.claim_relations(source_claim_id, target_claim_id, relation_type);

COMMENT ON TABLE trope_graph.inference_steps IS 'Explicit reasoning bridges connecting premise claims to conclusion claims.';
COMMENT ON TABLE trope_graph.inference_premises IS 'Claims used as premises in an inference step.';
COMMENT ON TABLE trope_graph.inference_conclusions IS 'Claims produced or supported by an inference step.';
COMMENT ON TABLE trope_graph.claim_relations IS 'Typed claim-to-claim relationships independent of inference steps.';
