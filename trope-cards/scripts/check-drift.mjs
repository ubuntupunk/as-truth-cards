#!/usr/bin/env node
/**
 * Compares the live database (built from the canonical hand-written SQL in
 * `trope-cards/drizzle/`) against a scratch database built from the SQL that
 * Drizzle Kit generates from `trope-cards/src/db/schema/`.
 *
 * `drizzle-kit generate` on its own cannot answer this question: it keeps its
 * own snapshot under `generated/meta` and reports "no schema changes" even when
 * the hand-written migrations have diverged, because it only ever compares
 * against itself. This script therefore regenerates the schema SQL from a clean
 * slate and compares the two databases structurally.
 *
 * The comparison reads the system catalog rather than diffing `pg_dump` text,
 * because pg_dump's line wrapping produces large numbers of false differences
 * between two structurally identical schemas.
 *
 * Read-only with respect to the live database: it only queries it. All
 * mutation happens in a temporary scratch database, which is dropped on exit.
 *
 * @example
 *   TROPE_GRAPH_DATABASE_URL=postgresql:///trope_cards_dev pnpm run trope-graph:check-drift
 */

import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const TROPE_CARDS_DIR = join(REPO_ROOT, 'trope-cards')
const GENERATED_DIR = join(TROPE_CARDS_DIR, 'drizzle-kit/generated')
const SCRATCH_DB = 'trope_graph_drift_check'
const TARGET_SCHEMA = 'trope_graph'

/** Runs a command, returning stdout, and throws with stderr on failure. */
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })

/** Runs a command for its side effect only, discarding stdout. */
const runQuiet = (command, args, options = {}) =>
  execFileSync(command, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    ...options,
  })

