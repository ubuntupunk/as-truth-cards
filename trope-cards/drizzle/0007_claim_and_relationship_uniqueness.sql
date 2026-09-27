-- Idempotency fix.
--
-- `claims` and `relationships` had no uniqueness constraint on their natural keys, so
-- re-running the seed silently duplicated every row:
--   claims        19 -> 38
--   relationships 11 -> 22
--
-- The duplication then propagated: `inference_premises` and `inference_conclusions` do
-- have unique indexes on (inference_step_id, claim_id), but because each run created NEW
-- claim ids, those constraints never fired and the premises doubled too (9 -> 18,
-- 4 -> 8). Fixing claims is what makes the rest of the chain correct.
--
-- These constraints also encode real invariants, not just seed conveniences:
--   - A card cannot carry the same claim statement twice.
--   - Two nodes cannot be joined by the same typed edge in the same editorial state.
--     `status` is part of the key, so a CANONICAL edge and a PROPOSED one may coexist,
--     which is the intended editorial workflow.

-- A card cannot have the same claim statement more than once.
CREATE UNIQUE INDEX IF NOT EXISTS claims_card_statement_unique_idx
  ON trope_graph.claims (card_id, statement);

-- Identical typed edges are duplicates. Including status lets a proposed edge and its
-- canonical replacement coexist instead of blocking the editorial transition.
CREATE UNIQUE INDEX IF NOT EXISTS relationships_edge_unique_idx
  ON trope_graph.relationships (
    from_entity_type,
    from_entity_id,
    relationship_type,
    to_entity_type,
    to_entity_id,
    status
  );
