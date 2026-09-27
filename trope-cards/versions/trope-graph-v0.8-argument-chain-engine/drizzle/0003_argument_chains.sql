DO $$ BEGIN
  CREATE TYPE argument_chain_kind AS ENUM (
    'PRIMARY_ARGUMENT','COUNTERARGUMENT','ALTERNATIVE_INTERPRETATION','EDITORIAL_RECONSTRUCTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inference_step_role AS ENUM ('MAIN','COUNTER','ALTERNATIVE','CONTEXT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inference_step_relation_type AS ENUM (
    'CHALLENGES','QUALIFIES','ALTERNATIVE_TO','DEPENDS_ON','REFINES','CONTEXTUALISES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS argument_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  kind argument_chain_kind NOT NULL DEFAULT 'EDITORIAL_RECONSTRUCTION',
  epistemic_status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS argument_chains_card_idx ON argument_chains(card_id);

ALTER TABLE inference_steps ADD COLUMN IF NOT EXISTS argument_chain_id uuid;
CREATE INDEX IF NOT EXISTS inference_steps_argument_chain_idx ON inference_steps(argument_chain_id);

CREATE TABLE IF NOT EXISTS argument_chain_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  argument_chain_id uuid NOT NULL REFERENCES argument_chains(id) ON DELETE CASCADE,
  inference_step_id uuid NOT NULL REFERENCES inference_steps(id) ON DELETE CASCADE,
  role inference_step_role NOT NULL DEFAULT 'MAIN',
  ordinal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT argument_chain_steps_unique UNIQUE (argument_chain_id, inference_step_id)
);
CREATE INDEX IF NOT EXISTS argument_chain_steps_chain_idx ON argument_chain_steps(argument_chain_id);
CREATE INDEX IF NOT EXISTS argument_chain_steps_inference_idx ON argument_chain_steps(inference_step_id);

CREATE TABLE IF NOT EXISTS inference_step_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_inference_step_id uuid NOT NULL REFERENCES inference_steps(id) ON DELETE CASCADE,
  target_inference_step_id uuid NOT NULL REFERENCES inference_steps(id) ON DELETE CASCADE,
  relation_type inference_step_relation_type NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inference_step_relations_unique UNIQUE (
    source_inference_step_id, target_inference_step_id, relation_type
  )
);
CREATE INDEX IF NOT EXISTS inference_step_relations_source_idx ON inference_step_relations(source_inference_step_id);
CREATE INDEX IF NOT EXISTS inference_step_relations_target_idx ON inference_step_relations(target_inference_step_id);

COMMENT ON TABLE argument_chains IS 'Named argument or interpretation paths through one or more inference steps.';
COMMENT ON TABLE argument_chain_steps IS 'Ordered/typed membership of inference steps in an argument chain.';
COMMENT ON TABLE inference_step_relations IS 'Relationships between reasoning steps, including challenges and alternative interpretations.';