/** Returns true when the named database exists. */
const databaseExists = (name) => {
  try {
    const output = run('psql', [
      '-d',
      'postgres',
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname = '${name}'`,
    ])
    return output.trim() === '1'
  } catch {
    return false
  }
}

/**
 * Emits one canonical line per schema fact: columns, constraints, indexes, and
 * enum labels. Each line is a `kind\tsubject\tdefinition` triple, so any
 * difference between the two databases shows up as a line present in one set
 * and not the other.
 *
 * Constraint and index definitions deliberately exclude object names. Postgres
 * auto-generates names such as `card_cases_pkey` for unnamed constraints,
 * whereas Drizzle emits explicit ones such as `card_cases_card_id_case_id_pk`.
 * The two are semantically identical and nothing in this codebase refers to
 * them by name, so comparing names would report the entire schema as drifted.
 *
 * UNIQUE constraints are omitted from the constraint facts because the same
 * rule is written two different ways: Drizzle emits an inline `UNIQUE (...)`
 * table constraint, while the hand-written migrations create a bare
 * `CREATE UNIQUE INDEX`. Postgres backs a unique constraint with a unique
 * index either way, so the `index` facts already compare the rule, and
 * including both spellings would report each one twice.
 *
 * The `schema_migrations` ledger is excluded: it is owned by the migration
 * runner, not by the Drizzle schema modules.
 */
const SCHEMA_FACTS_SQL = `
WITH facts AS (
  SELECT
    'column' AS kind,
    c.relname AS subject,
    concat(
      a.attname, ' ', format_type(a.atttypid, a.atttypmod),
      case when a.attnotnull then ' NOT NULL' else '' end,
      case when pg_get_expr(d.adbin, d.adrelid) is not null
        then ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid) else '' end
    ) AS definition
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = '${TARGET_SCHEMA}'
    AND c.relkind IN ('r', 'p')
    AND a.attnum > 0
    AND not a.attisdropped

  UNION ALL

  SELECT
    'constraint',
    c.relname,
    pg_get_constraintdef(con.oid)
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = '${TARGET_SCHEMA}'
    AND con.contype <> 'u'

  UNION ALL

  SELECT
    'index',
    c.relname,
    regexp_replace(pg_get_indexdef(i.oid), '^CREATE (UNIQUE )?INDEX \\S+ ', 'CREATE \\1INDEX ')
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class c ON c.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = '${TARGET_SCHEMA}'

  UNION ALL

  SELECT
    'enum',
    t.typname,
    string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname = '${TARGET_SCHEMA}'
  GROUP BY t.typname
)
SELECT kind || E'\\t' || subject || E'\\t' || definition FROM facts
WHERE subject <> 'schema_migrations'
ORDER BY kind, subject, definition;
`

/** Reads the sorted schema-fact lines for a database. */
const readSchemaFacts = (database) =>
  run('psql', [
    '-d',
    database,
    '-tA',
    '-F',
    '\t',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    SCHEMA_FACTS_SQL,
  ])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

/** Strips the comment markers Drizzle Kit uses to delimit statements. */
const stripStatementBreakpoints = (sql) =>
  sql.replace(/--> statement-breakpoint/g, '')

/**
 * Regenerates the schema SQL from the schema modules, from a clean slate.
 *
 * Drizzle Kit keeps its own snapshot under `generated/meta`. Once that snapshot
 * exists it reports "no schema changes" even when the hand-written migrations
 * have diverged, because it only compares against itself. Clearing the whole
 * directory forces a full regeneration from `src/db/schema`, which is what
 * makes the comparison against the live database meaningful.
 */
const regenerateSchemaSql = () => {
  rmSync(GENERATED_DIR, { recursive: true, force: true })
  // Run from `trope-cards/` so drizzle-kit auto-discovers `drizzle.config.ts` and its
  // relative `schema`/`out` paths resolve correctly. Passing absolute paths instead makes
  // drizzle-kit concatenate them onto `.`, yielding `.//home/...`.
  run('pnpm', ['exec', 'drizzle-kit', 'generate'], {
    cwd: TROPE_CARDS_DIR,
    stdio: ['ignore', 'ignore', 'pipe'],
  })

  const files = readdirSync(GENERATED_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    throw new Error(`Drizzle Kit produced no SQL in ${GENERATED_DIR}.`)
  }

  return stripStatementBreakpoints(
    files
      .map((name) => readFileSync(join(GENERATED_DIR, name), 'utf8'))
      .join('\n'),
  )
}

/** Splits a `kind\tsubject\tdefinition` line into its parts. */
const parseFact = (line) => {
  const [kind, subject, definition] = line.split('\t')
  return { kind, subject, definition }
}

const main = () => {
  const workDir = mkdtempSync(join(tmpdir(), 'trope-drift-'))
  let scratchCreated = false

  try {
    const generatedSql = regenerateSchemaSql()

    if (databaseExists(SCRATCH_DB)) {
      runQuiet('dropdb', [SCRATCH_DB])
    }
    runQuiet('createdb', [SCRATCH_DB])
    scratchCreated = true

    const sqlFile = join(workDir, 'generated.sql')
    writeFileSync(sqlFile, generatedSql)
    runQuiet('psql', [
      '-d',
      SCRATCH_DB,
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-f',
      sqlFile,
    ])

    const migrationFacts = new Set(readSchemaFacts('trope_cards_dev'))
    const schemaFacts = new Set(readSchemaFacts(SCRATCH_DB))

    const onlyInMigrations = [...migrationFacts]
      .filter((fact) => !schemaFacts.has(fact))
      .map(parseFact)
    const onlyInSchemaModules = [...schemaFacts]
      .filter((fact) => !migrationFacts.has(fact))
      .map(parseFact)

    if (onlyInMigrations.length === 0 && onlyInSchemaModules.length === 0) {
      console.log(
        JSON.stringify(
          {
            check: 'schema-drift',
            drift: false,
            comparedFacts: migrationFacts.size,
          },
          null,
          2,
        ),
      )
      return
    }

    console.log(
      JSON.stringify(
        {
          check: 'schema-drift',
          drift: true,
          onlyInMigrations,
          onlyInSchemaModules,
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
  } finally {
    if (scratchCreated && databaseExists(SCRATCH_DB)) {
      runQuiet('dropdb', [SCRATCH_DB])
    }
    rmSync(workDir, { recursive: true, force: true })
  }
}

main()
