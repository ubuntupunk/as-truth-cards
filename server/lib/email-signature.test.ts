/**
 * The sponsor signature contract (bd `as-truth-cards-wab`).
 *
 * Every message the product sends carries the sponsor line, because the sending domain
 * (`medialternatives.com`) is an in-kind sponsor and a recipient should be able to find it.
 * The failure this guards is quiet: a refactor of the body builders drops the footer, and
 * nothing breaks except the attribution — which is exactly the thing that must not silently
 * disappear. These tests also pin the URL escaping, because an unescaped `&` in a verification
 * link truncates the token in some mail clients.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SPONSOR_NAME,
  SPONSOR_SENTENCE,
  SPONSOR_URL,
  escapeHtml,
  withSponsorSignature,
} from './email-signature.js'

describe('withSponsorSignature', () => {
  it('appends the sentence and a usable URL to the plain-text body', () => {
    const { text } = withSponsorSignature({ text: 'Click the link: https://app.example/x' })

    assert.ok(text.startsWith('Click the link: https://app.example/x'))
    assert.ok(text.includes(SPONSOR_SENTENCE))
    assert.ok(text.includes(SPONSOR_URL))
  })

  it('links the sponsor name in the HTML body', () => {
    const { html } = withSponsorSignature({
      text: 'Click the link',
      html: '<p>Click the link</p>',
    })

    assert.ok(html.includes('<p>Click the link</p>'))
    assert.ok(html.includes(`<a href="${SPONSOR_URL}">${SPONSOR_NAME}</a>`))
    assert.equal((html.match(/<a /g) ?? []).length, 1)
  })

  it('renders a text-only body as paragraphs rather than dropping the HTML part', () => {
    const { html } = withSponsorSignature({ text: 'First line\nSecond line' })

    assert.ok(html.includes('<p>First line<br />Second line</p>'))
    assert.ok(html.includes(SPONSOR_NAME))
  })

  it('escapes text so a body cannot inject markup', () => {
    const { html } = withSponsorSignature({ text: '<script>alert(1)</script>' })

    assert.ok(!html.includes('<script>'))
    assert.ok(html.includes('&lt;script&gt;'))
  })

  it('always uses the same public URL, not a relative or apex variant', () => {
    assert.equal(SPONSOR_URL, 'https://www.medialternatives.com/')
    const { text, html } = withSponsorSignature({ text: 'body' })
    assert.equal((text.match(/https:\/\/www\.medialternatives\.com\//g) ?? []).length, 1)
    assert.equal((html.match(/https:\/\/www\.medialternatives\.com\//g) ?? []).length, 1)
  })
})

describe('escapeHtml', () => {
  it('keeps a query string intact as an attribute value', () => {
    assert.equal(
      escapeHtml('https://app.example/verify?token=a&callbackURL=b'),
      'https://app.example/verify?token=a&amp;callbackURL=b',
    )
  })

  it('neutralises quote characters that would close an attribute', () => {
    assert.equal(escapeHtml('" onmouseover="x'), '&quot; onmouseover=&quot;x')
    assert.equal(escapeHtml("it's"), 'it&#39;s')
  })
})
