/**
 * Render tests for the Settings `EmailPanel`.
 *
 * The panel must be honest about the capability: the current address and its
 * verification state are visible, the form explains that the link goes to the
 * new address, a successful request is reported as "requested" rather than
 * "sent", and a field error is bound to the input rather than floating free.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { EmailPanel, type EmailPanelProps } from './email-panel'

/** A settled, verified panel with an empty form. */
const base: EmailPanelProps = {
  currentEmail: 'dav@example.org',
  emailVerified: true,
  value: '',
  fieldError: null,
  busy: false,
  error: null,
  status: null,
  onChange: () => undefined,
  onSubmit: () => undefined,
}

/**
 * Render the panel.
 *
 * @param overrides Props to change for one test.
 * @returns The rendered HTML.
 */
function renderPanel(overrides: Partial<EmailPanelProps> = {}): string {
  return render(<EmailPanel {...base} {...overrides} />)
}

describe('EmailPanel', () => {
  it('shows the current address and its verified state', () => {
    const html = renderPanel()
    assert.ok(html.includes('data-testid="current-email"'))
    assert.ok(html.includes('dav@example.org'))
    assert.ok(html.includes('Email verified'))
    assert.equal(
      html.includes('data-testid="email-panel-unverified-note"'),
      false,
    )
  })

  it('shows the unverified state and explains what that means for a change', () => {
    const html = renderPanel({ emailVerified: false })
    assert.ok(html.includes('Email not verified'))
    assert.ok(html.includes('data-testid="email-panel-unverified-note"'))
  })

  it('says the link goes to the new address and the change is not immediate', () => {
    const html = renderPanel()
    assert.ok(html.includes('mails a verification link to the new address'))
    assert.ok(html.includes('completes only when that link is opened'))
  })

  it('labels the field and binds its hint', () => {
    const html = renderPanel()
    assert.ok(html.includes('for="change-email"'))
    assert.ok(html.includes('id="change-email"'))
    assert.ok(html.includes('type="email"'))
    assert.ok(html.includes('aria-describedby="change-email-hint"'))
  })

  it('binds a field error to the input', () => {
    const html = renderPanel({
      fieldError: 'Enter a valid email address.',
      value: 'nope',
    })
    assert.ok(html.includes('aria-invalid="true"'))
    assert.ok(html.includes('change-email-field-error'))
    assert.ok(html.includes('Enter a valid email address.'))
  })

  it('disables the form and renames the action while a request is in flight', () => {
    const html = renderPanel({ busy: true })
    assert.ok(html.includes('Requesting…'))
    assert.ok(html.includes('disabled'))
  })

  it('reports an accepted request without claiming the mail was delivered', () => {
    const html = renderPanel({
      status:
        'If new@example.org can receive mail, a verification link is on its way. The change completes only when you open it.',
    })
    assert.ok(html.includes('data-testid="change-email-status"'))
    assert.ok(html.includes('role="status"'))
    assert.ok(html.includes('verification link is on its way'))
    assert.equal(html.toLowerCase().includes('email sent'), false)
  })

  it('surfaces a request failure as an alert', () => {
    const html = renderPanel({
      error:
        'For your security, changing your email needs a recent sign-in. Sign out, sign in again, then retry.',
    })
    assert.ok(html.includes('data-testid="change-email-error"'))
    assert.ok(html.includes('role="alert"'))
    assert.ok(html.includes('recent sign-in'))
  })
})
