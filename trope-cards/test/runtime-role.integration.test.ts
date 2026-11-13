import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { Client } from 'pg'

import {
  boundaryFindings,
  inspectRuntimeRoleBoundary,
} from '../src/db/runtime-role'
import {
  describeDatabaseTarget,
  resolveDatabaseConfig,
  resolveMigrationDatabaseUrl,
} from '../src/db/url'

/**
 * The discovery event log as a **privilege boundary**, exercised under the real runtime role.
 *
 * `discovery-store.integration.test.ts` proves the DML and foreign-key protections using one
 * connection. That is exactly the limit migration `0017` documented: a table owner can always
 * `ALTER TABLE … DISABLE TRIGGER`, so a single-role test cannot show that the *application*
 * is unable to bypass the guard. This suite closes that gap: it connects twice, once with
 * the owner/migration credentials and once with a non-owner runtime role provisioned by
 * `pnpm run trope-graph:provision-runtime-role`, and asserts what the runtime role cannot do.
 *
 * Provision it locally with:
 *
 * ```sh
 * createuser --login --pwprompt trope_app
 * TROPE_GRAPH_MIGRATION_URL=postgresql:///trope_cards_dev \
 * TROPE_GRAPH_DATABASE_URL=postgresql://trope_app:<password>@127.0.0.1/trope_cards_dev \
 *   pnpm run trope-graph:provision-runtime-role
 *
 * TROPE_GRAPH_DATABASE_URL=postgresql:///trope_cards_dev \
 * TROPE_GRAPH_RUNTIME_TEST_URL=postgresql://trope_app:<password>@127.0.0.1/trope_cards_dev \
 *   pnpm run trope-graph:test
 * ```
 *
 * Skipped unless `TROPE_GRAPH_RUNTIME_TEST_URL` is set. The owner URL comes from the normal
 * migration resolution, so a checkout with no database enabled still runs CI green.
 */

const runtimeUrl = process.env.TROPE_GRAPH_RUNTIME_TEST_URL
const skip =
  runtimeUrl === undefined || runtimeUrl.trim() === ''
    ? 'no TROPE_GRAPH_RUNTIME_TEST_URL set'
    : false

/** SQLSTATE for `insufficient_privilege`. */
const INSUFFICIENT_PRIVILEGE = '42501'
/** SQLSTATE for a foreign-key violation. */
const FOREIGN_KEY_VIOLATION = '23503'

/** Read the SQLSTATE of a rejected query, or fail with the original error text. */
function sqlState(error: unknown): string {
  const code = (error as { code?: unknown }).code
  if (typeof code !== 'string') {
    throw new Error(`expected a Postgres error with a SQLSTATE, got: ${String(error)}`)
  }
  return code
}

