DO $$ BEGIN
  CREATE TYPE claim_relation_type AS ENUM (
    'SUPPORTS','CHALLENGES','QUALIFIES','CONTRADICTS','CONTEXTUALISES',
    'EXEMPLIFIES','REQUIRES','GENERALISES','EQUATES',
    'ANACHRONISTICALLY_MAPS','RETROSPECTIVELY_IDENTIFIES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inference_type AS ENUM (
    'DEDUCTIVE','INDUCTIVE','ABDUCTIVE','ANALOGICAL','HISTORICAL_CONTINUITY',
    'RETROSPECTIVE_IDENTITY','ANACHRONISTIC_MAPPING','GENERALISATION',
    'EQUIVALENCE','CAUSAL','NORMATIVE','UNSPECIFIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inference_premise_role AS ENUM (
    'PRIMARY','CONTEXT','BRIDGE','COUNTERPREMISE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS inference_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  inference_type inference_type NOT NULL DEFAULT 'UNSPECIFIED',
  epistemic_status text NOT NULL DEFAULT 'OPEN',
  notes text,
  is_canonical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inference_steps_card_idx ON inference_steps(card_id);

CREATE TABLE IF NOT EXISTS inference_premises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inference_step_id uuid NOT NULL REFERENCES inference_steps(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL,
  role inference_premise_role NOT NULL DEFAULT 'PRIMARY',
  ordinal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inference_premises_unique UNIQUE (inference_step_id, claim_id)
);
CREATE INDEX IF NOT EXISTS inference_premises_inference_idx ON inference_premises(inference_step_id);
CREATE INDEX IF NOT EXISTS inference_premises_claim_idx ON inference_premises(claim_id);

CREATE TABLE IF NOT EXISTS inference_conclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inference_step_id uuid NOT NULL REFERENCES inference_steps(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL,
  ordinal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inference_conclusions_unique UNIQUE (inference_step_id, claim_id)
);
CREATE INDEX IF NOT EXISTS inference_conclusions_inference_idx ON inference_conclusions(inference_step_id);
CREATE INDEX IF NOT EXISTS inference_conclusions_claim_idx ON inference_conclusions(claim_id);

CREATE TABLE IF NOT EXISTS claim_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_claim_id uuid NOT NULL,
  target_claim_id uuid NOT NULL,
  relation_type claim_relation_type NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_relations_unique UNIQUE (source_claim_id, target_claim_id, relation_type)
);
CREATE INDEX IF NOT EXISTS claim_relations_source_idx ON claim_relations(source_claim_id);
CREATE INDEX IF NOT EXISTS claim_relations_target_idx ON claim_relations(target_claim_id);
CREATE INDEX IF NOT EXISTS claim_relations_type_idx ON claim_relations(relation_type);

COMMENT ON TABLE inference_steps IS 'Explicit reasoning bridges connecting premise claims to conclusion claims.';
COMMENT ON TABLE inference_premises IS 'Claims used as premises in an inference step.';
COMMENT ON TABLE inference_conclusions IS 'Claims produced or supported by an inference step.';
COMMENT ON TABLE claim_relations IS 'Typed claim-to-claim relationships independent of inference steps.';
