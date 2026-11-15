/**
 * Environment topology for `BETTER_AUTH_URL`, and the reason it is not merely configuration.
 *
 * Better Auth 1.7.6 signs email-verification and password-reset tokens as **stateless JWTs**
 * with `BETTER_AUTH_SECRET`; there is no server-side token table, so nothing can be "migrated"
 * or re-issued after the fact. A token is valid only against the secret that signed it. Two
 * consequences follow, and this module turns both into something the process checks:
 *
 * 1. **Tokens are environment-scoped.** A link minted by a local dev server (its own secret)
 *    and pointing at the deployed origin fails validation there, and vice versa. The failure is
 *    a dead link in an email: nothing throws, nothing logs, and the reader is simply told their
 *    verification link is invalid. The mismatch that actually creates such a link is a
 *    non-production process carrying a remote `BETTER_AUTH_URL` — so that pairing is called out
 *    at startup.
 * 2. **The origin must be the one users actually reach, over https.** A production process with
 *    a loopback `BETTER_AUTH_URL` builds links no reader can open, and Better Auth will not mark
 *    cookies `Secure` behind an `http://` base URL. Both are invisible from `/health`.
 *
 * The topology decision (bd `as-truth-cards-4od`): **one secret per environment, never shared.**
 * A leaked development secret must not be able to mint tokens a deployed server will accept,
 * and rotating one environment must not sign every other environment out. The cost is that a
 * link belongs to the environment that sent it, which is the rule documented in the README and
 * `.env.example`.
 *
 * Deliberately separate from {@link assertAuthSecretConfigured}: that guard answers "is this
 * secret usable", this one answers "is it the right secret for the way this process is being
 * run". Keeping them apart means the security-critical secret check can fail the process
 * without depending on origin parsing.
 */

/** The process-environment keys that shape token validity. */
export interface AuthEnvironmentEnv {
  NODE_ENV?: string
  BETTER_AUTH_URL?: string
}

/** Why an environment pairing cannot produce a usable link. */
export type AuthEnvironmentProblem =
  | 'malformed-origin'
  | 'loopback-origin-in-production'
  | 'insecure-origin-in-production'
  | 'remote-origin-outside-production'

/** One problem plus the sentence explaining what breaks and how to fix it. */
export interface AuthEnvironmentFinding {
  readonly problem: AuthEnvironmentProblem
  readonly message: string
}

/** The outcome of inspecting the pairing. `ok` is false when any finding exists. */
export interface AuthEnvironmentVerdict {
  readonly ok: boolean
  readonly findings: readonly AuthEnvironmentFinding[]
  /** The parsed origin, when `BETTER_AUTH_URL` parsed at all. */
  readonly origin?: URL
}

/** Hostnames that mean "this machine", where a locally-signed token belongs. */
const LOOPBACK_HOSTNAMES: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]

/**
 * Whether a hostname names the local machine.
 *
 * `*.localhost` is included because browsers resolve it to loopback by specification, and
 * developers do use it (`app.localhost:8080`). Docker's `host.docker.internal` is not loopback
 * for the container that serves mail links, so it is deliberately not treated as local: a link
 * built on it is as unreachable to a reader as any other private host.
 *
 * @param hostname A URL hostname, as returned by the `URL` parser.
 * @returns `true` for loopback and `*.localhost`.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const normalised = hostname.toLowerCase()
  return (
    LOOPBACK_HOSTNAMES.includes(normalised) ||
    normalised.endsWith('.localhost')
  )
}

/**
 * Inspect the `BETTER_AUTH_URL` / `NODE_ENV` pairing.
 *
 * Pure: no environment is read and nothing is logged, so every branch is testable without
 * booting a server or mutating `process.env`.
 *
 * @param env Injectable environment, typically `process.env`.
 * @returns A {@link AuthEnvironmentVerdict}; `findings` is empty when the pairing is coherent.
 * @example
 * ```ts
 * // A dev server pointing at the deployed origin: links it mails will not validate there.
 * evaluateAuthEnvironment({ NODE_ENV: 'development', BETTER_AUTH_URL: 'https://app.example' })
 *   .findings[0].problem // 'remote-origin-outside-production'
 * ```
 */
