/**
 * Trusted-origin policy, shared by CORS (`app.ts`) and the CSRF origin guard.
 *
 * CORS is a *browser* control: it decides whether the browser exposes a response.
 * It is **not** CSRF protection — a cross-site request still reaches the server
 * and still carries a cookie if the browser sends one. For state-changing routes
 * that rely on a session cookie we therefore refuse a request whose `Origin` is
 * present and not trusted, on the server side, independent of CORS. A request
 * with no `Origin` (non-browser client, or a same-origin navigation the browser
 * does not label) is allowed, matching Better Auth's own `trustedOrigins` rule.
 *
 * Keeping the origin list in one place means CORS and the guard cannot drift.
 */

import type { RequestHandler } from 'express'

/** The process-environment keys that shape the origin policy. */
export interface OriginEnv {
  NODE_ENV?: string
  BETTER_AUTH_URL?: string
  CORS_ORIGINS?: string
}

/**
 * The development origins trusted by default, mirroring the Better Auth
 * `trustedOrigins` list so CORS, Better Auth and the guard all agree.
 */
export const DEFAULT_TRUSTED_ORIGINS: readonly string[] = [
  'http://localhost:8080',
  'http://localhost:3001',
]

/**
 * Resolve the browser origins the API trusts.
 *
 * An explicit `CORS_ORIGINS` (comma-separated) replaces the *development*
 * defaults. The app's own production origin (derived from `BETTER_AUTH_URL`) is
 * **always kept** when running in production, even alongside an explicit
 * `CORS_ORIGINS`, so the same-origin account API can never be silently excluded
 * by a configuration change. In development without `CORS_ORIGINS` the known
 * localhost origins are used.
 *
 * @param env Injectable environment, defaulting to the process environment.
 * @returns A trimmed, de-duplicated list of origins; never contains a wildcard.
 */
export function resolveTrustedOrigins(env: OriginEnv = process.env): string[] {
  const selfOrigin =
    env.NODE_ENV === 'production' && env.BETTER_AUTH_URL
      ? [env.BETTER_AUTH_URL.replace(/\/+$/, '')]
      : []

  const explicit = env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
  if (explicit !== undefined && explicit.length > 0) {
    return [...new Set([...explicit, ...selfOrigin])]
  }

  return [...new Set([...DEFAULT_TRUSTED_ORIGINS, ...selfOrigin])]
}

/**
 * Whether a request `Origin` is trusted. An absent origin is allowed: browsers
 * omit it for same-origin navigations and non-browser clients do not send it, so
 * rejecting absence would break legitimate traffic without adding protection.
 *
 * @param origin The `Origin` header, if any.
 * @param trusted The trusted-origin list.
 * @returns `true` when the request may proceed.
 */
export function isTrustedOrigin(
  origin: string | undefined,
  trusted: readonly string[],
): boolean {
  return origin === undefined || trusted.includes(origin)
}

/** Methods that can change state and therefore need the origin guard. */
const STATEFUL_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Build an Express middleware that rejects untrusted cross-origin state changes.
 *
 * @param options.trustedOrigins Trusted list; defaults to {@link resolveTrustedOrigins}.
 * @param options.env Environment used to resolve the default list.
 * @returns A `RequestHandler` that 403s a stateful request with an untrusted Origin.
 */
export function createOriginGuard(options: {
  trustedOrigins?: readonly string[]
  env?: OriginEnv
} = {}): RequestHandler {
  const trusted = options.trustedOrigins ?? resolveTrustedOrigins(options.env)

  return (req, res, next) => {
    if (!STATEFUL_METHODS.has(req.method)) {
      next()
      return
    }
    const origin = req.get('origin') ?? undefined
    if (isTrustedOrigin(origin, trusted)) {
      next()
      return
    }
    res.status(403).json({ error: 'Cross-origin request rejected' })
  }
}
