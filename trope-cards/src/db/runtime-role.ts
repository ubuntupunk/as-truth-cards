import type { Client } from 'pg'

/**
 * Anything with a `query` method — a `pg` `Client` or `Pool`, so the startup check can use
 * the shared pool without opening an extra connection.
 */
export type Queryable = Pick<Client, 'query'>

/**
 * Live privilege inspection for the **runtime** database role.
 *
 * Migration `0017` narrowed the discovery event-log guarantee to "immutable under all DML
 * for every role", because the migration runner and the runtime shared one connection
 * string, so the runtime role owned the schema and could always
 * `ALTER TABLE … DISABLE TRIGGER`. bd `as-truth-cards-nnc` landed the other half: a
 * non-owner runtime role and an owner-only migration URL. This module is how that split is
 * *verified* rather than assumed.
 *
 * The checks are deliberately about the role that actually connected, not about which
 * environment variables are set. A deployment that sets a "migration URL" but leaves
 * `DATABASE_URL` pointing at the owner still has no boundary, and this reports it.
 */

/** The live privileges of the connection used by the running application. */
export type RuntimeRoleBoundary = {
  /** `current_user` of the runtime connection. */
  role: string
  /** Role is a superuser, so every privilege check below is meaningless. */
  superuser: boolean
  /** Role owns the `trope_graph` schema. */
  schemaOwner: boolean
  /** Role is a member of the role that owns `trope_graph` (it can `SET ROLE` to owner). */
  memberOfSchemaOwner: boolean
  /** Role owns `trope_graph.discovery_candidate_events`. */
  eventTableOwner: boolean
  /** Role may create objects in `trope_graph` (that is DDL). */
  canCreateInSchema: boolean
  /** Role may create/drop triggers on the event table. */
  canTriggerEventTable: boolean
  /** Role may `UPDATE` event rows. */
  canUpdateEvents: boolean
  /** Role may `DELETE` event rows. */
  canDeleteEvents: boolean
  /** Role may `TRUNCATE` the event log. */
  canTruncateEvents: boolean
  /** Role may append to the event log — required. */
  canInsertEvents: boolean
  /** Role may read the candidate review queue — required. */
  canSelectCandidates: boolean
}

/** One way the runtime connection is more powerful than it should be. */
export type PrivilegeFinding = {
  /** Stable identifier, for tests and log scraping. */
  code: string
  /** Human-readable explanation including the remediation. */
  message: string
}

/**
 * Read the runtime connection's privileges from `pg_catalog`.
 *
 * Every privilege query is guarded by `to_regclass`, so a database that has not been
 * migrated yet reports `false` instead of throwing. `current_user` is used rather than
 * `session_user` on purpose: a role that can `SET ROLE` to something weaker is not a
 * boundary, and the ownership checks below catch that separately.
 *
 * @param client Any connected `pg` client — the runtime connection, not the owner one.
 * @returns The observed privileges.
 */
