/**
 * Startup guard for `BETTER_AUTH_SECRET`.
 *
 * Better Auth will happily run without this variable. When `BETTER_AUTH_SECRET` is unset it
 * substitutes a hardcoded fallback that is published in its own source:
 *
 * ```js
 * // better-auth/dist/context/create-context.mjs
 * secret = legacySecret || "better-auth-secret-12345678901234567890";
 * ```
 *
 * Session cookies are signed with that value, so a public key means a forgeable cookie —
 * including one carrying the `ADMIN` role declared in `prisma/schema.prisma`.
 *
 * The dangerous property is that nothing fails. The server binds its port, `/health` returns
 * `200`, and `/api/auth/*` answers normally, so a deployment missing the secret is an
 * authentication bypass wearing a green health check rather than an outage anyone would
 * notice. `render.yaml` declares the variable, but a blueprint edit, a second host, or a
 * developer's local `.env` can each remove it, so the guarantee is enforced here at startup
 * instead of being left to documentation.
 */

/** Minimum secret length, matching Better Auth's own warning threshold. */
export const BETTER_AUTH_MIN_SECRET_LENGTH = 32

/**
 * The fallback Better Auth uses when `BETTER_AUTH_SECRET` is absent.
 *
 * Rejected explicitly even when it happens to satisfy the length check, because a secret that
 * is public in a dependency's source is not a secret at all.
 */
export const BETTER_AUTH_FALLBACK_SECRET = 'better-auth-secret-12345678901234567890'

/** Why a secret was rejected. Absent means unset or whitespace-only. */
export type AuthSecretProblem =
  | 'absent'
  | 'fallback'
  | 'too-short'
  | 'low-entropy'

/** The outcome of inspecting a secret. */
export type AuthSecretVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly problem: AuthSecretProblem; readonly message: string }

/**
 * Count distinct characters, the cheap half of an entropy estimate.
 *
 * Intentionally not a full Shannon entropy calculation: the goal is to reject an obviously
 * guessable value such as a repeated character or a dictionary word, not to certify a secret's
 * strength. A real secret is checked by length and by not being a well-known constant.
 */
function distinctCharacterCount(value: string): number {
  return new Set(value).size
}

/**
 * Inspect a candidate `BETTER_AUTH_SECRET`.
 *
 * Pure, so the production contract can be tested without mutating `process.env` or booting a
 * server.
 *
 * @param secret The candidate value, typically `process.env.BETTER_AUTH_SECRET`.
 * @returns `{ok: true}` when the secret is usable, otherwise the problem and a message.
 * @example
 * ```ts
 * const verdict = evaluateAuthSecret('short', true);
 * if (!verdict.ok) console.error(verdict.problem); // 'too-short'
 * ```
 */
export function evaluateAuthSecret(secret: string | undefined): AuthSecretVerdict {
  if (typeof secret !== 'string' || secret.trim() === '') {
    return {
      ok: false,
      problem: 'absent',
      message:
        'BETTER_AUTH_SECRET is not set. Better Auth falls back to a secret published in its ' +
        'own source, which makes session cookies forgeable.',
    }
  }

  if (secret === BETTER_AUTH_FALLBACK_SECRET) {
    return {
      ok: false,
      problem: 'fallback',
      message:
        'BETTER_AUTH_SECRET is set to Better Auth\'s built-in fallback value, which is ' +
        'published in its source. Session cookies signed with it can be forged.',
    }
  }

  if (secret.length < BETTER_AUTH_MIN_SECRET_LENGTH) {
    return {
      ok: false,
      problem: 'too-short',
      message:
        `BETTER_AUTH_SECRET is ${secret.length} characters; at least ` +
        `${BETTER_AUTH_MIN_SECRET_LENGTH} are required.`,
    }
  }

  // A long secret drawn from a handful of distinct characters is long but not random. This
  // mirrors Better Auth's own low-entropy warning, kept here so production fails rather than
  // merely warning.
  if (distinctCharacterCount(secret) < 8) {
    return {
      ok: false,
      problem: 'low-entropy',
      message:
        'BETTER_AUTH_SECRET uses fewer than 8 distinct characters, so it is long but not ' +
        'random. Generate one with: openssl rand -base64 32',
    }
  }

  return { ok: true }
}

/**
 * Enforce the secret contract at startup.
 *
 * In production an unusable secret throws, which stops the process before it binds a port. In
 * development it only warns: local work should not be blocked by a missing secret, and the
 * fallback is not a meaningful risk on a developer's machine.
 *
 * Called from `server/auth.ts` before `betterAuth()` is constructed, because ES module imports
 * are hoisted — an assertion placed in `server/index.ts` would run *after* the auth module had
 * already been evaluated.
 *
 * @param secret The candidate secret. Defaults to `process.env.BETTER_AUTH_SECRET`.
 * @param isProduction Whether to enforce or merely warn. Defaults to `NODE_ENV === 'production'`.
 * @throws {Error} In production, when the secret is absent or unusable.
 * @example
 * ```ts
 * assertAuthSecretConfigured();
 * export const auth = betterAuth({ ... });
 * ```
 */
export function assertAuthSecretConfigured(
  secret: string | undefined = process.env.BETTER_AUTH_SECRET,
  isProduction: boolean = process.env.NODE_ENV === 'production',
): void {
  const verdict = evaluateAuthSecret(secret)

  if (verdict.ok) return

  if (isProduction) {
    throw new Error(
      `${verdict.message}\n\n` +
        'Refusing to start in production with an unusable secret. Generate one with:\n' +
        '  openssl rand -base64 32\n' +
        'then set BETTER_AUTH_SECRET in the deployment environment (render.yaml declares ' +
        'it) and redeploy.',
    )
  }

  console.warn(
    `[auth] ${verdict.message}\n` +
      '[auth] Continuing because NODE_ENV is not "production". Never deploy this way.',
  )
}
