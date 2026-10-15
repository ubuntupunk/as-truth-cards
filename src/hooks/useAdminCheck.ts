/**
 * Account session hook — the single entry point account surfaces use.
 *
 * `useAdminCheck` now reads the shared, reactive {@link SessionProvider} context
 * instead of calling `getSession()` on mount, so sign-in/sign-out propagate to
 * every mounted consumer (Header included) without a remount. The name is kept
 * for the many existing call sites; it is no longer admin-specific.
 *
 * The role arrives on the session, set only by the server. `input: false` on the
 * role field in `server/auth.ts` means Better Auth rejects a client-supplied
 * role, so `isAdmin` cannot be forged from the browser. This replaced an earlier
 * Stack Auth hook whose email-comparison fallback was a real escalation path.
 *
 * @returns The current {@link AccountView} (session, user, role, onboarding state).
 */
export { authClient } from './auth-client'
export { SessionContext, SessionProvider, useAccount } from './session-context'

import { useAccount } from './session-context'

/** @see useAccount */
export const useAdminCheck = useAccount

export default useAdminCheck
