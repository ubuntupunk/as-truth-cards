-- Initial Trope Graph migration.
-- Generated from the first architecture pass; review against the project's existing Drizzle migration conventions before applying.

CREATE TYPE card_type AS ENUM ('TACTIC','FACT','THEOLOGY','CASE','REFERENCE');
CREATE TYPE epistemic_status AS ENUM ('ESTABLISHED','CONTESTED','OPEN','CONTEXT_DEPENDENT','UNSUPPORTED','LIVE');
CREATE TYPE claim_type AS ENUM ('DESCRIPTIVE','HISTORICAL','EMPIRICAL','LEGAL','THEOLOGICAL','INTERPRETIVE','RHETORICAL');
CREATE TYPE source_type AS ENUM ('PRIMARY_DOCUMENT','JUDGMENT','PLEADING','LEGISLATION','INSTITUTIONAL','ACADEMIC','BOOK','JOURNALISM','ARCHIVE','OTHER');
CREATE TYPE case_status AS ENUM ('HISTORICAL','ACTIVE','RESOLVED','APPEAL_PENDING','UPDATE_REQUIRED');
CREATE TYPE question_status AS ENUM ('OPEN','ANSWERED','PARTIALLY_ANSWERED','SUPERSEDED');
CREATE TYPE contribution_status AS ENUM ('PENDING','ACCEPTED','REJECTED','SUPERSEDED');
CREATE TYPE contribution_type AS ENUM ('SOURCE','CASE','QUESTION','RELATIONSHIP','CORRECTION','INTERPRETATION','NOTE');
CREATE TYPE research_event_type AS ENUM ('CARD_VIEWED','CLAIM_OPENED','SOURCE_OPENED','CASE_OPENED','QUESTION_VIEWED','BRANCH_FOLLOWED','SOURCE_SUBMITTED','CASE_SUBMITTED','QUESTION_SUBMITTED','RELATIONSHIP_PROPOSED','CORRECTION_SUBMITTED','NOTE_ADDED');
CREATE TYPE relationship_type AS ENUM ('PREDECESSOR','RELATED','SIMILAR_MECHANISM','SUPPORTS','CHALLENGES','COMPETING_INTERPRETATION','CONTEXTUALISES','EXAMPLE_OF','DERIVED_FROM','CONTRADICTS');
CREATE TYPE relationship_status AS ENUM ('CANONICAL','PROPOSED','REJECTED','SUPERSEDED');

CREATE TABLE cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  primary_type card_type NOT NULL,
  epistemic_status epistemic_status NOT NULL,
  trigger text,
  mechanism_summary text,
  counter_test text,
  editorial_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text
);

CREATE TABLE card_collections (
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, collection_id)
);

CREATE TABLE mechanisms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text
);

CREATE TABLE card_mechanisms (
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  mechanism_id uuid NOT NULL REFERENCES mechanisms(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, mechanism_id)
);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  statement text NOT NULL,
  claim_type claim_type NOT NULL,
  description text,
  epistemic_status epistemic_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claims_card_idx ON claims(card_id);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  publisher text,
  publication_date date,
  source_type source_type NOT NULL,
  url text,
  archive_url text,
  citation text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claim_sources (
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relationship text NOT NULL,
  quote_or_excerpt text,
  page_reference text,
  notes text,
  PRIMARY KEY (claim_id, source_id)
);

CREATE TABLE cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date_start date,
  date_end date,
  location text,
  description text,
  status case_status NOT NULL
);
CREATE INDEX cases_title_idx ON cases(title);

CREATE TABLE case_legal_metadata (
  case_id uuid PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  court text,
  case_number text,
  judgment_date date,
  procedural_posture text,
  current_status text
);

CREATE TABLE card_cases (
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, case_id)
);

CREATE TABLE concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  definition text
);

CREATE TABLE card_concepts (
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  relationship text,
  PRIMARY KEY (card_id, concept_id)
);

CREATE TABLE interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  status epistemic_status NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interpretation_sources (
  interpretation_id uuid NOT NULL REFERENCES interpretations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relationship text,
  notes text,
  PRIMARY KEY (interpretation_id, source_id)
);

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  description text,
  status question_status NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE question_cards (
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, card_id)
);

CREATE TABLE question_claims (
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, claim_id)
);

CREATE TABLE question_sources (
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, source_id)
);

CREATE TABLE relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_type text NOT NULL,
  from_entity_id uuid NOT NULL,
  relationship_type relationship_type NOT NULL,
  to_entity_type text NOT NULL,
  to_entity_id uuid NOT NULL,
  description text,
  status relationship_status NOT NULL DEFAULT 'CANONICAL',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX relationships_from_idx ON relationships(from_entity_type, from_entity_id);
CREATE INDEX relationships_to_idx ON relationships(to_entity_type, to_entity_id);

CREATE TABLE research_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type research_event_type NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_events_user_created_idx ON research_events(user_id, created_at);

CREATE TABLE contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  entity_type text,
  entity_id uuid,
  contribution_type contribution_type NOT NULL,
  content jsonb NOT NULL,
  status contribution_status NOT NULL DEFAULT 'PENDING',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contributions_status_idx ON contributions(status);

CREATE TABLE card_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content jsonb NOT NULL,
  changed_by text,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id, version_number)
);
