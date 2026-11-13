import process from 'node:process'

import { Client } from 'pg'

import {
  assertRuntimeRoleBoundary,
  formatRuntimeRoleBoundary,
  inspectRuntimeRoleBoundary,
} from './runtime-role'
import {
  assertLocalHost,
  describeDatabaseTarget,
  resolveDatabaseConfig,
  resolveDatabaseUrl,
  resolveMigrationDatabaseUrl,
} from './url'

/**
 * Owner-side provisioning and runtime-side verification of the database privilege split.
 *
 * ## Why this exists
 *
 * Migration `0017` documents discovery event history as immutable "under all DML for every
 * role". That is the strongest claim a single shared role can make, because a table owner
 * can always `ALTER TABLE … DISABLE TRIGGER`. bd `as-truth-cards-nnc` turns the guarantee
 * into a privilege boundary by giving the application a non-owner login role with DML only,
 * and keeping DDL on an owner credential used solely by migrations.
 *
 * ## Usage
 *
 * ```sh
 * # once, with the owner URL available:
 * TROPE_GRAPH_MIGRATION_URL=postgresql://owner:…@host/db \
 * TROPE_GRAPH_DATABASE_URL=postgresql://trope_app:…@host/db \
 *   pnpm run trope-graph:provision-runtime-role -- --allow-remote
 *
 * # every deploy, with the runtime URL:
 * TROPE_GRAPH_DATABASE_URL=postgresql://trope_app:…@host/db \
 *   pnpm run trope-graph:verify-runtime-role
 * ```
 *
 * The role name and password are taken from the **runtime URL**, not from separate
 * variables, so the thing that is provisioned is exactly the thing the application uses.
 */

/** Flags shared by both subcommands. */
type Flags = {
  allowRemote: boolean
  allowSharedRole: boolean
  skipPublic: boolean
}

/**
 * Parse the tiny flag vocabulary this CLI accepts.
 *
 * @param argv Arguments after the subcommand.
 * @returns Parsed flags.
 */
function parseFlags(argv: readonly string[]): Flags {
  const set = new Set(argv)
  return {
    allowRemote: set.has('--allow-remote'),
    allowSharedRole: set.has('--allow-shared-role'),
    skipPublic: set.has('--no-public'),
  }
}

/**
 * Return the first row of a single-row query, or throw.
 *
 * `pg` types every result as an array, so a query that is known to return one row still needs
 * a check. A named helper keeps that check explicit instead of a non-null assertion, which the
 * linter (rightly) rejects.
 *
 * @param rows Result rows.
 * @returns The first row.
 * @throws {Error} If the query returned no rows.
 */
function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (row === undefined)
    throw new Error('Expected one row from a single-row query')
  return row
}

/**
 * Quote a role identifier using the server's own quoting rules.
 *
 * Interpolating a role name into DDL is the one place a SQL string is unavoidable
 * (`CREATE ROLE` cannot take parameters). Asking Postgres to quote it keeps `"weird role"`
 * and `role-with-dash` working without trusting a local regex.
 *
 * @param client Connected client used for quoting.
 * @param value Raw identifier.
 * @returns A double-quoted identifier.
 */
async function quoteIdent(client: Client, value: string): Promise<string> {
  const { rows } = await client.query<{ quoted: string }>(
    'select quote_ident($1) as quoted',
    [value],
  )
  return first(rows).quoted
}

/**
 * Quote a string literal using the server's own escaping rules.
 *
 * @param client Connected client used for quoting.
 * @param value Raw value.
 * @returns A single-quoted literal.
 */
async function quoteLiteral(client: Client, value: string): Promise<string> {
  const { rows } = await client.query<{ quoted: string }>(
    'select quote_literal($1) as quoted',
    [value],
  )
  return first(rows).quoted
}

/**
 * Create or update the non-owner runtime role and grant it DML only.
 *
 * Idempotent: safe to re-run after adding a migration, and it re-applies every grant so a
 * hand-edited privilege is corrected rather than inherited.
 *
 * @param flags Parsed CLI flags.
 * @returns Process exit code.
 */
