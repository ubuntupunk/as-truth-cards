import type { ClientConfig } from 'pg'

/**
 * Connection-string resolution for the Trope Graph.
 *
 * The runtime pool and the migration runner resolve their URLs here, but they resolve
 * *different* ones: {@link resolveDatabaseUrl} is the runtime (non-owner) connection and
 * {@link resolveMigrationDatabaseUrl} is the owner/migration connection. They fall back to
 * the same URL when no migration URL is configured, which is why the deployment checks in
 * `./runtime-role` verify the live privileges rather than trusting the configuration.
 */

/** Socket directory used when peer authentication over the local socket is available. */
const DEFAULT_SOCKET_DIR = '/var/run/postgresql'

/** Hostnames that mean "this machine". */
const LOOPBACK_HOSTS = new Set(['', 'localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * Read the connection string for the Trope Graph database.
 *
 * `TROPE_GRAPH_DATABASE_URL` takes precedence and is the variable to set in deployment.
 * An empty or whitespace-only value is treated as unset, so the graph also falls back to
 * `DATABASE_URL`, letting it share the host application's existing connection. That is safe
 * because every graph object lives in the `trope_graph` schema and cannot collide with the
 * Prisma-managed `public` schema.
 *
 * @returns The resolved connection string.
 * @throws {Error} If neither variable is set.
 */
export function resolveDatabaseUrl(): string {
  const graphUrl = process.env.TROPE_GRAPH_DATABASE_URL
  const url =
    graphUrl !== undefined && graphUrl.trim() !== ''
      ? graphUrl
      : process.env.DATABASE_URL

  if (!url || url.trim() === '') {
    throw new Error(
      'No database connection string found. Set TROPE_GRAPH_DATABASE_URL, or DATABASE_URL ' +
        "to share the host application's connection.",
    )
  }

  return url
}

/**
 * Read the connection string the **migration runner** should use.
 *
 * Migrations are DDL: they create and alter tables, install triggers and grant privileges.
 * The runtime connection should not be able to do any of that, so the two are separate
 * roles in production (see `docs/issue-12-plumx-research-report.md` §3 and bd
 * `as-truth-cards-nnc`). This resolver is the migration half of that split:
 *
 *   1. `TROPE_GRAPH_MIGRATION_URL` — the graph's owner/migration role.
 *   2. `DATABASE_MIGRATION_URL` — the host application's owner role, reused so one Neon
 *      owner credential covers both Prisma and graph migrations.
 *   3. the runtime URL, unchanged — local development and any deployment that has not
 *      provisioned a second role yet. {@link usesSeparateMigrationUrl} reports which
 *      happened, so callers can log the difference instead of implying a boundary exists.
 *
 * @returns The resolved migration connection string.
 * @throws {Error} If none of the three variables resolves to a non-empty value.
 */
export function resolveMigrationDatabaseUrl(): string {
  const candidates = [
    process.env.TROPE_GRAPH_MIGRATION_URL,
    process.env.DATABASE_MIGRATION_URL,
  ]

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate.trim() !== '') return candidate
  }

  return resolveDatabaseUrl()
}

/**
 * Whether a migration-specific connection string is configured.
 *
 * `false` means migrations and runtime share the runtime credentials, so the event-log
 * immutability guarantee is DML-scoped only: a table owner can always disable its own
 * triggers. This is a statement about configuration, not about the role that actually
 * connected — use {@link inspectRuntimeRoleBoundary} to check the live privileges.
 *
 * @returns `true` when a migration URL is set explicitly.
 */
export function usesSeparateMigrationUrl(): boolean {
  return (
    [
      process.env.TROPE_GRAPH_MIGRATION_URL,
      process.env.DATABASE_MIGRATION_URL,
    ].find((value) => value !== undefined && value.trim() !== '') !== undefined
  )
}

/**
 * A connection string described without its secret.
 *
 * Logs and error messages need to say *which* role and database a process connected as;
 * they must never print the password. This is the shape both sides of the migration/runtime
 * split report.
 */
export type DatabaseTarget = {
  /** Host as written in the URL, or `''` for a keyword/value DSN. */
  host: string
  /** Login role, or `''` when it cannot be parsed. */
  role: string
  /** Database name, or `''` when it cannot be parsed. */
  database: string
  /** Whether the URL carries a password (the value itself is never returned). */
  hasPassword: boolean
}

/**
 * Describe a connection string for logs, without its secret.
 *
 * @param url Connection string to inspect.
 * @returns Host, role, database and whether a password is present.
 * @example
 * ```ts
 * describeDatabaseTarget('postgresql://trope_app:secret@db.example.com/neondb');
 * // => { host: 'db.example.com', role: 'trope_app', database: 'neondb', hasPassword: true }
 * ```
 */
export function describeDatabaseTarget(url: string): DatabaseTarget {
  const parsed = parseUrl(url)
  if (!parsed) return { host: '', role: '', database: '', hasPassword: false }
  return {
    host: parsed.host,
    role: parsed.user,
    database: parsed.database,
    hasPassword: parsed.password !== undefined,
  }
}

