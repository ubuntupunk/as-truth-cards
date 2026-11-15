/**
 * The sponsor signature carried by every message the product sends.
 *
 * Transactional mail leaves from `medialternatives.com`, a domain verified in Resend with
 * sending enabled (bd `as-truth-cards-wab`). That domain is an in-kind sponsor of the project,
 * so the line is part of the message contract rather than decoration: every recipient is told
 * who makes the mail possible and where to find them.
 *
 * One module for the sentence, the URL, and both renderings means the plain-text and HTML
 * forms cannot drift, and a future digest (bd `as-truth-cards-sm0`) reuses this signature
 * instead of inventing a second one.
 *
 * Escaping is deliberate. A verification URL is query-string heavy (`?token=…&callbackURL=…`),
 * so it must be escaped before it becomes `href` text; mail clients are lenient, but the
 * `&` would otherwise start an entity and truncate the link.
 */

/** Where the sponsor line points. Apex redirects here, so link the canonical host. */
export const SPONSOR_URL = 'https://www.medialternatives.com/'

/** The sponsor's display name, as used on their own site. */
export const SPONSOR_NAME = 'Medialternatives'

/** The sentence before the link is added; kept whole so text and HTML cannot diverge. */
const SPONSOR_PREFIX = 'Trope Deck is proudly sponsored by'

/** The exact plain-text sponsor sentence, including the trailing full stop. */
export const SPONSOR_SENTENCE = `${SPONSOR_PREFIX} ${SPONSOR_NAME}.`

/** A message body before the sponsor signature is appended. */
export interface EmailBody {
  /** Required: the plain-text body, which is also the fallback for the HTML part. */
  readonly text: string
  /** Optional HTML body; when absent, `text` is rendered as paragraphs. */
  readonly html?: string
}

/** A finished message body with the sponsor signature appended. */
export interface SignedEmailBody {
  readonly text: string
  readonly html: string
}

/**
 * Escape text for use as HTML content or inside a double-quoted attribute.
 *
 * @param value Raw text or a URL.
 * @returns The value with `&`, `<`, `>`, `"` and `'` replaced by entities.
 * @example
 * ```ts
 * escapeHtml('https://app.example/verify?token=a&callback=b')
 * // 'https://app.example/verify?token=a&amp;callback=b'
 * ```
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Render a plain-text body as HTML paragraphs, preserving its line breaks. */
function paragraphsFromText(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('\n')
}

/**
 * Append the sponsor signature to a message body.
 *
 * The plain-text form puts the sentence on its own line above the URL (so terminal and
 * text-only clients still show a usable link); the HTML form links the sponsor name.
 *
 * @param body The body to sign. `html` is optional and falls back to `text`.
 * @returns Both renderings, each ending with the sponsor line.
 * @example
 * ```ts
 * const { text, html } = withSponsorSignature({ text: 'Verify your email: https://…' })
 * // text ends with "\n\n--\nTrope Deck is proudly sponsored by Medialternatives.\nhttps://…"
 * ```
 */
export function withSponsorSignature(body: EmailBody): SignedEmailBody {
  const text = `${body.text.trimEnd()}\n\n--\n${SPONSOR_SENTENCE}\n${SPONSOR_URL}\n`

  const content = body.html ?? paragraphsFromText(body.text)
  const html =
    `${content}\n` +
    '<hr />\n' +
    '<p style="font-size:13px;color:#555;margin:16px 0 0">' +
    `${SPONSOR_PREFIX} <a href="${SPONSOR_URL}">${SPONSOR_NAME}</a>.` +
    '</p>\n'

  return { text, html }
}
