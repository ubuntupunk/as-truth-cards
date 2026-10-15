/**
 * The single Better Auth client instance for the browser.
 *
 * Extracted from `useAdminCheck.ts` so the reactive session provider and the pages
 * that call `signIn`/`signUp`/`signOut` all share one client (and therefore one
 * session store) without importing each other in a cycle.
 */

import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth client.
 *
 * `baseURL` is deliberately left unset. In development the browser talks to Vite on
 * :8080, which proxies /api through to the Express server on :3001, so same-origin
 * relative requests already work and the session cookie stays first-party. Naming an
 * absolute origin here would make that cookie cross-site and require CORS credentials.
 */
export const authClient = createAuthClient()
