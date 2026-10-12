-- 0014 — Optimistic-concurrency token for the discovery review queue.
--
-- `review` and `promote` are conditional single-statement UPDATEs. Before this migration the
-- only condition was "the candidate exists and is not already promoted", so two reviews of
-- the same unpromoted candidate could both match, both succeed, and have the later one
-- silently replace the earlier — the audit trail would then show only the survivor's decision
-- even though two humans acted. A promotion racing a review had the same shape.
--
-- `revision` closes that gap. Every review and promotion increments it, and both operations
-- require the caller to present the revision it read:
--
--   UPDATE ... SET revision = revision + 1
--    WHERE id = $1 AND revision = $2 AND promoted_source_id IS NULL
--
-- Only one concurrent writer can match a given revision; the others match nothing and are
-- refused as `stale` (or `already_promoted`). This is deliberate, not incidental: it makes
-- competing decisions mutually exclusive while still allowing an intentional later re-review,
-- which simply reads the new revision and acts on it.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
--   - It does not touch `sources`, `claim_sources`, or the evidence layer. The token governs
--     only the review queue's own state machine.
--   - It does not change re-discovery: the ingest conflict update deliberately omits
--     `revision`, so refreshing provider fields never invalidates a reviewer's token.
--   - It does not backfill anything meaningful: existing rows start at 0, the same value a
--     reviewer reads before acting.

ALTER TABLE trope_graph.discovery_candidates
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN trope_graph.discovery_candidates.revision IS
  'Optimistic-concurrency token for the review queue. Incremented by every review/promotion; callers must present the revision they read so a stale decision is refused, not applied.';
