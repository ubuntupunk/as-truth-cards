-- 0013 — Append-only discovery review/promotion events.
--
-- The `discovery_candidates` row holds only a candidate's *current* reviewer state:
-- `reviewed_by`, `reviewed_at`, `review_status`, and `promoted_source_id` are overwritten as
-- a reviewer acts. That is enough to filter the queue but is not a history. This migration
-- adds the history so an "explicit, audited" review/promotion claim is true: an append-only
-- event is written for every decision and every promotion, naming the actor, the action, the
-- decision, the source link (for a promotion), and when it happened.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
--   - It does not touch `discovery_candidates`, `sources`, `claim_sources`, or the evidence
--     layer. A promotion event is a record that a human linked a candidate to a canonical
--     source; it is still not support for any claim.
--   - It does not make the history mutable. Application code only inserts; the current-state
--     row is what a queue reads, and this table is what an audit reads.
--
-- The constraints make the two actions well-formed in the database itself: `action` is
-- limited to `REVIEWED`/`PROMOTED`, a review must name a decision, and a promotion must name
-- a source. A candidate's history is removed with the candidate (cascade); removing a source
-- nulls only the source link, leaving the event.

CREATE TABLE IF NOT EXISTS trope_graph.discovery_candidate_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES trope_graph.discovery_candidates(id) ON DELETE CASCADE,
  action       text NOT NULL,
  decision     text,
  actor_id     text NOT NULL,
  notes        text,
  source_id    uuid REFERENCES trope_graph.sources(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_candidate_events_action_check
    CHECK (action IN ('REVIEWED', 'PROMOTED')),
  CONSTRAINT discovery_candidate_events_reviewed_check
    CHECK (action <> 'REVIEWED' OR decision IS NOT NULL),
  CONSTRAINT discovery_candidate_events_promoted_check
    CHECK (action <> 'PROMOTED' OR source_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS discovery_candidate_events_candidate_idx
  ON trope_graph.discovery_candidate_events (candidate_id, created_at);

COMMENT ON TABLE trope_graph.discovery_candidate_events IS
  'Append-only review/promotion history for a discovery candidate: actor, action, decision, source link, timestamp. The candidate row is current state; this is the audit trail.';
