import { Resend } from 'resend'

/**
 * Transactional email via Resend.
 *
 * Failure policy (deliberate, and tied to the verification policy in
 * `server/auth.ts`): sending email is **best-effort and never throws**. Sign-up,
 * password-reset requests and verification resends proceed even when Resend is
 * unconfigured or the provider rejects/throws, because
 * `requireEmailVerification=false` means email verification is not an access
 * gate. The caller (`auth.ts`) uses `void sendEmail(...)`, so a thrown error here
 * would surface only as an unhandled rejection while the user still believes the
 * action succeeded. Instead we return a {@link EmailDeliveryResult} and log the
 * failure loudly, so the outcome is observable and the user can recover by
 * retrying (e.g. "resend verification" / "forgot password") once delivery is
 * configured. Nothing here should ever be reported to the user as "sent".
 *
 * Observability is deliberate: an unconfigured sender is a *production incident*
 * (mail silently never sends), so it is logged in **every** environment rather
 * than only during development. Provider rejections and thrown transport errors
 * are logged too. No failure path is silent.
 *
 * Log privacy is deliberate too: application logs are not an approved store for
 * recipient PII, so no log line includes the `to` address. Failures are recorded
 * as a stable event identifier plus non-sensitive metadata (the app-defined
 * subject), and any provider/transport message is passed through
 * {@link redactEmails} so an address embedded in an error cannot leak either.
 */

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

/** What actually happened to a send attempt. */
export interface EmailDeliveryResult {
  /** True only when the provider accepted the message. */
  delivered: boolean
  /** Set when no attempt was made because Resend is not configured. */
  skipped?: 'unconfigured'
  /** The provider error or thrown value, when the attempt failed. */
  error?: unknown
}

/** The slice of the Resend client this module uses; narrowed for test fakes. */
interface EmailClient {
  emails: {
    send(input: {
      from: string
      to: string | string[]
      subject: string
      html?: string
      text?: string
    }): Promise<{ error?: unknown; data?: unknown } | null | undefined>
  }
}

/** Injectable seams; production omits them and the real Resend client is used. */
export interface EmailDeps {
  /** Resolves the client, or `null` when Resend is not configured. */
  readonly getClient?: () => EmailClient | null
  /** Resolves the `from` address, or `undefined` when not configured. */
  readonly getFrom?: () => string | undefined
  /** Logger; defaults to `console.error`. */
  readonly log?: (...args: unknown[]) => void
}

/**
 * Replace anything email-shaped with `[redacted]`.
 *
 * Applied to log text only — never to the `to` argument of an actual send — so a
 * recipient address that a provider error happens to echo is not written to the
 * logs. The delivery result still carries the raw error for the caller.
 *
 * @param value Arbitrary log text.
 * @returns The text with email addresses replaced by `[redacted]`.
 */
export function redactEmails(value: string): string {
  return value.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[redacted]')
}

/** Render a non-PII, single-line description of a provider/transport failure. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${redactEmails(error.message)}`
  }
  if (typeof error === 'string') return redactEmails(error)
  try {
    return redactEmails(JSON.stringify(error))
  } catch {
    return '[unserializable error]'
  }
}

let resend: Resend | null = null

/** The default client resolver: a lazily-created singleton Resend instance. */
function defaultGetClient(): EmailClient | null {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) return null
  if (!resend) {
    resend = new Resend(apiKey)
  }
  // Resend's `emails.send` is typed against a discriminated union that is stricter
  // than the narrow slice we call; the cast bridges that declaration gap only.
  return resend as unknown as EmailClient
}

/**
 * Build a `sendEmail` bound to the given dependencies.
 *
 * @param deps Optional seams; production omits them.
 * @returns A best-effort sender that never throws and reports its outcome.
 */
export function createSendEmail(
  deps: EmailDeps = {},
): (options: SendEmailOptions) => Promise<EmailDeliveryResult> {
  const getClient = deps.getClient ?? defaultGetClient
  const getFrom = deps.getFrom ?? (() => process.env.RESEND_FROM)
  const log = deps.log ?? console.error

  return async function sendEmail(
    options: SendEmailOptions,
  ): Promise<EmailDeliveryResult> {
    const { to, subject, text, html } = options
    const client = getClient()
    const from = getFrom()

    if (!client || !from) {
      // Do not throw (email flows are best-effort), but never skip silently: an
      // unconfigured sender in production means mail is silently never sent, so
      // this is logged in every environment as an operational signal. `to` is
      // deliberately omitted — see the log-privacy note in the module docs.
      log('[email] Resend not configured; skipping send', {
        event: 'email.skipped_unconfigured',
        subject,
      })
      return { delivered: false, skipped: 'unconfigured' }
    }

    // Resend's `CreateEmailOptions` requires at least one *defined* render field
    // (`html`, `text` or `react`). Build the body so exactly one branch is satisfied.
    const body = html !== undefined ? { html, text } : { text: text ?? '' }

    try {
      const result = await client.emails.send({
        from,
        to,
        subject,
        ...body,
      })
      if (result?.error) {
        log('[email] Resend rejected the send', {
          event: 'email.provider_rejected',
          subject,
          error: describeError(result.error),
        })
        return { delivered: false, error: result.error }
      }
      return { delivered: true }
    } catch (error) {
      // Network/transport failure: recoverable, never fatal to the auth flow.
      log('[email] Resend send threw', {
        event: 'email.send_threw',
        subject,
        error: describeError(error),
      })
      return { delivered: false, error }
    }
  }
}

/** The production sender. Callers `void` it; it never rejects. */
export const sendEmail = createSendEmail()
