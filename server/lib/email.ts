import { Resend } from 'resend'

let resend: Resend | null = null

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) return null
  if (!resend) {
    resend = new Resend(apiKey)
  }
  return resend
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { to, subject, text, html } = options
  const client = getResend()
  const from = process.env.RESEND_FROM
  if (!client || !from) {
    // In development/test without Resend configured, do not throw; log via console.error to
    // make missing config obvious without crashing flows that expect optional email delivery.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[email] Resend not configured; skipping send:', { to, subject })
    }
    return
  }
  await client.emails.send({
    from,
    to,
    subject,
    text,
    html,
  })
}
