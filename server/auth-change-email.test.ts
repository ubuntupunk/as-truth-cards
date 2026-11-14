/**
 * Change-email must be enabled on the Better Auth instance, and the seam it uses
 * to mail the new address must exist.
 *
 * Enabling `user.changeEmail` without `emailVerification.sendVerificationEmail`
 * leaves the endpoint refusing every request ("Verification email isn't enabled"),
 * so the two are asserted together: this is the configuration contract the
 * Settings panel depends on.
 *
 * `betterAuth()` reads its options at construction, so the environment is set
 * before the module is imported. `node --test` runs each file in its own process,
 * giving this file a clean module registry.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

delete process.env.NODE_ENV
delete process.env.BETTER_AUTH_URL

const { auth } = await import('./auth.js')

/** The narrowed view of the Better Auth instance this test needs. */
const configured = auth as unknown as {
  options?: {
    user?: {
      changeEmail?: {
        enabled?: boolean
        updateEmailWithoutVerification?: boolean
      }
    }
    emailVerification?: { sendVerificationEmail?: unknown }
  }
}

describe('Better Auth change-email configuration', () => {
  it('enables email change', () => {
    assert.equal(configured.options?.user?.changeEmail?.enabled, true)
  })

  it('keeps the verification-first policy (no silent address swap)', () => {
    assert.notEqual(
      configured.options?.user?.changeEmail?.updateEmailWithoutVerification,
      true,
    )
  })

  it('has the verification-mail seam the endpoint requires', () => {
    assert.equal(
      typeof configured.options?.emailVerification?.sendVerificationEmail,
      'function',
    )
  })
})
