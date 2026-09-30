-- Restore the Axis dimension as a first-class relation.
--
-- The `axis` field was authored on all 47 seeded cards and read by nobody: the seeder
-- inserted `collection` and `mechanisms` and ignored `seed.axis`, so every axis
-- classification was discarded on every run. This is the same class of omission as
-- 0005_claim_interpretations.sql (a specified structure that no migration ever created)
-- and 0006_card_core_question.sql (an authored field with no column to hold it).
--
-- Added as a separate numbered migration rather than an edit to 0001 so that databases
-- which already applied 0001-0007 converge without being reset.
--
-- Why an enum column and not a taxonomy table like `mechanisms` / `collections`:
-- axis drives fixed-vocabulary presentation (one icon per value), so the set is closed.
-- An open `axes` table would let the vocabulary drift without a migration and would give
-- the labels a second home to be kept in sync with.
--
-- Four values, not the three in the original deck draft. HISTORICAL is authored on
-- `canaanite-card` (seed/identityRetrospection.ts) and describes a continuity argument;
-- dropping it to fit the original three would discard an editorial classification.

CREATE TYPE trope_graph.card_axis AS ENUM (
  'TACTIC',
  'FACT_REBUTTAL',
  'THEOLOGICAL',
  'HISTORICAL'
);

-- Ordered many-to-many, matching the inference_premises convention rather than the bare
-- (card_id, x_id) primary key used by card_collections / card_mechanisms. Ordinal 0 is
-- the card's primary axis, which is how a dominant axis is designated without inventing
-- one from the legacy primaryType.
--
-- Both unique indexes are required, and each covers a hole the other leaves.
-- (card_id, axis) alone permits two different axes at the same ordinal, so the primary axis
-- would be ambiguous. (card_id, ordinal) alone permits the same axis twice on one card at
-- different ordinals, so a duplicated classification would pass unnoticed.
CREATE TABLE trope_graph.card_axes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id   UUID NOT NULL REFERENCES trope_graph.cards(id) ON DELETE CASCADE,
  axis      trope_graph.card_axis NOT NULL,
  ordinal   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX card_axes_card_idx ON trope_graph.card_axes (card_id);

CREATE UNIQUE INDEX card_axes_card_axis_unique_idx
  ON trope_graph.card_axes (card_id, axis);

CREATE UNIQUE INDEX card_axes_card_ordinal_unique_idx
  ON trope_graph.card_axes (card_id, ordinal);
