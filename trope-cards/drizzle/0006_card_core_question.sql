-- v0.6 gap fix: the Identity Retrospection addendum introduced a `coreQuestion` field on
-- card seeds, but no migration ever created the corresponding column. The data was
-- therefore unpersistable. Same class of omission as 0005_claim_interpretations.sql.
--
-- Added as a separate numbered migration rather than an edit to 0001 so that databases
-- which already applied 0001-0005 converge without being reset.

ALTER TABLE trope_graph.cards
  ADD COLUMN IF NOT EXISTS core_question TEXT;