/**
 * Convert a connection string into an explicit `pg` client config.
 *
 * This exists for a specific local-development failure. Given
 * `postgresql:///trope_cards_dev`, `pg` connects over TCP to `localhost` rather than over
 * the Unix socket. On a typical Debian/Ubuntu install the socket is configured for `peer`
 * authentication and the TCP listener for `scram-sha-256`, so the TCP attempt fails with
 * `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` while `psql` on the
 * same URL succeeds. When a URL has no password and points at loopback, this rewrites the
 * host to the socket directory so `pg` and `psql` behave the same.
 *
 * A URL that carries a password, or that points at a non-loopback host, is passed through
 * unchanged so remote and managed-database connections are unaffected.
 *
 * @param url Connection string from {@link resolveDatabaseUrl}.
 * @returns Config suitable for `new Client(config)` or `new Pool(config)`.
 * @example
 * ```ts
 * new Client(resolveDatabaseConfig("postgresql:///trope_cards_dev"));
 * // -> { host: "/var/run/postgresql", database: "trope_cards_dev", user: "ubuntupunk" }
 * ```
 */
export function resolveDatabaseConfig(url: string): ClientConfig {
  const parsed = parseUrl(url)
  if (!parsed) return { connectionString: url }

  const { host, password, database, user, port } = parsed
  if (password !== undefined || !LOOPBACK_HOSTS.has(host.toLowerCase())) {
    return { connectionString: url }
  }

  return {
    host: process.env.PGHOST ?? DEFAULT_SOCKET_DIR,
    database,
    user,
    ...(port ? { port } : {}),
  }
}

/**
 * Parse a postgres connection string into its parts.
 *
 * Returns `undefined` for keyword/value DSNs, which have no parseable URL structure and
 * are passed through untouched.
 *
 * @param url
 */
function parseUrl(url: string):
  | {
      host: string
      password: string | undefined
      database: string
      user: string
      port: number | undefined
    }
  | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return undefined
  }
  return {
    host: decodeURIComponent(parsed.hostname),
    password:
      parsed.password === '' ? undefined : decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    user: decodeURIComponent(parsed.username),
    port: parsed.port === '' ? undefined : Number(parsed.port),
  }
}

/**
 * Reject connection strings that do not obviously point at this machine.
 *
 * The repository `.env` sets `DATABASE_URL` to a live Neon instance, and
 * {@link resolveDatabaseUrl} falls back to it. A migration drops a schema, so pointing it
 * at the wrong database is the most damaging mistake available here. Callers that perform
 * destructive work should require an explicit opt-in for non-local hosts.
 *
 * @param url Connection string to inspect.
 * @param allowRemote Set true to permit non-loopback hosts.
 * @returns The host, for logging.
 * @throws {Error} If the host is not loopback and `allowRemote` is false.
 */
export function assertLocalHost(url: string, allowRemote: boolean): string {
  const parsed = parseUrl(url)
  const host = parsed?.host ?? ''

  // A keyword/value DSN has no parseable host. Fall back to a textual check, and treat
  // "localhost" as the conventional spelling there.
  if (!parsed) {
    if (allowRemote) return host
    if (/\b(localhost|127\.0\.0\.1)\b/.test(url)) return host
    throw new Error(
      `Cannot determine the host of connection string: ${url}\n` +
        'Re-run with --allow-remote if this database is genuinely remote.',
    )
  }

  if (allowRemote) return host
  if (LOOPBACK_HOSTS.has(host.toLowerCase())) return host
  throw new Error(
    `Refusing to touch non-local database host "${host}".\n` +
      "This repository's .env sets DATABASE_URL to a live Neon instance, and the graph\n" +
      'client falls back to it. To use a remote database on purpose, re-run with\n' +
      '--allow-remote.',
  )
}

/** Environment variable that permits a non-loopback host for scripts without a CLI flag. */
const ALLOW_REMOTE_ENV = 'TROPE_GRAPH_ALLOW_REMOTE'

/**
 * Apply {@link assertLocalHost} to the resolved connection string, taking the opt-in from
 * the environment instead of an argument.
 *
 * The seed and verify entry points have no `--allow-remote` flag, so they opt in via
 * `TROPE_GRAPH_ALLOW_REMOTE=1`. This keeps every write path in the project behind the same
 * guard as the migration runner, which is what stops an unset `TROPE_GRAPH_DATABASE_URL`
 * from silently falling through to the live Neon instance in the repository `.env`.
 *
 * @returns The host, for logging.
 * @throws {Error} If the host is not loopback and `TROPE_GRAPH_ALLOW_REMOTE` is not set.
 * @example
 * ```sh
 * TROPE_GRAPH_DATABASE_URL=postgresql:///trope_cards_dev pnpm run trope-graph:seed
 * ```
 */
export function assertLocalHostFromEnv(): string {
  const allowRemote = /^(1|true|yes)$/i.test(
    process.env[ALLOW_REMOTE_ENV] ?? '',
  )
  const url = resolveDatabaseUrl()
  return assertLocalHost(url, allowRemote)
}
