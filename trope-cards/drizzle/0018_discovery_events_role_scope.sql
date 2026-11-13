-- 0018 — Event-immutability wording after the owner/runtime split (bd as-truth-cards-nnc).
--
-- 0017 stated the guarantee as DML-scoped and said the deployment shared one role between the
-- migration runner and the runtime, so "a table owner can remove events" applied to the
-- application's own credentials. That is no longer the only supported deployment: the runtime
-- can now connect as a **non-owner** login role that has DML only, while migrations keep an
-- owner URL (`TROPE_GRAPH_MIGRATION_URL` / `DATABASE_MIGRATION_URL`). See
-- `trope-cards/src/db/runtime-role.ts` for the live check and `docs/issue-12-plumx-research-report.md`
-- §3 for the report.
--
-- The enforcement itself does not change — the trigger still rejects every UPDATE/DELETE and
-- the foreign keys still RESTRICT — but the description has to stop asserting one deployment.
-- The honest statement depends on the role the process connected as:
--
--   * always: immutable under all DML for every role, including the table owner;
--   * when the runtime is a non-owner role with no TRIGGER/CREATE privilege (the provisioned
--     configuration): also a privilege boundary — the application cannot disable the trigger
--     or drop the table;
--   * when runtime and owner share a role (local development, or an unprovisioned deploy):
--     DML-scoped only, and `trope-graph:verify-runtime-role` reports it as a violation.

CREATE OR REPLACE FUNCTION trope_graph.discovery_candidate_events_no_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'trope_graph.discovery_candidate_events is append-only under DML; % is denied. Removing an event requires a table-owner DDL operation. If this role is the table owner (see trope-graph:verify-runtime-role), the append-only guard is an application-integrity guarantee only; connecting the application as a non-owner runtime role makes it a privilege boundary.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

COMMENT ON FUNCTION trope_graph.discovery_candidate_events_no_mutation() IS
  'Rejects every UPDATE/DELETE on discovery_candidate_events under all DML, for every role including the table owner. Whether that is also a privilege boundary depends on the runtime role: a non-owner role cannot disable the trigger or drop the table; the owner can. `pnpm run trope-graph:verify-runtime-role` checks which configuration is live.';

COMMENT ON TABLE trope_graph.discovery_candidate_events IS
  'Append-only review/promotion history for a discovery candidate: actor, action, decision, source link, timestamp. Immutable under all DML for every role, and FK ON DELETE RESTRICT refuses to delete a candidate or source that has history. A non-owner runtime role additionally lacks UPDATE/DELETE/TRIGGER privileges, making removal a privilege boundary; under a shared owner/runtime role it remains an application-integrity guarantee only.';