export async function inspectRuntimeRoleBoundary(
  client: Queryable,
): Promise<RuntimeRoleBoundary> {
  const { rows } = await client.query<RuntimeRoleBoundary>(`
    select
      current_user::text as role,
      coalesce((select rolsuper from pg_roles where rolname = current_user), false) as superuser,
      coalesce((
        select n.nspowner = (select oid from pg_roles where rolname = current_user)
        from pg_namespace n where n.nspname = 'trope_graph'
      ), false) as "schemaOwner",
      coalesce(
        pg_has_role(current_user, (select nspowner from pg_namespace where nspname = 'trope_graph'), 'USAGE'),
        false
      ) as "memberOfSchemaOwner",
      coalesce((
        select c.relowner = (select oid from pg_roles where rolname = current_user)
        from pg_class c where c.oid = to_regclass('trope_graph.discovery_candidate_events')
      ), false) as "eventTableOwner",
      coalesce(has_schema_privilege(current_user, 'trope_graph', 'CREATE'), false) as "canCreateInSchema",
      case when to_regclass('trope_graph.discovery_candidate_events') is null then false
        else has_table_privilege(current_user, 'trope_graph.discovery_candidate_events', 'TRIGGER')
      end as "canTriggerEventTable",
      case when to_regclass('trope_graph.discovery_candidate_events') is null then false
        else has_table_privilege(current_user, 'trope_graph.discovery_candidate_events', 'UPDATE')
      end as "canUpdateEvents",
      case when to_regclass('trope_graph.discovery_candidate_events') is null then false
        else has_table_privilege(current_user, 'trope_graph.discovery_candidate_events', 'DELETE')
      end as "canDeleteEvents",
      case when to_regclass('trope_graph.discovery_candidate_events') is null then false
        else has_table_privilege(current_user, 'trope_graph.discovery_candidate_events', 'TRUNCATE')
      end as "canTruncateEvents",
      case when to_regclass('trope_graph.discovery_candidate_events') is null then false
        else has_table_privilege(current_user, 'trope_graph.discovery_candidate_events', 'INSERT')
      end as "canInsertEvents",
      case when to_regclass('trope_graph.discovery_candidates') is null then false
        else has_table_privilege(current_user, 'trope_graph.discovery_candidates', 'SELECT')
      end as "canSelectCandidates"
  `)

  const row = rows[0]
  if (!row)
    throw new Error('Could not read the runtime role boundary from pg_catalog')
  return row
}

/**
 * List everything that stands in the way of the strong immutability guarantee.
 *
 * Two kinds of finding are returned from one list so callers cannot accidentally print the
 * scary ones and ignore the missing ones:
 *
 *   - **too powerful** — the runtime role can DDL or mutate the event log, so the boundary
 *     does not exist;
 *   - **too weak** — the runtime role cannot append events or read candidates, so the
 *     application is broken even though the boundary is real.
 *
 * @param boundary Result of {@link inspectRuntimeRoleBoundary}.
 * @returns Findings in a stable order; empty means the role is correctly provisioned.
 */
export function boundaryFindings(
  boundary: RuntimeRoleBoundary,
): PrivilegeFinding[] {
  const findings: PrivilegeFinding[] = []

  if (boundary.superuser) {
    findings.push({
      code: 'superuser',
      message: `Runtime role "${boundary.role}" is a superuser. Connect the application as a non-owner, non-superuser role.`,
    })
  }
  if (boundary.schemaOwner) {
    findings.push({
      code: 'schema_owner',
      message: `Runtime role "${boundary.role}" owns schema trope_graph, so it can disable the event-log triggers. Run migrations as an owner role and the application as another.`,
    })
  }
  if (boundary.memberOfSchemaOwner) {
    findings.push({
      code: 'member_of_schema_owner',
      message: `Runtime role "${boundary.role}" is a member of the trope_graph owner and can SET ROLE to it. Revoke the membership.`,
    })
  }
  if (boundary.eventTableOwner) {
    findings.push({
      code: 'event_table_owner',
      message: `Runtime role "${boundary.role}" owns trope_graph.discovery_candidate_events, so it can drop its triggers.`,
    })
  }
  if (boundary.canCreateInSchema) {
    findings.push({
      code: 'can_create_in_schema',
      message: `Runtime role "${boundary.role}" has CREATE on schema trope_graph. Revoke it; migrations belong to the owner role.`,
    })
  }
  if (boundary.canTriggerEventTable) {
    findings.push({
      code: 'can_trigger_event_table',
      message: `Runtime role "${boundary.role}" has TRIGGER on trope_graph.discovery_candidate_events, so it can drop the append-only guard.`,
    })
  }
  if (boundary.canUpdateEvents) {
    findings.push({
      code: 'can_update_events',
      message: `Runtime role "${boundary.role}" has UPDATE on the event log. Grant SELECT and INSERT only.`,
    })
  }
  if (boundary.canDeleteEvents) {
    findings.push({
      code: 'can_delete_events',
      message: `Runtime role "${boundary.role}" has DELETE on the event log. Grant SELECT and INSERT only.`,
    })
  }
  if (boundary.canTruncateEvents) {
    findings.push({
      code: 'can_truncate_events',
      message: `Runtime role "${boundary.role}" has TRUNCATE on the event log. Revoke it.`,
    })
  }
  if (!boundary.canInsertEvents) {
    findings.push({
      code: 'missing_insert_events',
      message: `Runtime role "${boundary.role}" cannot INSERT review events, so reviewing a candidate will fail. Grant INSERT.`,
    })
  }
  if (!boundary.canSelectCandidates) {
    findings.push({
      code: 'missing_select_candidates',
      message: `Runtime role "${boundary.role}" cannot SELECT discovery candidates, so the review queue is unreadable. Grant SELECT.`,
    })
  }

  return findings
}

