/**
 * Pure helpers for reading Better Auth's client session envelope.
 *
 * Kept free of React and any Better Auth runtime import so the unwrapping rule can
 * be unit-tested directly, without mounting the hook or booting the auth client.
 */

/** Minimal shape of the session this app actually reads. */
export type SessionShape = {
  user: {
    id: string
    email: string
    name: string
    image?: string | null
    [key: string]: unknown
  } | null
  session?: Record<string, unknown>
} | null

/**
 * Unwrap the session from Better Auth's client response.
 *
 * `authClient.getSession()` resolves to a `{ data, error }` envelope — the session,
 * when present, lives under `data`. Reading `result.user` directly therefore always
 * yields `undefined`, which silently makes every caller treat a signed-in user as
 * signed out. Some client builds resolve to the bare session instead, so both shapes
 * are accepted.
 *
 * @param result The value resolved by `authClient.getSession()`.
 * @returns The session, or `null` when signed out.
 * @example
 * ```ts
 * unwrapSession({ data: { user }, error: null }) // => { user }
 * unwrapSession({ data: null, error: null })     // => null
 * ```
 */
export function unwrapSession(
  result: { data?: SessionShape } | SessionShape,
): SessionShape {
  if (result && typeof result === 'object' && 'data' in result) {
    return (result.data as SessionShape) ?? null
  }
  return (result as SessionShape) ?? null
}
