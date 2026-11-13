#!/usr/bin/env node
/**
 * `prisma migrate deploy`, run with the owner credentials when they are configured.
 *
 * Why this exists: the application connects with a non-owner role so that it cannot issue
 * DDL (see `trope-cards/src/db/runtime-role.ts` and bd `as-truth-cards-nnc`), but
 * `prisma migrate deploy` *is* DDL and needs the owner. Prisma's CLI has no `--url` flag, so
 * the only way to give it different credentials from the runtime is to swap `DATABASE_URL`
 * for the child process.
 *
 * `DATABASE_MIGRATION_URL` (or `TROPE_GRAPH_MIGRATION_URL`, so a single Neon owner URL can
 * cover both halves of the schema) is read from the real process environment. A local `.env`
 * is deliberately not parsed here: Prisma loads it itself and, because the CLI does not
 * override variables that are already set, this wrapper's choice wins either way.
 *
 * Without an owner URL the script passes through to the plain command, which keeps local
 * development and single-role deployments working exactly as before.
 */
import { spawnSync } from 'node:child_process'

/**
 * Pick the owner connection string, if one is configured.
 *
 * @returns `{ url, variable }` or `undefined` when nothing is set.
 */
function resolveOwnerUrl() {
  for (const variable of ['DATABASE_MIGRATION_URL', 'TROPE_GRAPH_MIGRATION_URL']) {
    const value = process.env[variable]
    if (value !== undefined && value.trim() !== '') return { url: value, variable }
  }
  return undefined
}

const owner = resolveOwnerUrl()
const env = { ...process.env }

if (owner) {
  env.DATABASE_URL = owner.url
  console.log(`[db:migrate:deploy] applying Prisma migrations as the owner (${owner.variable})`)
} else {
  console.log(
    '[db:migrate:deploy] no DATABASE_MIGRATION_URL set; applying Prisma migrations with DATABASE_URL'
  )
}

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})

if (result.error) {
  console.error(`[db:migrate:deploy] could not run prisma: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