/**
 * Render the observed boundary as a single log line.
 *
 * @param boundary Result of {@link inspectRuntimeRoleBoundary}.
 * @returns A one-line summary suitable for startup logs.
 * @example
 * ```
 * runtime role "trope_app": owner=false ddl=false event-update=false event-delete=false
 * ```
 */
export function formatRuntimeRoleBoundary(
  boundary: RuntimeRoleBoundary,
): string {
  const flag = (value: boolean) => (value ? 'true' : 'false')
  return (
    `runtime role "${boundary.role}": superuser=${flag(boundary.superuser)} ` +
    `owner=${flag(boundary.schemaOwner || boundary.eventTableOwner)} ` +
    `ddl=${flag(boundary.canCreateInSchema || boundary.canTriggerEventTable)} ` +
    `event-update=${flag(boundary.canUpdateEvents)} ` +
    `event-delete=${flag(boundary.canDeleteEvents)} ` +
    `event-insert=${flag(boundary.canInsertEvents)}`
  )
}

/** Options for {@link assertRuntimeRoleBoundary}. */
export type AssertBoundaryOptions = {
  /**
   * Log findings instead of throwing. Set for local development, where the single local
   * superuser is the intended connection.
   */
  allowSharedRole?: boolean
  /** Sink for findings; defaults to `console.warn`. */
  warn?: (message: string) => void
}

/**
 * Verify the runtime role is correctly provisioned, or explain what to fix.
 *
 * @param client Any connected `pg` client using the **runtime** credentials.
 * @param options See {@link AssertBoundaryOptions}.
 * @returns The observed boundary, so callers can log it.
 * @throws {Error} If findings exist and `allowSharedRole` is not set.
 * @example
 * ```ts
 * const boundary = await assertRuntimeRoleBoundary(getPool(), {
 *   allowSharedRole: process.env.TROPE_GRAPH_ALLOW_SHARED_ROLE === '1',
 * });
 * ```
 */
export async function assertRuntimeRoleBoundary(
  client: Queryable,
  options: AssertBoundaryOptions = {},
): Promise<RuntimeRoleBoundary> {
  const boundary = await inspectRuntimeRoleBoundary(client)
  const findings = boundaryFindings(boundary)

  if (findings.length === 0) return boundary

  const detail = findings.map((f) => `  - [${f.code}] ${f.message}`).join('\n')

  if (options.allowSharedRole === true) {
    const warn = options.warn ?? ((message: string) => console.warn(message))
    warn(
      `Runtime role boundary is not enforced (shared-role mode):\n${detail}\n` +
        'Discovery event history is therefore immutable under DML only.',
    )
    return boundary
  }

  throw new Error(
    `Runtime role boundary violated:\n${detail}\n` +
      'Run `pnpm run trope-graph:provision-runtime-role` with the owner URL, point the\n' +
      'application at the non-owner role, or pass --allow-shared-role for local work.',
  )
}
