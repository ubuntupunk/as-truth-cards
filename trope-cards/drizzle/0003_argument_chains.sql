-- 0003 — Argument Chain Engine.
--
-- Consolidated from the v0.8 archive (versions/trope-graph-v0.8-argument-chain-engine/drizzle/0003_argument_chains.sql).
--
-- Adds named argument paths through one or more inference steps, with typed
-- membership (MAIN/COUNTER/ALTERNATIVE/CONTEXT) and typed relationships between
-- reasoning steps.
--
-- FIXES APPLIED DURING CONSOLIDATION:
--   1. All objects qualified into the `trope_graph` schema.
--   2. Referential integrity restored — argument_chains.card_id had no REFERENCES
--      clause in the archived migration.
--   3. The archived migration added `inference_steps.argument_chain_id` as a bare
--      uuid column with no foreign key. The foreign key is now declared.
--      This is a self-referential link from inference_steps back to argument_chains,
--      added in the same migration that introduces argument_chains.
--   4. Uniqueness moved from named UNIQUE constraints to named UNIQUE INDEXes to
--      match src/db/schema/argumentChains.ts.

DO $$ BEGIN
  CREATE TYPE trope_graph.argument_chain_kind AS ENUM (
    'PRIMARY_ARGUMENT','COUNTERARGUMENT','ALTERNATIVE_INTERPRETATION','EDITORIAL_RECONSTRUCTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.inference_step_role AS ENUM ('MAIN','COUNTER','ALTERNATIVE','CONTEXT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.inference_step_relation_type AS ENUM (
    'CHALLENGES','QUALIFIES','ALTERNATIVE_TO','DEPENDS_ON','REFINES','CONTEXTUALISES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Argument chains -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS trope_graph.argument_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text NOT NULL,
  kind trope_graph.argument_chain_kind NOT NULL DEFAULT 'EDITORIAL_RECONSTRUCTION',
  epistemic_status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS argument_chains_card_idx ON trope_graph.argument_chains(card_id);

-- Attach inference steps to a chain -----------------------------------------

ALTER TABLE trope_graph.inference_steps
  ADD COLUMN IF NOT EXISTS argument_chain_id uuid
  REFERENCES trope_graph.argument_chains(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS inference_steps_argument_chain_idx ON trope_graph.inference_steps(argument_chain_id);

CREATE TABLE IF NOT EXISTS trope_graph.argument_chain_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  argument_chain_id uuid NOT NULL REFERENCES trope_graph.argument_chains(id) ON DELETE CASCADE,
  inference_step_id uuid NOT NULL REFERENCES trope_graph.inference_steps(id) ON DELETE CASCADE,
  role trope_graph.inference_step_role NOT NULL DEFAULT 'MAIN',
  ordinal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS argument_chain_steps_chain_idx ON trope_graph.argument_chain_steps(argument_chain_id);
CREATE INDEX IF NOT EXISTS argument_chain_steps_inference_idx ON trope_graph.argument_chain_steps(inference_step_id);
CREATE UNIQUE INDEX IF NOT EXISTS argument_chain_steps_unique_idx ON trope_graph.argument_chain_steps(argument_chain_id, inference_step_id);

-- Relationships between reasoning steps ------------------------------------

CREATE TABLE IF NOT EXISTS trope_graph.inference_step_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_inference_step_id uuid NOT NULL REFERENCES trope_graph.inference_steps(id) ON DELETE CASCADE,
  target_inference_step_id uuid NOT NULL REFERENCES trope_graph.inference_steps(id) ON DELETE CASCADE,
  relation_type trope_graph.inference_step_relation_type NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inference_step_relations_source_idx ON trope_graph.inference_step_relations(source_inference_step_id);
CREATE INDEX IF NOT EXISTS inference_step_relations_target_idx ON trope_graph.inference_step_relations(target_inference_step_id);
CREATE UNIQUE INDEX IF NOT EXISTS inference_step_relations_unique_idx ON trope_graph.inference_step_relations(source_inference_step_id, target_inference_step_id, relation_type);

COMMENT ON TABLE trope_graph.argument_chains IS 'Named argument or interpretation paths through one or more inference steps.';
COMMENT ON TABLE trope_graph.argument_chain_steps IS 'Ordered/typed membership of inference steps in an argument chain.';
COMMENT ON TABLE trope_graph.inference_step_relations IS 'Relationships between reasoning steps, including challenges and alternative interpretations.';
