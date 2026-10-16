/**
 * Pure logic for the sign-in / sign-up journey.
 *
 * Extracted from the page components so the parts that decide *where the user
 * goes* and *what they are told* can be unit-tested without a DOM, a router or a
 * live auth server — while still being exactly the functions the components call.
 *
 * Two things matter here and are easy to get wrong:
 *
 * 1. **Open-redirect safety.** `returnTo` arrives from the query string, i.e. from
 *    an attacker-controllable URL. `returnTo.startsWith('/')` is *not* enough: a
 *    browser resolves `//evil.example` and `/\evil.example` as absolute URLs on
 *    another origin. {@link safeReturnTo} rejects those, plus absolute URLs and
 *    control/whitespace characters.
 * 2. **Validation the test can see.** The forms rely on native `required`/
 *    `minLength`, which the SSR test harness does not enforce, so validation is
 *    duplicated as pure predicates that are the source of truth for messages.
 */

/** Where an authenticated user lands when no valid `returnTo` is supplied. */
export const DEFAULT_RETURN_TO = '/account'

/** Minimum password length, shared with the form's `minLength` attribute. */
export const MIN_PASSWORD_LENGTH = 8

/**
 * True when the string contains a control character: C0 (U+0000–U+001F),
 * DEL (U+007F) or C1 (U+0080–U+009F).
 *
 * C1 matters as much as C0 here: some parsers/normalisers treat C1 bytes as
 * control separators, so a value that *looks* like a path can be re-interpreted
 * downstream. Rejecting both ranges keeps the implementation honest with the
 * documented policy.
 */
function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
    if (code >= 0x80 && code <= 0x9f) return true
  }
  return false
}

/**
 * Sanitise a `returnTo` query value to a same-origin, path-only destination.
 *
 * Policy: the value is used **verbatim** — it is not trimmed. Any leading or
 * trailing whitespace, or whitespace anywhere in the value, is a malformed
 * destination and falls back. This is deliberate: silently trimming would mask a
 * tampered value, and the caller already sends a clean path.
 *
 * @param value The raw `returnTo` value (untrusted).
 * @param fallback Destination to use when `value` is missing or unsafe.
 * @returns A safe, leading-slash path — never an absolute or protocol-relative URL.
 * @example
 * ```ts
 * safeReturnTo('/research?card=x') // => '/research?card=x'
 * safeReturnTo('//evil.example')   // => '/account'
 * safeReturnTo('https://evil.example') // => '/account'
 * safeReturnTo(' /account')        // => '/account' (whitespace rejected)
 * ```
 */
export function safeReturnTo(
  value: unknown,
  fallback: string = DEFAULT_RETURN_TO,
): string {
  if (typeof value !== 'string') return fallback
  if (value === '' || !value.startsWith('/')) return fallback
  // '//host' and '/\host' are resolved by browsers as scheme-relative to another origin.
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  // Whitespace (incl. leading/trailing), backslashes and control characters all
  // make the target ambiguous or tampered-looking, so they fall back.
  if (/\s/.test(value)) return fallback
  if (value.includes('\\')) return fallback
  if (hasControlCharacter(value)) return fallback
  return value
}

/** Per-field validation messages; a field is valid when its key is absent. */
export interface FieldErrors {
  name?: string
  email?: string
  password?: string
}

/** Result of a validation pass. */
export interface Validation {
  ok: boolean
  errors: FieldErrors
  /** The first field message, for a single banner; `null` when valid. */
  message: string | null
}

/** A pragmatic email shape check: one `@`, a dot in the domain, no whitespace. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate the sign-up form.
 *
 * @param values The field values as entered.
 * @returns A {@link Validation}; on failure `message` is the first field message.
 */
export function validateSignUp(values: {
  name: string
  email: string
  password: string
}): Validation {
  const errors: FieldErrors = {}
  if (values.name.trim() === '') errors.name = 'Enter your name'
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address'
  }
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  return finish(errors)
}

/**
 * Validate the sign-in form. Only presence is required — the server owns the
 * password policy and it must not be leaked through client-side rules.
 *
 * @param values The field values as entered.
 * @returns A {@link Validation}.
 */
export function validateSignIn(values: {
  email: string
  password: string
}): Validation {
  const errors: FieldErrors = {}
  if (values.email.trim() === '') errors.email = 'Enter your email address'
  if (values.password === '') errors.password = 'Enter your password'
  return finish(errors)
}

/** Collapse a field-error map into a {@link Validation}. */
function finish(errors: FieldErrors): Validation {
  const message = errors.name ?? errors.email ?? errors.password ?? null
  return { ok: message === null, errors, message }
}

/** The shape of a Better Auth client response we care about. */
interface AuthResponse {
  error?: { message?: string } | null
}

/** The minimal client surface {@link submitSignIn} uses (structural, for fakes). */
export interface EmailSignInClient {
  signIn: {
    email(input: { email: string; password: string }): Promise<AuthResponse>
  }
}

/** The minimal client surface {@link submitSignUp} uses (structural, for fakes). */
export interface EmailSignUpClient {
  signUp: {
    email(input: {
      name: string
      email: string
      password: string
    }): Promise<AuthResponse>
  }
}

/**
 * The decision a submit produces: navigate somewhere, or show an error.
 *
 * Deliberately a plain interface rather than a discriminated union: this project
 * compiles with `strict: false` / `strictNullChecks` off, under which TS does not
 * reliably narrow `ok`-tagged unions, so `outcome.redirect`/`outcome.error` are
 * optional instead.
 */
export interface AuthOutcome {
  ok: boolean
  redirect?: string
  error?: string
}

/**
 * Run the sign-in submit: validate, call the auth client, decide the next step.
 *
 * @param client A Better Auth client (or a fake with the same shape).
 * @param values The field values.
 * @param returnTo The raw `returnTo` query value, if any.
 * @returns `{ ok: true, redirect }` on success, else `{ ok: false, error }`.
 */
export async function submitSignIn(
  client: EmailSignInClient,
  values: { email: string; password: string },
  returnTo?: string | null,
): Promise<AuthOutcome> {
  const validation = validateSignIn(values)
  if (!validation.ok) {
    return { ok: false, error: validation.message ?? 'Failed to sign in' }
  }

  try {
    const result = await client.signIn.email({
      email: values.email.trim(),
      password: values.password,
    })
    if (result?.error) {
      return { ok: false, error: result.error.message || 'Failed to sign in' }
    }
    return { ok: true, redirect: safeReturnTo(returnTo) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to sign in',
    }
  }
}

/**
 * Run the sign-up submit: validate, call the auth client, decide the next step.
 *
 * @param client A Better Auth client (or a fake with the same shape).
 * @param values The field values.
 * @param returnTo The raw `returnTo` query value, if any.
 * @returns `{ ok: true, redirect }` on success, else `{ ok: false, error }`.
 */
export async function submitSignUp(
  client: EmailSignUpClient,
  values: { name: string; email: string; password: string },
  returnTo?: string | null,
): Promise<AuthOutcome> {
  const validation = validateSignUp(values)
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.message ?? 'Failed to create account',
    }
  }

  try {
    const result = await client.signUp.email({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    })
    if (result?.error) {
      return {
        ok: false,
        error: result.error.message || 'Failed to create account',
      }
    }
    return { ok: true, redirect: safeReturnTo(returnTo) }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Failed to create account',
    }
  }
}
