-- 0001 — Initial Trope Graph.
--
-- Consolidated from the v0.1 archive (versions/trope-graph/drizzle/0001_initial_trope_graph.sql).
--
-- NAMESPACE: every object is created inside the `trope_graph` PostgreSQL schema.
-- This is deliberate. The host application already owns a `cards` table in `public`
-- via Prisma (integer PK, deck presentation cards, FK from user_interactions). The
-- Trope Graph `cards` table is a different entity — a research card keyed by uuid and
-- slug — so the two are kept in separate schemas rather than merged.

CREATE SCHEMA IF NOT EXISTS trope_graph;

-- Enums ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE trope_graph.card_type AS ENUM ('TACTIC','FACT','THEOLOGY','CASE','REFERENCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.epistemic_status AS ENUM ('ESTABLISHED','CONTESTED','OPEN','CONTEXT_DEPENDENT','UNSUPPORTED','LIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.claim_type AS ENUM ('DESCRIPTIVE','HISTORICAL','EMPIRICAL','LEGAL','THEOLOGICAL','INTERPRETIVE','RHETORICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.source_type AS ENUM ('PRIMARY_DOCUMENT','JUDGMENT','PLEADING','LEGISLATION','INSTITUTIONAL','ACADEMIC','BOOK','JOURNALISM','ARCHIVE','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.case_status AS ENUM ('HISTORICAL','ACTIVE','RESOLVED','APPEAL_PENDING','UPDATE_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.question_status AS ENUM ('OPEN','ANSWERED','PARTIALLY_ANSWERED','SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.contribution_status AS ENUM ('PENDING','ACCEPTED','REJECTED','SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.contribution_type AS ENUM ('SOURCE','CASE','QUESTION','RELATIONSHIP','CORRECTION','INTERPRETATION','NOTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.research_event_type AS ENUM ('CARD_VIEWED','CLAIM_OPENED','SOURCE_OPENED','CASE_OPENED','QUESTION_VIEWED','BRANCH_FOLLOWED','SOURCE_SUBMITTED','CASE_SUBMITTED','QUESTION_SUBMITTED','RELATIONSHIP_PROPOSED','CORRECTION_SUBMITTED','NOTE_ADDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.relationship_type AS ENUM ('PREDECESSOR','RELATED','SIMILAR_MECHANISM','SUPPORTS','CHALLENGES','COMPETING_INTERPRETATION','CONTEXTUALISES','EXAMPLE_OF','DERIVED_FROM','CONTRADICTS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trope_graph.relationship_status AS ENUM ('CANONICAL','PROPOSED','REJECTED','SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cards ---------------------------------------------------------------------

CREATE TABLE trope_graph.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  primary_type trope_graph.card_type NOT NULL,
  epistemic_status trope_graph.epistemic_status NOT NULL,
  trigger text,
  mechanism_summary text,
  counter_test text,
  editorial_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

-- Collections ---------------------------------------------------------------

CREATE TABLE trope_graph.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text
);

CREATE TABLE trope_graph.card_collections (
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES trope_graph.collections(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, collection_id)
);

-- Mechanisms ----------------------------------------------------------------

CREATE TABLE trope_graph.mechanisms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text
);

CREATE TABLE trope_graph.card_mechanisms (
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  mechanism_id uuid NOT NULL REFERENCES trope_graph.mechanisms(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, mechanism_id)
);

-- Claims and sources --------------------------------------------------------

CREATE TABLE trope_graph.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  statement text NOT NULL,
  claim_type trope_graph.claim_type NOT NULL,
  description text,
  epistemic_status trope_graph.epistemic_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claims_card_idx ON trope_graph.claims(card_id);

CREATE TABLE trope_graph.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  publisher text,
  publication_date date,
  source_type trope_graph.source_type NOT NULL,
  url text,
  archive_url text,
  citation text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Section 17 of docs/TROPE_GRAPH_SCHEMA.md requires search across source title and author.
CREATE INDEX sources_title_idx ON trope_graph.sources(title);

CREATE TABLE trope_graph.claim_sources (
  claim_id uuid NOT NULL REFERENCES trope_graph.claims(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES trope_graph.sources(id) ON DELETE CASCADE,
  relationship text NOT NULL,
  quote_or_excerpt text,
  page_reference text,
  notes text,
  PRIMARY KEY (claim_id, source_id)
);

-- Cases ---------------------------------------------------------------------

CREATE TABLE trope_graph.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date_start date,
  date_end date,
  location text,
  description text,
  status trope_graph.case_status NOT NULL
);
CREATE INDEX cases_title_idx ON trope_graph.cases(title);

CREATE TABLE trope_graph.case_legal_metadata (
  case_id uuid PRIMARY KEY REFERENCES trope_graph.cases(id) ON DELETE CASCADE,
  court text,
  case_number text,
  judgment_date date,
  procedural_posture text,
  current_status text
);

CREATE TABLE trope_graph.card_cases (
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES trope_graph.cases(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, case_id)
);

-- Concepts ------------------------------------------------------------------

CREATE TABLE trope_graph.concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  definition text
);

CREATE TABLE trope_graph.card_concepts (
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES trope_graph.concepts(id) ON DELETE CASCADE,
  relationship text,
  PRIMARY KEY (card_id, concept_id)
);

-- Interpretations -----------------------------------------------------------

CREATE TABLE trope_graph.interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  status trope_graph.epistemic_status NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trope_graph.interpretation_sources (
  interpretation_id uuid NOT NULL REFERENCES trope_graph.interpretations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES trope_graph.sources(id) ON DELETE CASCADE,
  relationship text,
  notes text,
  PRIMARY KEY (interpretation_id, source_id)
);

-- Questions -----------------------------------------------------------------

CREATE TABLE trope_graph.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  description text,
  status trope_graph.question_status NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trope_graph.question_cards (
  question_id uuid NOT NULL REFERENCES trope_graph.questions(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, card_id)
);

CREATE TABLE trope_graph.question_claims (
  question_id uuid NOT NULL REFERENCES trope_graph.questions(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES trope_graph.claims(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, claim_id)
);

CREATE TABLE trope_graph.question_sources (
  question_id uuid NOT NULL REFERENCES trope_graph.questions(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES trope_graph.sources(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, source_id)
);

-- Typed graph edges ---------------------------------------------------------

CREATE TABLE trope_graph.relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_type text NOT NULL,
  from_entity_id uuid NOT NULL,
  relationship_type trope_graph.relationship_type NOT NULL,
  to_entity_type text NOT NULL,
  to_entity_id uuid NOT NULL,
  description text,
  status trope_graph.relationship_status NOT NULL DEFAULT 'CANONICAL',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX relationships_from_idx ON trope_graph.relationships(from_entity_type, from_entity_id);
CREATE INDEX relationships_to_idx ON trope_graph.relationships(to_entity_type, to_entity_id);

-- Research trail and contributions -----------------------------------------

CREATE TABLE trope_graph.research_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type trope_graph.research_event_type NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_events_user_created_idx ON trope_graph.research_events(user_id, created_at);

CREATE TABLE trope_graph.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  entity_type text,
  entity_id uuid,
  contribution_type trope_graph.contribution_type NOT NULL,
  content jsonb NOT NULL,
  status trope_graph.contribution_status NOT NULL DEFAULT 'PENDING',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contributions_status_idx ON trope_graph.contributions(status);

-- Versioning ----------------------------------------------------------------

CREATE TABLE trope_graph.card_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content jsonb NOT NULL,
  changed_by text,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id, version_number)
);

COMMENT ON SCHEMA trope_graph IS
  'Trope Graph research schema. Separate from public, which is owned by the Prisma deck application.';
COMMENT ON TABLE trope_graph.cards IS
  'Research card. An editorial entry point, not the atomic unit of truth. Distinct from public.cards.';
