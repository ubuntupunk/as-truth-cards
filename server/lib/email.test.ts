import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createSendEmail, redactEmails } from './email.js'

/**
 * Email delivery failure semantics.
 *
 * `requireEmailVerification=false`, so email is not an access gate: sign-up and
 * password-reset requests must not be blocked (or misrepresented as successful)
 * when Resend is unconfigured or the provider fails. These tests pin that policy:
 * the sender never throws, reports `delivered: false`, and logs the failure.
 */

const OPTIONS = {
  to: 'user@example.com',
  subject: 'Verify your email address',
  text: 'click the link',
}

describe('sendEmail — unconfigured', () => {
  it('skips without attempting a send and never throws', async () => {
    let called = false
    const send = createSendEmail({
      getClient: () => {
        called = true
        return null
      },
      getFrom: () => 'noreply@example.com',
      log: () => undefined,
    })

    const result = await send(OPTIONS)
    assert.deepEqual(result, { delivered: false, skipped: 'unconfigured' })
    // getClient is the "is it configured" probe; it may run, but no send happens.
    assert.equal(called, true)
  })

  it('skips when only the from address is missing', async () => {
    const send = createSendEmail({
      getClient: () => ({ emails: { send: async () => ({}) } }),
      getFrom: () => undefined,
      log: () => undefined
    })
    const result = await send(OPTIONS)
    assert.equal(result.delivered, false)
    assert.equal(result.skipped, 'unconfigured')
  })

  it('logs the skip in every environment (an unconfigured sender is an incident)', async () => {
    const logged: unknown[][] = []
    const log = (...args: unknown[]) => logged.push(args)

    // The skip is logged unconditionally — production observability is required
    // because mail silently never sending is a production incident.
    const result = await createSendEmail({
      getClient: () => null,
      getFrom: () => undefined,
      log,
    })(OPTIONS)

    assert.equal(result.skipped, 'unconfigured')
    assert.equal(logged.length, 1)
  })
})

describe('sendEmail — provider failure', () => {
  it('reports a provider rejection without throwing (recoverable)', async () => {
    const logged: unknown[][] = []
    const send = createSendEmail({
      getClient: () => ({
        emails: {
          send: async () => ({ error: { message: 'domain not verified' } }),
        },
      }),
      getFrom: () => 'noreply@example.com',
      log: (...args: unknown[]) => logged.push(args)
    })

    const result = await send(OPTIONS)
    assert.equal(result.delivered, false)
    assert.ok(result.error)
    assert.equal(logged.length, 1)
  })

  it('reports a thrown transport error without throwing', async () => {
    const send = createSendEmail({
      getClient: () => ({
        emails: {
          send: async () => {
            throw new Error('network down')
          },
        },
      }),
      getFrom: () => 'noreply@example.com',
      log: () => undefined
    })

    const result = await send(OPTIONS)
    assert.equal(result.delivered, false)
    assert.ok(result.error instanceof Error)
  })
})

describe('email log privacy', () => {
  it('redactEmails replaces email-shaped text', () => {
    assert.equal(
      redactEmails('cannot deliver to user@example.com today'),
      'cannot deliver to [redacted] today',
    )
    assert.equal(redactEmails('no address here'), 'no address here')
  })

  it('does not log the recipient address when skipping unconfigured', async () => {
    const logged: unknown[][] = []
    await createSendEmail({
      getClient: () => null,
      getFrom: () => undefined,
      log: (...args: unknown[]) => logged.push(args),
    })(OPTIONS)

    assert.ok(
      !JSON.stringify(logged).includes(OPTIONS.to),
      'the unconfigured-skip log must not contain the recipient address',
    )
  })

  it('redacts a recipient address echoed in a provider error', async () => {
    const logged: unknown[][] = []
    await createSendEmail({
      getClient: () => ({
        emails: {
          send: async () => ({
            error: { message: `suppressed recipient ${OPTIONS.to}` },
          }),
        },
      }),
      getFrom: () => 'noreply@example.com',
      log: (...args: unknown[]) => logged.push(args),
    })(OPTIONS)

    const text = JSON.stringify(logged)
    assert.ok(!text.includes(OPTIONS.to), 'provider-error log must not leak the recipient')
    assert.ok(text.includes('[redacted]'), 'provider-error log should show the redaction')
  })

  it('redacts a recipient address echoed in a thrown transport error', async () => {
    const logged: unknown[][] = []
    await createSendEmail({
      getClient: () => ({
        emails: {
          send: async () => {
            throw new Error(`socket closed while writing ${OPTIONS.to}`)
          },
        },
      }),
      getFrom: () => 'noreply@example.com',
      log: (...args: unknown[]) => logged.push(args),
    })(OPTIONS)

    assert.ok(!JSON.stringify(logged).includes(OPTIONS.to))
  })
})

describe('sendEmail — success', () => {
  it('reports delivered when the provider accepts the message', async () => {
    let payload: unknown
    const send = createSendEmail({
      getClient: () => ({
        emails: {
          send: async (input: unknown) => {
            payload = input
            return { data: { id: 'abc' } }
          },
        },
      }),
      getFrom: () => 'noreply@example.com',
      log: () => undefined
    })

    const result = await send(OPTIONS)
    assert.equal(result.delivered, true)
    assert.deepEqual(payload, {
      from: 'noreply@example.com',
      to: 'user@example.com',
      subject: 'Verify your email address',
      text: 'click the link',
    })
  })

  it('sends an html body when one is provided', async () => {
    let payload: Record<string, unknown> | undefined
    const send = createSendEmail({
      getClient: () => ({
        emails: {
          send: async (input: unknown) => {
            payload = input as Record<string, unknown>
            return {}
          },
        },
      }),
      getFrom: () => 'noreply@example.com',
      log: () => undefined
    })

    await send({ ...OPTIONS, html: '<p>hi</p>' })
    assert.equal(payload?.html, '<p>hi</p>')
  })
})
