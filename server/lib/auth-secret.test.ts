import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  BETTER_AUTH_FALLBACK_SECRET,
  BETTER_AUTH_MIN_SECRET_LENGTH,
  assertAuthSecretConfigured,
  evaluateAuthSecret,
} from './auth-secret.js'

/**
 * The production `BETTER_AUTH_SECRET` contract.
 *
 * The behaviour these tests exist to prevent is silent. Without a secret Better Auth does not
 * fail — it substitutes a constant published in its own source, so the server starts, `/health`
 * returns 200, and `/api/auth/*` answers. A deployment in that state is an authentication
 * bypass, not an outage, and nothing surfaces it. These tests pin the two halves of the fix:
 * production refuses to start, and development still runs.
 */

/** A 43-character value with well over 8 distinct characters. */
const GOOD_SECRET = 'k7Qm2Zx9Rb4Tv6Nc8Lw3Pd5Yh1Js0Fg7Ua2Ee4I6O'

/** Assert the secret is rejected for `problem` rather than accepted. */
function rejectsWith(
  secret: string | undefined,
  problem: 'absent' | 'fallback' | 'too-short' | 'low-entropy',
): void {
  const verdict = evaluateAuthSecret(secret)
  assert.equal(verdict.ok, false, `expected ${String(secret)} to be rejected`)
  assert.equal(
    verdict.ok === false ? verdict.problem : undefined,
    problem,
    `expected problem ${problem}, got ${verdict.ok === false ? verdict.problem : 'accepted'}`,
  )
}

describe('evaluateAuthSecret', () => {
  it('accepts a long, varied secret', () => {
    assert.equal(evaluateAuthSecret(GOOD_SECRET).ok, true)
  })

  it('rejects an unset secret', () => {
    rejectsWith(undefined, 'absent')
  })

  it('rejects an empty secret', () => {
    rejectsWith('', 'absent')
  })

  it('rejects a whitespace-only secret rather than treating it as present', () => {
    // The tempting bug: a variable present but blank passes a truthiness check.
    rejectsWith('   ', 'absent')
  })

  it('rejects Better Auth\'s published fallback value', () => {
    // Long enough to pass a length check, and it is the exact value Better Auth would have
    // used on its own. Accepting it would defeat the guard entirely.
    assert.ok(
      BETTER_AUTH_FALLBACK_SECRET.length >= BETTER_AUTH_MIN_SECRET_LENGTH,
      'the fallback must be long enough that only the explicit check can catch it',
    )
    rejectsWith(BETTER_AUTH_FALLBACK_SECRET, 'fallback')
  })

  it('rejects a secret below the minimum length', () => {
    rejectsWith('a'.repeat(BETTER_AUTH_MIN_SECRET_LENGTH - 1), 'too-short')
  })

  it('accepts a secret exactly at the minimum length, and rejects a low-variety one', () => {
    // Boundary, so an off-by-one cannot silently tighten or loosen the contract.
    const atMinimum = 'abcdefghijklmnopqrstuvwxYZ012345'
    assert.equal(atMinimum.length, BETTER_AUTH_MIN_SECRET_LENGTH)
    assert.equal(evaluateAuthSecret(atMinimum).ok, true)

    // Also exactly at the minimum length, but only 2 distinct characters, so length alone
    // must not be what admits it.
    const lowVariety = 'ab'.repeat(16)
    assert.equal(lowVariety.length, BETTER_AUTH_MIN_SECRET_LENGTH)
    rejectsWith(lowVariety, 'low-entropy')
  })

  it('rejects a long secret with too few distinct characters', () => {
    // Long, but drawn from a handful of symbols, so it is not meaningfully random.
    rejectsWith('ab'.repeat(24), 'low-entropy')
  })

  it('explains why the fallback is unsafe, not merely that it is the default', () => {
    const verdict = evaluateAuthSecret(BETTER_AUTH_FALLBACK_SECRET)
    assert.equal(verdict.ok, false)
    assert.match(verdict.ok === false ? verdict.message : '', /forge/i)
  })

  it('names the variable in every rejection', () => {
    for (const secret of [undefined, '', '   ', BETTER_AUTH_FALLBACK_SECRET, 'short']) {
      const verdict = evaluateAuthSecret(secret)
      assert.equal(verdict.ok, false)
      assert.match(
        verdict.ok === false ? verdict.message : '',
        /BETTER_AUTH_SECRET/,
        `message for ${String(secret)} does not name the variable`,
      )
    }
  })
})

describe('assertAuthSecretConfigured in production', () => {
  it('throws for an unset secret', () => {
    assert.throws(() => assertAuthSecretConfigured(undefined, true), /BETTER_AUTH_SECRET/)
  })

  it('throws for the fallback secret', () => {
    assert.throws(
      () => assertAuthSecretConfigured(BETTER_AUTH_FALLBACK_SECRET, true),
      /forge/i,
    )
  })

  it('throws for a short secret', () => {
    assert.throws(() => assertAuthSecretConfigured('too-short', true), /at least 32/)
  })

  it('throws a message that tells the operator how to fix it', () => {
    assert.throws(
      () => assertAuthSecretConfigured(undefined, true),
      /openssl rand -base64 32/,
      'the error must be actionable, not just a rejection',
    )
  })

  it('does not throw for a good secret', () => {
    assert.doesNotThrow(() => assertAuthSecretConfigured(GOOD_SECRET, true))
  })
})

describe('assertAuthSecretConfigured outside production', () => {
  it('does not throw for an unset secret, so local work is not blocked', () => {
    assert.doesNotThrow(() => assertAuthSecretConfigured(undefined, false))
  })

  it('does not throw for a short secret', () => {
    assert.doesNotThrow(() => assertAuthSecretConfigured('dev', false))
  })

  it('does not throw for the fallback secret', () => {
    assert.doesNotThrow(() => assertAuthSecretConfigured(BETTER_AUTH_FALLBACK_SECRET, false))
  })

  it('still does not throw for a good secret', () => {
    assert.doesNotThrow(() => assertAuthSecretConfigured(GOOD_SECRET, false))
  })
})
