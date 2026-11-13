import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  describeDatabaseTarget,
  resolveDatabaseUrl,
  resolveMigrationDatabaseUrl,
  usesSeparateMigrationUrl,
} from '../src/db/url'

/**
 * The connection-string contract of the graph environment.
 *
 * Two resolvers matter and they are deliberately different: `resolveDatabaseUrl` is the
 * runtime connection and `resolveMigrationDatabaseUrl` is the owner connection used for DDL.
 * Both fall back to `DATABASE_URL`, so the precedence — not the presence of a variable — is
 * what the deployment gets. Tests mutate `process.env`, so each one restores the caller's
 * original values afterwards.
 */

const GRAPH_URL = 'TROPE_GRAPH_DATABASE_URL'
const HOST_URL = 'DATABASE_URL'
const GRAPH_MIGRATION_URL = 'TROPE_GRAPH_MIGRATION_URL'
const HOST_MIGRATION_URL = 'DATABASE_MIGRATION_URL'

const ENV_KEYS = [GRAPH_URL, HOST_URL, GRAPH_MIGRATION_URL, HOST_MIGRATION_URL]

/** Original values of the variables under test, recorded on first mutation. */
const saved = new Map<string, string | undefined>()

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
    saved.delete(key)
  }
})

/** Set a variable for this test, remembering what it held before. */
function set(key: string, value: string | undefined): void {
  if (!saved.has(key)) saved.set(key, process.env[key])
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

/** Clear every variable under test, then apply the given values. */
function only(values: Partial<Record<string, string>>): void {
  for (const key of ENV_KEYS) set(key, undefined)
  for (const [key, value] of Object.entries(values)) set(key, value)
}

describe('resolveDatabaseUrl', () => {
  it('prefers TROPE_GRAPH_DATABASE_URL when both variables are set', () => {
    only({ [GRAPH_URL]: 'postgresql:///graph', [HOST_URL]: 'postgresql:///host' })
    assert.equal(resolveDatabaseUrl(), 'postgresql:///graph')
  })

  it('falls back to DATABASE_URL when TROPE_GRAPH_DATABASE_URL is unset', () => {
    only({ [HOST_URL]: 'postgresql:///host' })
    assert.equal(resolveDatabaseUrl(), 'postgresql:///host')
  })

  it('treats an empty TROPE_GRAPH_DATABASE_URL as unset', () => {
    only({ [GRAPH_URL]: '', [HOST_URL]: 'postgresql:///host' })
    assert.equal(resolveDatabaseUrl(), 'postgresql:///host')
  })

  it('treats a whitespace-only TROPE_GRAPH_DATABASE_URL as unset', () => {
    only({ [GRAPH_URL]: '   ', [HOST_URL]: 'postgresql:///host' })
    assert.equal(resolveDatabaseUrl(), 'postgresql:///host')
  })

  it('returns a whitespace-padded but non-empty value unchanged', () => {
    only({ [GRAPH_URL]: 'postgresql:///graph', [HOST_URL]: 'postgresql:///host' })
    assert.equal(resolveDatabaseUrl(), 'postgresql:///graph')
  })

  it('throws when neither variable is set', () => {
    only({})
    assert.throws(() => resolveDatabaseUrl(), /No database connection string found/)
  })

  it('throws when both variables are empty or whitespace-only', () => {
    only({ [GRAPH_URL]: '', [HOST_URL]: '   ' })
    assert.throws(() => resolveDatabaseUrl(), /No database connection string found/)
  })

  it('never reads the migration variables', () => {
    only({
      [GRAPH_MIGRATION_URL]: 'postgresql:///owner',
      [HOST_MIGRATION_URL]: 'postgresql:///owner',
      [HOST_URL]: 'postgresql:///runtime',
    })
    assert.equal(resolveDatabaseUrl(), 'postgresql:///runtime')
  })
})

describe('resolveMigrationDatabaseUrl', () => {
  it('prefers TROPE_GRAPH_MIGRATION_URL above everything else', () => {
    only({
      [GRAPH_MIGRATION_URL]: 'postgresql:///graph-owner',
      [HOST_MIGRATION_URL]: 'postgresql:///host-owner',
      [GRAPH_URL]: 'postgresql:///graph-runtime',
      [HOST_URL]: 'postgresql:///host-runtime',
    })
    assert.equal(resolveMigrationDatabaseUrl(), 'postgresql:///graph-owner')
  })

  it('falls back to DATABASE_MIGRATION_URL', () => {
    only({
      [HOST_MIGRATION_URL]: 'postgresql:///host-owner',
      [GRAPH_URL]: 'postgresql:///graph-runtime',
      [HOST_URL]: 'postgresql:///host-runtime',
    })
    assert.equal(resolveMigrationDatabaseUrl(), 'postgresql:///host-owner')
  })

  it('falls back to the runtime URL so local development keeps one connection', () => {
    only({ [GRAPH_URL]: 'postgresql:///graph-runtime' })
    assert.equal(resolveMigrationDatabaseUrl(), 'postgresql:///graph-runtime')
  })

  it('treats empty and whitespace-only migration values as unset', () => {
    only({
      [GRAPH_MIGRATION_URL]: '   ',
      [HOST_MIGRATION_URL]: '',
      [HOST_URL]: 'postgresql:///host-runtime',
    })
    assert.equal(resolveMigrationDatabaseUrl(), 'postgresql:///host-runtime')
  })

  it('throws when no URL of any kind is configured', () => {
    only({})
    assert.throws(() => resolveMigrationDatabaseUrl(), /No database connection string found/)
  })
})

describe('usesSeparateMigrationUrl', () => {
  it('is true when either migration variable is set', () => {
    only({ [GRAPH_MIGRATION_URL]: 'postgresql:///owner' })
    assert.equal(usesSeparateMigrationUrl(), true)

    only({ [HOST_MIGRATION_URL]: 'postgresql:///owner' })
    assert.equal(usesSeparateMigrationUrl(), true)
  })

  it('is false when neither is set, including for blank values', () => {
    only({ [GRAPH_URL]: 'postgresql:///graph' })
    assert.equal(usesSeparateMigrationUrl(), false)

    only({ [GRAPH_MIGRATION_URL]: '  ', [HOST_MIGRATION_URL]: '' })
    assert.equal(usesSeparateMigrationUrl(), false)
  })
})

describe('describeDatabaseTarget', () => {
  it('describes host, role and database without exposing the password', () => {
    const target = describeDatabaseTarget(
      'postgresql://trope_app:s3cret@db.example.com:5432/neondb?sslmode=require',
    )
    assert.deepEqual(target, {
      host: 'db.example.com',
      role: 'trope_app',
      database: 'neondb',
      hasPassword: true,
    })
    assert.equal(JSON.stringify(target).includes('s3cret'), false)
  })

  it('reports no password for a local socket-style URL', () => {
    const target = describeDatabaseTarget('postgresql:///trope_cards_dev')
    assert.equal(target.role, '')
    assert.equal(target.database, 'trope_cards_dev')
    assert.equal(target.hasPassword, false)
  })

  it('returns empty fields for a keyword/value DSN', () => {
    assert.deepEqual(describeDatabaseTarget('host=/var/run/postgresql dbname=db'), {
      host: '',
      role: '',
      database: '',
      hasPassword: false,
    })
  })
})
