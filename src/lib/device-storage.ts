/**
 * The browser's `localStorage`, or `null` when it is unavailable.
 *
 * Device-local state (appearance treatment, onboarding participation answers)
 * must degrade to its defaults rather than throw when storage is blocked —
 * Safari private mode, a hardened browser, or the server-side render pass. Every
 * caller already treats `null` as "nothing stored yet", so this one probe is the
 * single place that knows how to ask safely.
 *
 * @returns A `Storage`-like reader/writer, or `null` outside a browser or when
 * access is denied.
 */
export function deviceStorage(): Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
