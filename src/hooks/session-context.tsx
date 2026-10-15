/**
 * The application-wide account session, read once and shared.
 *
 * Better Auth's `useSession()` is backed by a module-level nanostore, so a single
 * subscription at this provider keeps every consumer (Header, Account, Admin,
 * card actions) in sync when the session changes — sign-in and sign-out update
 * navigation without a full remount. Previously each consumer called
 * `getSession()` once on mount, so a mounted Header went stale after sign-in.
 *
 * Reading the session through a context (rather than calling the hook in every
 * component) also makes the components testable: a test can render them inside
 * `<SessionContext.Provider value={view}>` with a fixed {@link AccountView} and no
 * auth client or network.
 */

import { type ComponentChildren, createContext } from 'preact'
import { useContext } from 'preact/hooks'
import { authClient } from './auth-client'
import type { SessionShape } from './session-envelope'
import {
  type AccountView,
  deriveAccountView,
  SIGNED_OUT_VIEW,
} from './session-state'

/**
 * The account view plus the controls a consumer may need to force a re-read.
 * Keeping `refetch` here (rather than exporting the client to every page) means
 * a page can refresh the session without importing Better Auth directly.
 */
export interface SessionContextValue extends AccountView {
  /** Re-read the session from the auth server; resolves when the read settles. */
  refetch: () => void | Promise<void>
}

/**
 * The current account view. Defaults to signed-out so a consumer rendered outside
 * the provider (e.g. an isolated unit test) degrades to "signed out", never crashes.
 */
export const SessionContext = createContext<SessionContextValue>({
  ...SIGNED_OUT_VIEW,
  refetch: () => undefined,
})

/**
 * Subscribe to the reactive Better Auth session and publish the derived view.
 *
 * @param props.children The subtree that may consume the session.
 * @returns The context provider wrapping `children`.
 */
export const SessionProvider = ({
  children,
}: {
  children: ComponentChildren
}) => {
  const { data, isPending, refetch } = authClient.useSession()
  const view = deriveAccountView((data ?? null) as SessionShape, isPending)

  return (
    <SessionContext.Provider value={{ ...view, refetch }}>
      {children}
    </SessionContext.Provider>
  )
}

/**
 * Read the current account view from context.
 *
 * @returns The {@link SessionContextValue} published by {@link SessionProvider}.
 */
export const useAccount = (): SessionContextValue => useContext(SessionContext)
