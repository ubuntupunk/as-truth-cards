-- 0017 — State the event-immutability guarantee precisely: DML-scoped, not a privilege boundary.
--
-- 0016 removed the settable custom-setting bypass and made the guard unconditional against
-- UPDATE/DELETE, with `ON DELETE RESTRICT` foreign keys. It described removal of an event as
-- requiring a "deliberate owner-level DDL operation", which reads as if that operation were
-- separately privileged from the application. In this deployment it is not: the migration
-- runner and the runtime resolve the *same* connection string (`resolveDatabaseUrl`), so one
-- role applies migrations, owns the `trope_graph` schema, and serves requests. A table owner
-- can always drop a trigger or a constraint, so the runtime credentials *can* remove history
-- through DDL even though they cannot through DML.
--
-- This migration keeps the DML guarantee but states its scope honestly, in the function the
-- database actually runs and in the catalog comments:
--
--   * immutable under all Data Manipulation Language, for every role including the owner:
--     every UPDATE and DELETE raises `restrict_violation` (SQLSTATE 23001);
--   * a candidate or source with history cannot be deleted by DML (FK RESTRICT);
--   * removal requires a table-owner DDL operation (disable/drop the trigger or the
--     constraints), which the current shared connection can issue — so this is an
--     application-integrity guard, not a privilege boundary against the runtime role.
--
-- Separating owner/migration credentials from a non-owner runtime role is tracked as follow-up
-- work; until then the guarantee is exactly DML-scoped.

CREATE OR REPLACE FUNCTION trope_graph.discovery_candidate_events_no_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'trope_graph.discovery_candidate_events is append-only under DML; % is denied. Removing an event requires a table-owner DDL operation, and the current runtime connection shares that owner role, so this guards application integrity rather than runtime privileges.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

COMMENT ON FUNCTION trope_graph.discovery_candidate_events_no_mutation() IS
  'Rejects every UPDATE/DELETE on discovery_candidate_events under all DML, for every role including the table owner. This is not a privilege boundary: a table owner can remove events with DDL (disable/drop the trigger). A future non-owner runtime role would be blocked under DML but still not defended against DDL.';

COMMENT ON TABLE trope_graph.discovery_candidate_events IS
  'Append-only review/promotion history for a discovery candidate: actor, action, decision, source link, timestamp. Immutable under all DML for every role, and FK ON DELETE RESTRICT refuses to delete a candidate or source that has history. Removal is a table-owner DDL operation, so this is an application-integrity guarantee, not a privilege boundary in the current shared-role deployment.';