describe('discovery event log under a non-owner runtime role', { skip }, () => {
  let owner: Client
  let runtime: Client
  let candidateId: string
  let ownerRole: string

  before(async () => {
    owner = new Client(resolveDatabaseConfig(resolveMigrationDatabaseUrl()))
    runtime = new Client(resolveDatabaseConfig(runtimeUrl!))
    await Promise.all([owner.connect(), runtime.connect()])

    ownerRole = (await owner.query<{ role: string }>('select current_user::text as role')).rows[0]!
      .role

    // A committed candidate with history. These rows are the point of the test, so they are
    // not wrapped in a transaction this process would have to hold open.
    const inserted = await runtime.query<{ id: string }>(
      `insert into trope_graph.discovery_candidates
         (provider, provider_record_id, title, provenance)
       values ('runtime-role-test', $1, 'Runtime role boundary probe', '{"test":true}'::jsonb)
       returning id`,
      [`runtime-role-${process.pid}-${Date.now()}`],
    )
    candidateId = inserted.rows[0]!.id

    await runtime.query(
      `insert into trope_graph.discovery_candidate_events
         (candidate_id, action, decision, actor_id, notes)
       values ($1, 'REVIEWED', 'ACCEPT', 'runtime-role-test', 'boundary probe')`,
      [candidateId],
    )
  })

  after(async () => {
    if (owner && runtime) {
      // Cleanup is deliberately an owner DDL act: the runtime role has no remaining path to
      // delete history, and that is the property the suite asserts.
      try {
        await owner.query(
          'alter table trope_graph.discovery_candidate_events disable trigger user',
        )
        await owner.query(
          'delete from trope_graph.discovery_candidate_events where candidate_id = $1',
          [candidateId],
        )
        await owner.query(
          'alter table trope_graph.discovery_candidate_events enable trigger user',
        )
        await owner.query('delete from trope_graph.discovery_candidates where id = $1', [
          candidateId,
        ])
      } catch (error) {
        console.error(`cleanup failed: ${String(error)}`)
      }
    }
    await Promise.allSettled([owner?.end(), runtime?.end()])
  })

  it('connects as a different, correctly provisioned role', async () => {
    const boundary = await inspectRuntimeRoleBoundary(runtime)
    assert.notEqual(boundary.role, ownerRole, 'runtime and owner must be different roles')
    assert.deepEqual(boundaryFindings(boundary), [])
    assert.equal(boundary.superuser, false)
    assert.equal(boundary.schemaOwner, false)
    assert.equal(boundary.canInsertEvents, true, 'runtime must still append events')
    assert.equal(boundary.canSelectCandidates, true, 'runtime must still read the queue')
    assert.equal(
      describeDatabaseTarget(runtimeUrl!).role,
      boundary.role,
      'the test URL must identify the role that actually connected',
    )
  })

  it('cannot UPDATE an event', async () => {
    await assert.rejects(
      runtime.query(
        "update trope_graph.discovery_candidate_events set notes = 'rewritten' where candidate_id = $1",
        [candidateId],
      ),
      (error: unknown) => sqlState(error) === INSUFFICIENT_PRIVILEGE,
    )
  })

  it('cannot DELETE an event', async () => {
    await assert.rejects(
      runtime.query(
        'delete from trope_graph.discovery_candidate_events where candidate_id = $1',
        [candidateId],
      ),
      (error: unknown) => sqlState(error) === INSUFFICIENT_PRIVILEGE,
    )
  })

  it('cannot TRUNCATE the event log', async () => {
    await assert.rejects(
      runtime.query('truncate trope_graph.discovery_candidate_events'),
      (error: unknown) => sqlState(error) === INSUFFICIENT_PRIVILEGE,
    )
  })

  it('cannot disable the append-only triggers', async () => {
    await assert.rejects(
      runtime.query(
        'alter table trope_graph.discovery_candidate_events disable trigger user',
      ),
      (error: unknown) => sqlState(error) === INSUFFICIENT_PRIVILEGE,
    )
  })

  it('cannot drop the append-only trigger', async () => {
    await assert.rejects(
      runtime.query(
        'drop trigger discovery_candidate_events_no_update on trope_graph.discovery_candidate_events',
      ),
      (error: unknown) => sqlState(error) === INSUFFICIENT_PRIVILEGE,
    )
  })

  it('cannot drop the event table', async () => {
    await assert.rejects(
      runtime.query('drop table trope_graph.discovery_candidate_events'),
      (error: unknown) => sqlState(error) === INSUFFICIENT_PRIVILEGE,
    )
  })

  it('cannot create objects in the trope_graph schema', async () => {
    await assert.rejects(
      runtime.query('create table trope_graph.runtime_role_probe (id integer)'),
      (error: unknown) => sqlState(error) === INSUFFICIENT_PRIVILEGE,
    )
  })

  it('cannot escalate to the owner role', async () => {
    await assert.rejects(
      runtime.query(`set role "${ownerRole}"`),
      (error: unknown) => sqlState(error) === INSUFFICIENT_PRIVILEGE,
    )
  })

  it('cannot delete a candidate that has history', async () => {
    await assert.rejects(
      runtime.query('delete from trope_graph.discovery_candidates where id = $1', [
        candidateId,
      ]),
      (error: unknown) => sqlState(error) === FOREIGN_KEY_VIOLATION,
    )
  })

  it('can still do the work the application needs', async () => {
    const selected = await runtime.query('select id, review_status from trope_graph.discovery_candidates where id = $1', [
      candidateId,
    ])
    assert.equal(selected.rowCount, 1)

    // A review decision is ordinary DML on the candidate, and it bumps the revision token.
    await runtime.query(
      `update trope_graph.discovery_candidates
          set review_status = 'DEFERRED', revision = revision + 1
        where id = $1`,
      [candidateId],
    )

    // The event written in `before` and the candidate itself survived every attempt above.
    const events = await runtime.query<{ count: string; notes: string }>(
      'select count(*)::text as count, min(notes) as notes from trope_graph.discovery_candidate_events where candidate_id = $1',
      [candidateId],
    )
    assert.equal(events.rows[0]!.count, '1')
    assert.equal(events.rows[0]!.notes, 'boundary probe')
  })
})
