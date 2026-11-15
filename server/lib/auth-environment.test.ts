/**
 * The `BETTER_AUTH_URL` / `NODE_ENV` topology contract (bd `as-truth-cards-4od`).
 *
 * What these tests protect is silent: Better Auth signs verification and password-reset tokens
 * as stateless JWTs, so a token minted under one secret is unusable under another. Nothing throws
 * when that happens — the reader just gets "invalid link" — so the only way to keep the rule is
 * to check the pairing before a process can mail anything, and to keep the reasoning in tests.
 *
 * Three failure shapes are covered: a link aimed at a host that cannot validate it, a
 * production process that emits loopback or plain-http links, and an origin that is not a URL
 * at all.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assertAuthEnvironmentConsistent,
  evaluateAuthEnvironment,
  isLoopbackHostname,
} from './auth-environment.js'

/** The problems reported for a pairing, in order. */
function problems(env: { NODE_ENV?: string; BETTER_AUTH_URL?: string }) {
  return evaluateAuthEnvironment(env).findings.map(
    (finding) => finding.problem,
  )
}

/** Capture everything written to stderr while `run` executes. */
function captureWarnings(run: () => void): string {
  const original = console.warn
  const lines: string[] = []
  console.warn = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  }
  try {
    run()
  } finally {
    console.warn = original
  }
  return lines.join('\n')
}

describe('isLoopbackHostname', () => {
  it('recognises the loopback forms a developer actually uses', () => {
    for (const host of [
      'localhost',
      'LOCALHOST',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'app.localhost',
    ]) {
      assert.equal(isLoopbackHostname(host), true, host)
    }
  })

  it('does not treat a public host as local', () => {
    for (const host of ['app.example', 'as-truth-cards.onrender.com', '10.0.0.5']) {
      assert.equal(isLoopbackHostname(host), false, host)
    }
  })
})

describe('evaluateAuthEnvironment', () => {
  it('accepts the documented development pairing', () => {
    const verdict = evaluateAuthEnvironment({
      NODE_ENV: 'development',
      BETTER_AUTH_URL: 'http://localhost:8080',
    })
    assert.equal(verdict.ok, true)
    assert.deepEqual(verdict.findings, [])
  })

  it('accepts the documented production pairing', () => {
    const verdict = evaluateAuthEnvironment({
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://as-truth-cards.onrender.com',
    })
    assert.equal(verdict.ok, true)
  })

  it('flags a dev process carrying the deployed origin', () => {
    // The exact shape that mails an unusable link: locally-signed token, remote host.
    assert.deepEqual(
      problems({
        NODE_ENV: 'development',
        BETTER_AUTH_URL: 'https://as-truth-cards.onrender.com',
      }),
      ['remote-origin-outside-production'],
    )
  })

  it('flags a production process pointing at loopback', () => {
    assert.deepEqual(
      problems({
        NODE_ENV: 'production',
        BETTER_AUTH_URL: 'http://localhost:8080',
      }),
      ['loopback-origin-in-production', 'insecure-origin-in-production'],
    )
  })

  it('flags plain http in production even when the host is public', () => {
    assert.deepEqual(
      problems({
        NODE_ENV: 'production',
        BETTER_AUTH_URL: 'http://app.example',
      }),
      ['insecure-origin-in-production'],
    )
  })

  it('flags a value that is not an absolute URL', () => {
    assert.deepEqual(
      problems({ NODE_ENV: 'production', BETTER_AUTH_URL: 'app.example' }),
      ['malformed-origin'],
    )
  })

  it('flags a missing origin', () => {
    assert.deepEqual(problems({ NODE_ENV: 'production' }), ['malformed-origin'])
    assert.deepEqual(problems({ NODE_ENV: 'production', BETTER_AUTH_URL: '  ' }), [
      'malformed-origin',
    ])
  })

  it('explains the token consequence, not just the setting', () => {
    const verdict = evaluateAuthEnvironment({
      NODE_ENV: 'development',
      BETTER_AUTH_URL: 'https://app.example',
    })
    assert.match(verdict.findings[0].message, /not valid in another environment/)
  })
})

describe('assertAuthEnvironmentConsistent in production', () => {
  it('refuses to start with a loopback origin', () => {
    assert.throws(
      () =>
        assertAuthEnvironmentConsistent(
          { NODE_ENV: 'production', BETTER_AUTH_URL: 'http://localhost:8080' },
          true,
        ),
      /Refusing to start in production/,
    )
  })

  it('refuses to start with a missing origin', () => {
    assert.throws(
      () => assertAuthEnvironmentConsistent({ NODE_ENV: 'production' }, true),
      /BETTER_AUTH_URL is not set/,
    )
  })

  it('starts with the deployed https origin', () => {
    assert.doesNotThrow(() =>
      assertAuthEnvironmentConsistent(
        {
          NODE_ENV: 'production',
          BETTER_AUTH_URL: 'https://as-truth-cards.onrender.com',
        },
        true,
      ),
    )
  })
})

describe('assertAuthEnvironmentConsistent outside production', () => {
  it('warns rather than blocking a deliberate remote origin', () => {
    let warning = ''
    assert.doesNotThrow(() => {
      warning = captureWarnings(() =>
        assertAuthEnvironmentConsistent(
          {
            NODE_ENV: 'development',
            BETTER_AUTH_URL: 'https://app.example',
          },
          false,
        ),
      )
    })
    assert.match(warning, /environment-scoped/)
  })

  it('stays quiet for the local pairing', () => {
    let warning = ''
    assert.doesNotThrow(() => {
      warning = captureWarnings(() =>
        assertAuthEnvironmentConsistent(
          {
            NODE_ENV: 'development',
            BETTER_AUTH_URL: 'http://localhost:8080',
          },
          false,
        ),
      )
    })
    assert.equal(warning, '')
  })
})
