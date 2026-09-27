-- 0005 — claim_interpretations (backfill of a v0.3 gap).
--
-- WHY THIS MIGRATION EXISTS
-- -----------------------
-- v0.3 (versions/trope-graph-v0.3/docs/SCHEMA_REFINEMENT_V0.3.md) specified a
-- many-to-many table attaching interpretations to individual claims, and justified it
-- clearly: a card can hold several claims while only one of them is disputed, so
-- linking interpretations only to the card makes the graph too coarse.
--
--     CREATE TABLE claim_interpretations (
--         claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
--         interpretation_id UUID NOT NULL REFERENCES interpretations(id) ON DELETE CASCADE,
--         PRIMARY KEY (claim_id, interpretation_id)
--     );
--
-- That table was never written to any migration file. It is then treated as an
-- existing structure by v0.6 (IDENTITY_RETROJECTION_CLUSTER.md), v0.7
-- (CLAIM_DECOMPOSITION_ENGINE.md) and v0.8, all of which say competing interpretations
-- "belong in `interpretations` / `claim_interpretations`". So the documentation has
-- referenced a table that did not exist since v0.3.
--
-- The v0.4 CLAIM_EXTRACTION_PILOT.md evidence list also lists claim_interpretations as
-- a pilot input that was never modelled.
--
-- This migration creates it. The v0.3 specification is followed exactly, with the
-- columns qualified into the `trope_graph` schema and the column names aligned to the
-- project's camelCase-in-TypeScript / snake_case-in-SQL convention.
--
-- ORDERING NOTE: this is numbered 0005 rather than folded into 0001 because 0001-0004
-- are the consolidated, already-reviewed form of the archived v0.1/v0.7/v0.8/v0.9
-- migrations. Appending preserves that history and makes the gap explicit rather than
-- silently rewriting an earlier migration to imply the table had always been there.

CREATE TABLE IF NOT EXISTS trope_graph.claim_interpretations (
  claim_id uuid NOT NULL REFERENCES trope_graph.claims(id) ON DELETE CASCADE,
  interpretation_id uuid NOT NULL REFERENCES trope_graph.interpretations(id) ON DELETE CASCADE,
  PRIMARY KEY (claim_id, interpretation_id)
);

CREATE INDEX IF NOT EXISTS claim_interpretations_claim_idx ON trope_graph.claim_interpretations(claim_id);
CREATE INDEX IF NOT EXISTS claim_interpretations_interpretation_idx ON trope_graph.claim_interpretations(interpretation_id);

COMMENT ON TABLE trope_graph.claim_interpretations IS
  'Attaches an interpretation to a specific claim rather than only to its parent card. Specified in v0.3, absent from every migration until this one.';
