/**
 * The two auth messages (bd `as-truth-cards-wab`).
 *
 * Better Auth hands over a signed URL; the product owns the copy around it. Two properties
 * matter and neither is visible from the auth flow: the recipient must get the exact URL
 * Better Auth signed (unescaped in text, escaped only inside HTML attributes), and the sponsor
 * signature must be on both messages. The reset message also has to remain honest for someone
 * who did not request it.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { passwordResetEmail, verificationEmail } from './auth-email.js'
import { SPONSOR_SENTENCE, SPONSOR_URL } from './email-signature.js'

/** A realistic Better Auth URL: two query parameters, so escaping is exercised. */
const URL_WITH_QUERY =
  'https://as-truth-cards.onrender.com/api/auth/verify-email?token=abc123&callbackURL=%2Faccount'

describe('verificationEmail', () => {
  it('names what to do and carries the exact signed URL in text', () => {
    const message = verificationEmail(URL_WITH_QUERY)

    assert.equal(message.subject, 'Verify your email address')
    assert.ok(message.text.includes(URL_WITH_QUERY))
  })

  it('escapes the URL only inside the HTML attribute', () => {
    const message = verificationEmail(URL_WITH_QUERY)

    assert.ok(message.html.includes('&amp;callbackURL='))
    assert.ok(!message.html.includes('?token=abc123&callbackURL'))
    assert.equal((message.html.match(/Verify your email address/g) ?? []).length >= 1, true)
  })

  it('carries the sponsor signature in both parts', () => {
    const message = verificationEmail(URL_WITH_QUERY)

    assert.ok(message.text.includes(SPONSOR_SENTENCE))
    assert.ok(message.text.includes(SPONSOR_URL))
    assert.ok(message.html.includes(SPONSOR_URL))
  })
})

describe('passwordResetEmail', () => {
  it('names the reset action and carries the exact signed URL in text', () => {
    const message = passwordResetEmail(URL_WITH_QUERY)

    assert.equal(message.subject, 'Reset your password')
    assert.ok(message.text.includes(URL_WITH_QUERY))
  })

  it('carries the sponsor signature in both parts', () => {
    const message = passwordResetEmail(URL_WITH_QUERY)

    assert.ok(message.text.includes(SPONSOR_SENTENCE))
    assert.ok(message.html.includes(SPONSOR_URL))
  })

  it('tells a recipient who did not request it that they can ignore it', () => {
    const message = passwordResetEmail(URL_WITH_QUERY)

    assert.ok(/did not ask for this/i.test(message.text))
    assert.ok(/did not ask for this/i.test(message.html))
  })
})
