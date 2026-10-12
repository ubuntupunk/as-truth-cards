-- 0015 — Enforce append-only discovery review events at the database boundary.
--
-- 0013 created `discovery_candidate_events` as the audit trail and 0013's comment claimed it
-- was append-only — but nothing in the database stopped an UPDATE or DELETE. "Append-only by
-- convention" is not a guarantee: any future code path, migration, or operator with write
-- access could rewrite history and leave no trace. This migration makes the guarantee real,
-- so the audit claim matches what the database actually enforces.
--
-- Two row-level triggers reject UPDATE and DELETE. They raise `restrict_violation`
-- (SQLSTATE 23001) with a message naming the table and operation, so a caller that tries gets a
-- clear error rather than a silent no-op.
--
-- THE MAINTENANCE ESCAPE HATCH
-- ----------------------------
-- Two legitimate operations mutate this table without being application mistakes:
--
--   1. `discovery_candidates(id) ON DELETE CASCADE` — deleting a candidate (for example a
--      mistaken ingest) deletes its history. That fires this trigger's DELETE arm.
--   2. `sources(id) ON DELETE SET NULL` — deleting a canonical source nulls `source_id` on the
--      events that reference it. That fires the UPDATE arm.
--
-- Both are foreign-key actions run by Postgres, and both are occasionally the right thing
-- (e.g. test cleanup, or removing a mistaken source). Rather than block them outright or
-- weaken the trigger, the trigger honours a per-transaction session setting:
--
--   SELECT set_config('trope_graph.allow_event_purge', 'on', true);
--
-- With the flag set, mutations proceed; without it (the default everywhere, including the
-- application), they are refused. The flag is deliberately a session-local GUC, so it cannot
-- be left on globally: it must be set inside the transaction that means to purge, and it
-- reverts at transaction end. The application never sets it.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
--   - It does not change who may read the events: reads are unaffected.
--   - It does not make the *candidate* row append-only. Only the event log is a history; the
--     candidate row is current state and is updated in place by review/promote (guarded by
--     `revision`, see 0014).
--   - It relies on the application not setting the escape hatch. That is the same trust
--     boundary as any application-level write; the trigger's job is to make accidental
--     mutation impossible and deliberate mutation explicit.

CREATE OR REPLACE FUNCTION trope_graph.discovery_candidate_events_no_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('trope_graph.allow_event_purge', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'trope_graph.discovery_candidate_events is append-only; % is denied (set trope_graph.allow_event_purge = ''on'' inside a transaction to purge deliberately)',
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

COMMENT ON FUNCTION trope_graph.discovery_candidate_events_no_mutation() IS
  'Rejects UPDATE/DELETE on discovery_candidate_events, making the audit trail append-only. Honours the transaction-local setting trope_graph.allow_event_purge=on as a deliberate maintenance escape hatch.';
