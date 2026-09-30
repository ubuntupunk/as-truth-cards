'use client'

import type { UserRole } from '@prisma/client'
import { createAuthClient } from 'better-auth/react'
import { useEffect, useState } from 'react'

/** Minimal shape of the session this hook actually reads. */
type SessionShape = {
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
 * Better Auth client.
 *
 * baseURL is deliberately left unset. In development the browser talks to Vite on
 * :8080, which proxies /api through to the Express server on :3001, so same-origin
 * relative requests already work and the session cookie stays first-party. Naming an
 * absolute origin here would make that cookie cross-site and require CORS credentials.
 */
export const authClient = createAuthClient()

/**
 * The role ladder, typed from Prisma's generated `UserRole` enum so the client and
 * database cannot drift apart. This is a type-only import, so it is erased at build
 * time and pulls no Prisma runtime into the browser bundle.
 *
 * Better Auth's untyped client cannot know about `additionalFields`, hence the cast.
 */
const asRole = (value: unknown): UserRole | undefined =>
  typeof value === 'string' ? (value as UserRole) : undefined

/**
 * Resolves the signed-in session and whether it carries the ADMIN role.
 *
 * This replaces an orphaned Stack Auth hook that called `useUser()` with no provider
 * mounted anywhere, then fetched a `/api/auth/user-role` endpoint that never existed,
 * and finally fell back to comparing the signed-in email against a hardcoded list of
 * admin addresses shipped in the client bundle. That fallback was a real privilege
 * escalation path: knowing an admin's email was enough to be treated as an admin.
 *
 * The role now arrives on the session, set only by the server. `input: false` on the
 * field in server/auth.ts means Better Auth rejects a client-supplied role, so this
 * value cannot be forged from the browser.
 */
export const useAdminCheck = () => {
  const [session, setSession] = useState<SessionShape | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    authClient
      .getSession()
      .then((result) => {
        if (!active) return
        // getSession() resolves to the session itself, or null when signed out.
        setSession((result as SessionShape | null) ?? null)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const user = session?.user ?? null
  const role = asRole(user ? (user as { role?: unknown }).role : undefined)

  return {
    isAdmin: role === 'ADMIN',
    loading,
    isSignedIn: Boolean(user),
    role,
    user,
    session,
  }
}

export default useAdminCheck
