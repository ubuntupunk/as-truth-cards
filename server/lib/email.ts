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
      // this is logged in every environment as an operational signal.
      log('[email] Resend not configured; skipping send:', { to, subject })
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
        log('[email] Resend rejected the send:', result.error)
        return { delivered: false, error: result.error }
      }
      return { delivered: true }
    } catch (error) {
      // Network/transport failure: recoverable, never fatal to the auth flow.
      log('[email] Resend send threw:', error)
      return { delivered: false, error }
    }
  }
}

/** The production sender. Callers `void` it; it never rejects. */
export const sendEmail = createSendEmail()
