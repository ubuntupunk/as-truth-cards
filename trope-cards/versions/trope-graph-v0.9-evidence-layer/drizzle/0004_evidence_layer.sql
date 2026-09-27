CREATE TABLE evidence_items (
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

CREATE TABLE evidence_sources (
  evidence_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'DERIVED_FROM',
  PRIMARY KEY (evidence_id, source_id)
);

CREATE TABLE evidence_claims (
  evidence_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  relation text NOT NULL,
  strength text NOT NULL DEFAULT 'UNSPECIFIED',
  notes text,
  PRIMARY KEY (evidence_id, claim_id)
);

CREATE TABLE evidence_interpretations (
  evidence_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  interpretation_id uuid NOT NULL REFERENCES interpretations(id) ON DELETE CASCADE,
  relation text NOT NULL,
  PRIMARY KEY (evidence_id, interpretation_id)
);

CREATE TABLE evidence_inferences (
  evidence_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  inference_id uuid NOT NULL REFERENCES inference_steps(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'USED_BY',
  PRIMARY KEY (evidence_id, inference_id)
);