export function evaluateAuthEnvironment(
  env: AuthEnvironmentEnv,
): AuthEnvironmentVerdict {
  const raw = env.BETTER_AUTH_URL?.trim()
  if (raw === undefined || raw === '') {
    return {
      ok: false,
      findings: [
        {
          problem: 'malformed-origin',
          message:
            'BETTER_AUTH_URL is not set. Better Auth needs it to build the links in ' +
            'verification and password-reset email, so those messages cannot be sent.',
        },
      ],
    }
  }

  let origin: URL
  try {
    origin = new URL(raw)
  } catch {
    return {
      ok: false,
      findings: [
        {
          problem: 'malformed-origin',
          message:
            `BETTER_AUTH_URL is "${raw}", which is not an absolute URL. It must include ` +
            'the scheme and host, e.g. http://localhost:8080 or https://app.example.',
        },
      ],
    }
  }

  const isProduction = env.NODE_ENV === 'production'
  const loopback = isLoopbackHostname(origin.hostname)
  const findings: AuthEnvironmentFinding[] = []

  if (isProduction && loopback) {
    findings.push({
      problem: 'loopback-origin-in-production',
      message:
        `BETTER_AUTH_URL is ${origin.origin} while NODE_ENV is "production". Every ` +
        'verification and password-reset link would point at this machine instead of the ' +
        'deployed host, so no reader could open one. Set BETTER_AUTH_URL to the public ' +
        'origin of this deployment.',
    })
  }

  if (isProduction && origin.protocol !== 'https:') {
    findings.push({
      problem: 'insecure-origin-in-production',
      message:
        `BETTER_AUTH_URL is ${origin.origin}, which is not https. Production links would ` +
        'be mailed over plain http, and Better Auth will not mark session cookies Secure ' +
        'behind an insecure base URL.',
    })
  }

  if (!isProduction && !loopback) {
    findings.push({
      problem: 'remote-origin-outside-production',
      message:
        `BETTER_AUTH_URL is ${origin.origin} while NODE_ENV is "${
          env.NODE_ENV ?? 'undefined'
        }". ` +
        'Verification and password-reset tokens are signed with this environment\'s ' +
        'BETTER_AUTH_SECRET and are not valid in another environment, so a link sent from ' +
        'here will fail on that host. Point BETTER_AUTH_URL at the local origin ' +
        '(http://localhost:8080) or run the mail flow in the target environment.',
    })
  }

  return { ok: findings.length === 0, findings, origin }
}

/**
 * Apply the topology check at startup.
 *
 * In production a loopback or non-https origin **throws**, because the process would otherwise
 * come up healthy while mailing links nobody can open. Outside production it **warns**: a
 * developer may deliberately point at a remote origin to reproduce a bug, and local work must
 * not be blocked — but the consequence has to be visible before they report "the link is
 * broken".
 *
 * @param env Injectable environment. Defaults to the process environment.
 * @param isProduction Whether to enforce or merely warn. Defaults to `NODE_ENV === 'production'`.
 * @throws {Error} In production, when the origin cannot serve real links.
 * @example
 * ```ts
 * assertAuthEnvironmentConsistent()
 * export const auth = betterAuth({ ... })
 * ```
 */
export function assertAuthEnvironmentConsistent(
  env: AuthEnvironmentEnv = process.env,
  isProduction: boolean = process.env.NODE_ENV === 'production',
): void {
  const verdict = evaluateAuthEnvironment(env)
  if (verdict.ok) return

  const details = verdict.findings.map((finding) => finding.message).join('\n\n')

  if (isProduction) {
    throw new Error(
      `Refusing to start in production with an unusable BETTER_AUTH_URL.\n\n${details}`,
    )
  }

  console.warn(
    `[auth] ${details}\n` +
      '[auth] Continuing because NODE_ENV is not "production". Verification links are ' +
      'environment-scoped: a token signed here is only valid here.',
  )
}