async function provision(flags: Flags): Promise<number> {
  const ownerUrl = resolveMigrationDatabaseUrl()
  const runtimeUrl = resolveDatabaseUrl()
  const ownerTarget = describeDatabaseTarget(ownerUrl)
  const runtimeTarget = describeDatabaseTarget(runtimeUrl)

  if (!flags.allowRemote) assertLocalHost(ownerUrl, false)

  if (!runtimeTarget.role) {
    throw new Error(
      'The runtime URL must be a postgres URL with a role name, e.g.\n' +
        '  TROPE_GRAPH_DATABASE_URL=postgresql://trope_app:<password>@host/db',
    )
  }
  if (!runtimeTarget.hasPassword) {
    throw new Error(
      `Runtime role "${runtimeTarget.role}" has no password in the runtime URL.\n` +
        'A login role used over the network needs one. Put it in the URL\n' +
        '(percent-encode special characters) and re-run.',
    )
  }

  const runtimePassword = passwordOf(runtimeUrl)
  if (runtimePassword === undefined) {
    throw new Error(
      'Could not read the runtime password from the runtime URL. Use a URL form such as\n' +
        'postgresql://trope_app:secret@host/db.',
    )
  }

  const owner = new Client(resolveDatabaseConfig(ownerUrl))
  await owner.connect()

  try {
    const ownerRole = first(
      (await owner.query<{ role: string }>('select current_user::text as role'))
        .rows,
    ).role

    if (ownerRole === runtimeTarget.role) {
      throw new Error(
        `Runtime role and owner role are both "${ownerRole}". Provisioning would grant the\n` +
          'application the same privileges it already has. Point TROPE_GRAPH_DATABASE_URL at a\n' +
          'different role, and keep the owner URL in TROPE_GRAPH_MIGRATION_URL.',
      )
    }

    const schemaPresent = first(
      (
        await owner.query<{ present: boolean }>(
          "select to_regclass('trope_graph.discovery_candidate_events') is not null as present",
        )
      ).rows,
    ).present
    if (!schemaPresent) {
      throw new Error(
        'Schema trope_graph is not migrated yet. Run `pnpm run trope-graph:migrate` with the\n' +
          'owner URL first, then provision the runtime role.',
      )
    }

    const ident = await quoteIdent(owner, runtimeTarget.role)
    const password = await quoteLiteral(owner, runtimePassword)
    const ownerIdent = await quoteIdent(owner, ownerRole)

    const exists = first(
      (
        await owner.query<{ present: boolean }>(
          'select exists (select 1 from pg_roles where rolname = $1) as present',
          [runtimeTarget.role],
        )
      ).rows,
    ).present

    // `CREATE ROLE` / `ALTER ROLE` cannot take bind parameters. Both interpolations are
    // values Postgres itself quoted in the statements above.
    if (exists) {
      await owner.query(`alter role ${ident} with login password ${password}`)
      console.log(`Updated password for runtime role ${ident}`)
    } else {
      await owner.query(`create role ${ident} with login password ${password}`)
      console.log(`Created runtime role ${ident}`)
    }

    // Schema: USAGE only. CREATE is what makes DDL possible, including disabling triggers.
    await owner.query(`revoke all on schema trope_graph from ${ident}`)
    await owner.query(`grant usage on schema trope_graph to ${ident}`)

    // Tables: DML by default …
    await owner.query(
      `revoke all on all tables in schema trope_graph from ${ident}`,
    )
    await owner.query(
      `grant select, insert, update, delete on all tables in schema trope_graph to ${ident}`,
    )
    // … except the audit log, which the application may append to but never rewrite. The
    // trigger from migration 0016/0017 still refuses mutation; this removes the privilege
    // as well so the refusal is not the only line of defence.
    await owner.query(
      `revoke all on trope_graph.discovery_candidate_events from ${ident}`,
    )
    await owner.query(
      `grant select, insert on trope_graph.discovery_candidate_events to ${ident}`,
    )

    await owner.query(
      `revoke all on all sequences in schema trope_graph from ${ident}`,
    )
    await owner.query(
      `grant usage, select on all sequences in schema trope_graph to ${ident}`,
    )

    // Future tables created by the owner migrations inherit DML for the runtime role. The
    // append-only exception is applied above to the one table that needs it.
    await owner.query(
      `alter default privileges for role ${ownerIdent} in schema trope_graph ` +
        `grant select, insert, update, delete on tables to ${ident}`,
    )
    await owner.query(
      `alter default privileges for role ${ownerIdent} in schema trope_graph ` +
        `grant usage, select on sequences to ${ident}`,
    )

    // The host application's Prisma models live in `public` and use the same DATABASE_URL,
    // so the runtime role needs DML there too. GRANT only: never revoke, because the
    // `public` schema is shared with anything else the database hosts.
    if (!flags.skipPublic) {
      await owner.query(`grant usage on schema public to ${ident}`)
      await owner.query(
        `grant select, insert, update, delete on all tables in schema public to ${ident}`,
      )
      await owner.query(
        `grant usage, select on all sequences in schema public to ${ident}`,
      )
      await owner.query(
        `alter default privileges for role ${ownerIdent} in schema public ` +
          `grant select, insert, update, delete on tables to ${ident}`,
      )
      await owner.query(
        `alter default privileges for role ${ownerIdent} in schema public ` +
          `grant usage, select on sequences to ${ident}`,
      )
    }

    console.log(
      `Granted DML to ${ident} on trope_graph ` +
        `(append-only on discovery_candidate_events)` +
        (flags.skipPublic ? '' : ' and on public'),
    )
    console.log(
      `Owner role ${ownerIdent} retains DDL. Migrations must keep using the owner URL.`,
    )
    console.log(
      `Owner target:   ${ownerRole}@${ownerTarget.host || '(socket)'}`,
    )
    console.log(
      `Runtime target: ${runtimeTarget.role}@${runtimeTarget.host} — ` +
        'point DATABASE_URL and TROPE_GRAPH_DATABASE_URL here.',
    )
  } finally {
    await owner.end()
  }

  return verify(flags)
}

