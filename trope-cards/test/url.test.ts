import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { resolveDatabaseUrl } from '../src/db/url'

/**
 * The connection-string fallback contract of the graph environment.
 *
 * The two variables under test are the ones every graph entry point shares via
 * `resolveDatabaseUrl`. Tests mutate `process.env`, so each one restores the caller's
 * original values afterwards.
 */

const GRAPH_URL = 'TROPE_GRAPH_DATABASE_URL'
const HOST_URL = 'DATABASE_URL'

/** Original values of the variables under test, recorded on first mutation. */
const saved = new Map<string, string | undefined>()

afterEach(() => {
  for (const key of [GRAPH_URL, HOST_URL]) {
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

describe('resolveDatabaseUrl', () => {
  it('prefers TROPE_GRAPH_DATABASE_URL when both variables are set', () => {
    set(GRAPH_URL, 'postgresql:///graph')
    set(HOST_URL, 'postgresql:///host')
    assert.equal(resolveDatabaseUrl(), 'postgresql:///graph')
  })

  it('falls back to DATABASE_URL when TROPE_GRAPH_DATABASE_URL is unset', () => {
    set(GRAPH_URL, undefined)
    set(HOST_URL, 'postgresql:///host')
    assert.equal(resolveDatabaseUrl(), 'postgresql:///host')
  })

  it('treats an empty TROPE_GRAPH_DATABASE_URL as unset', () => {
    set(GRAPH_URL, '')
    set(HOST_URL, 'postgresql:///host')
    assert.equal(resolveDatabaseUrl(), 'postgresql:///host')
  })

  it('treats a whitespace-only TROPE_GRAPH_DATABASE_URL as unset', () => {
    set(GRAPH_URL, '   ')
    set(HOST_URL, 'postgresql:///host')
    assert.equal(resolveDatabaseUrl(), 'postgresql:///host')
  })

  it('returns a whitespace-padded but non-empty value unchanged', () => {
    set(GRAPH_URL, 'postgresql:///graph')
    set(HOST_URL, 'postgresql:///host')
    assert.equal(resolveDatabaseUrl(), 'postgresql:///graph')
  })

  it('throws when neither variable is set', () => {
    set(GRAPH_URL, undefined)
    set(HOST_URL, undefined)
    assert.throws(() => resolveDatabaseUrl(), /No database connection string found/)
  })

  it('throws when both variables are empty or whitespace-only', () => {
    set(GRAPH_URL, '')
    set(HOST_URL, '   ')
    assert.throws(() => resolveDatabaseUrl(), /No database connection string found/)
  })
})