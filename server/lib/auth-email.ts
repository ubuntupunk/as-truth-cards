/**
 * The two transactional messages Better Auth asks the product to send.
 *
 * They live here rather than inline in `server/auth.ts` so the copy is testable without
 * constructing an auth instance, and so the sponsor signature (bd `as-truth-cards-wab`) is
 * applied in exactly one place. Better Auth passes a fully-formed, environment-scoped `url`
 * (bd `as-truth-cards-4od`); this module never builds or rewrites it, only escapes it for the
 * HTML part.
 *
 * The plain-text body stays the primary form: it is what a text-only client, a notification
 * preview, or a paste into a terminal will show, and it keeps the bare URL visible.
 */

import { escapeHtml, withSponsorSignature } from './email-signature.js'

/** A composed message, minus the recipient (which comes from the user record). */
export interface AuthEmailMessage {
  readonly subject: string
  readonly text: string
  readonly html: string
}

/** The verification link a newly signed-up or unverified user must open. */
const VERIFICATION_SUBJECT = 'Verify your email address'

/** The reset link a signed-in-less user must open to choose a new password. */
const RESET_SUBJECT = 'Reset your password'

/**
 * Build the email-verification message.
 *
 * @param url Better Auth's signed, environment-scoped verification URL.
 * @returns Subject plus signed text and HTML bodies.
 * @example
 * ```ts
 * void sendEmail({ to: user.email, ...verificationEmail(url) })
 * ```
 */
export function verificationEmail(url: string): AuthEmailMessage {
  const { text, html } = withSponsorSignature({
    text: `Click the link to verify your email: ${url}`,
    html:
      '<p>Click the link to verify your email:</p>\n' +
      `<p><a href="${escapeHtml(url)}">Verify your email address</a></p>\n` +
      `<p style="font-size:13px;color:#555">If the link does not open, paste this address into your browser:<br />${escapeHtml(url)}</p>`,
  })
  return { subject: VERIFICATION_SUBJECT, text, html }
}

/**
 * Build the password-reset message.
 *
 * @param url Better Auth's signed, environment-scoped reset URL.
 * @returns Subject plus signed text and HTML bodies.
 * @example
 * ```ts
 * void sendEmail({ to: user.email, ...passwordResetEmail(url) })
 * ```
 */
export function passwordResetEmail(url: string): AuthEmailMessage {
  const { text, html } = withSponsorSignature({
    text:
      `Click the link to reset your password: ${url}\n\n` +
      'If you did not ask for this, you can ignore this message.',
    html:
      '<p>Click the link to reset your password:</p>\n' +
      `<p><a href="${escapeHtml(url)}">Reset your password</a></p>\n` +
      `<p style="font-size:13px;color:#555">If the link does not open, paste this address into your browser:<br />${escapeHtml(url)}</p>` +
      '\n<p style="font-size:13px;color:#555">If you did not ask for this, you can ignore this message.</p>',
  })
  return { subject: RESET_SUBJECT, text, html }
}
