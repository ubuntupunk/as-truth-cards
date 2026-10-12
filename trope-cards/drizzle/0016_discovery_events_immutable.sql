-- 0016 — Make the discovery event guard a real boundary, not a settable convention.
--
-- 0015 made `discovery_candidate_events` reject UPDATE/DELETE, but it allowed a bypass
-- controlled by the custom setting `trope_graph.allow_event_purge = 'on'`. In PostgreSQL a
-- placeholder custom setting can be set by *any* role, including the application role, via
-- `SET`/`set_config`. So that bypass was not a privilege boundary: the application could set
-- the flag itself and then rewrite history. "The application never sets it" is a code
-- convention, and a convention is not an enforced guarantee.
--
-- This migration removes the bypass entirely and makes immutability a property of ordinary
-- Data Manipulation Language:
--
--   1. The trigger no longer reads any setting. Every UPDATE and DELETE, from every role, is
--      refused with `restrict_violation` (SQLSTATE 23001). There is no SQL statement that
--      turns it off.
--   2. The two foreign keys no longer perform a mutating action as a side effect. A cascade
--      delete of a candidate's history and a set-null of a deleted source's event links were
--      the only FK actions that had to touch the table; both are now `ON DELETE RESTRICT`, so
--      the database refuses to delete a candidate or a source that has history rather than
--      silently deleting or blanking it.
--
-- The result: the audit trail is append-only under all DML, for all roles. The only way to
-- remove an event is an owner-level schema operation — disabling the trigger or dropping the
-- constraint via DDL — which is an explicit, deliberate, separately-privileged act, not a
-- statement any runtime role can issue. There is deliberately no flag, function, or role that
-- the application can invoke to purge, because a single shared connection has no way to
-- distinguish the application from an operator; the boundary is DML-versus-DDL.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
--   - It does not provide a runtime "purge" path. Removing a candidate or source that has
--     history requires a deliberate owner-level DDL operation, or a future archival/soft-delete
--     policy. Numbers already stored on the candidate row (its current state) are unaffected.
--   - It does not change reads, inserts, or the review/promotion write path. `review` and
--     `promote` only ever INSERT into this table.
--   - It does not change `discovery_candidates` itself: that row is current state, updated in
--     place under the `revision` token from 0014.

CREATE OR REPLACE FUNCTION trope_graph.discovery_candidate_events_no_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'trope_graph.discovery_candidate_events is append-only; % is denied (removal requires a deliberate owner-level DDL operation)',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS discovery_candidate_events_no_update
  ON trope_graph.discovery_candidate_events;
CREATE TRIGGER discovery_candidate_events_no_update
  BEFORE UPDATE ON trope_graph.discovery_candidate_events
  FOR EACH ROW
  EXECUTE FUNCTION trope_graph.discovery_candidate_events_no_mutation();

DROP TRIGGER IF EXISTS discovery_candidate_events_no_delete
  ON trope_graph.discovery_candidate_events;
CREATE TRIGGER discovery_candidate_events_no_delete
  BEFORE DELETE ON trope_graph.discovery_candidate_events
  FOR EACH ROW
  EXECUTE FUNCTION trope_graph.discovery_candidate_events_no_mutation();

-- A candidate with history cannot be deleted (the history would go with it), and a source
-- named by an event cannot be deleted (the event would have to be rewritten). Both are
-- refused outright instead of mutating the event table as a side effect.
ALTER TABLE trope_graph.discovery_candidate_events
  DROP CONSTRAINT IF EXISTS discovery_candidate_events_candidate_id_fkey,
  ADD CONSTRAINT discovery_candidate_events_candidate_id_fkey
    FOREIGN KEY (candidate_id)
    REFERENCES trope_graph.discovery_candidates(id)
    ON DELETE RESTRICT;

ALTER TABLE trope_graph.discovery_candidate_events
  DROP CONSTRAINT IF EXISTS discovery_candidate_events_source_id_fkey,
  ADD CONSTRAINT discovery_candidate_events_source_id_fkey
    FOREIGN KEY (source_id)
    REFERENCES trope_graph.sources(id)
    ON DELETE RESTRICT;

COMMENT ON FUNCTION trope_graph.discovery_candidate_events_no_mutation() IS
  'Rejects every UPDATE/DELETE on discovery_candidate_events for every role, making the audit trail append-only under all DML. There is no settable bypass; removal requires a deliberate owner-level DDL operation.';

COMMENT ON TABLE trope_graph.discovery_candidate_events IS
  'Append-only review/promotion history for a discovery candidate: actor, action, decision, source link, timestamp. The candidate row is current state; this is the audit trail. Immutable under all DML; a candidate or source with history cannot be deleted (FK ON DELETE RESTRICT).';