/**
 * Connect with the runtime credentials and assert the boundary.
 *
 * @param flags Parsed CLI flags.
 * @returns Process exit code: 0 when the boundary holds.
 */
async function verify(flags: Flags): Promise<number> {
  const runtimeUrl = resolveDatabaseUrl()
  const target = describeDatabaseTarget(runtimeUrl)
  const client = new Client(resolveDatabaseConfig(runtimeUrl))
  await client.connect()

  try {
    const boundary = await assertRuntimeRoleBoundary(client, {
      allowSharedRole: flags.allowSharedRole,
    })
    console.log(`OK: ${formatRuntimeRoleBoundary(boundary)}`)
    console.log(
      `Runtime target: ${target.role}@${target.host} (${target.database})`,
    )
    return 0
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    // Always show what was actually observed — the error message explains the policy, this
    // shows the evidence.
    try {
      const boundary = await inspectRuntimeRoleBoundary(client)
      console.error(`\nObserved: ${formatRuntimeRoleBoundary(boundary)}`)
    } catch {
      // The connection may be entirely broken; the original error is the useful one.
    }
    return 1
  } finally {
    await client.end()
  }
}

/**
 * Extract the password from a postgres URL.
 *
 * @param url Connection string.
 * @returns The decoded password, or `undefined` when absent or unparseable.
 */
function passwordOf(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    if (parsed.password === '') return undefined
    return decodeURIComponent(parsed.password)
  } catch {
    return undefined
  }
}

/**
 * Entry point for `pnpm run trope-graph:provision-runtime-role` and
 * `pnpm run trope-graph:verify-runtime-role`.
 *
 * @returns Process exit code.
 */
export async function main(): Promise<number> {
  const [command = 'verify', ...rest] = process.argv.slice(2)
  const flags = parseFlags(rest)

  try {
    if (command === 'provision') return await provision(flags)
    if (command === 'verify') return await verify(flags)
    console.error(`Unknown command "${command}". Use "provision" or "verify".`)
    return 1
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

process.exitCode = await main()
