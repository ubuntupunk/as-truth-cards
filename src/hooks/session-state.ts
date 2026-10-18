/**
 * Pure derivation of the account view the UI renders from Better Auth's session.
 *
 * Kept free of React, Preact and any Better Auth runtime import so the mapping
 * from "raw session" to "what the account surfaces show" can be unit-tested
 * directly — including the onboarding-completion state, which is an account
 * boundary rather than a navigation detail.
 */

import type { UserRole } from '@prisma/client'
import type { SessionShape } from './session-envelope'

/** The role ladder, mirrored from the Prisma-generated enum (type-only import). */
export type AccountRole = UserRole

/**
 * Onboarding lifecycle for an authenticated user.
 *
 * `complete`/`incomplete` are *account states* read from the server-owned
 * `onboardedAt` field — never inferred from whether the onboarding page was
 * visited. `loading` covers the pre-session read; `signed-out` has no state.
 */
export type OnboardingStatus =
  | 'loading'
  | 'signed-out'
  | 'incomplete'
  | 'complete'

/** The subset of the user record the account surfaces read. */
export interface AccountUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image: string | null
  /** Public-facing profile fields, or null when never set. */
  bio: string | null
  website: string | null
  location: string | null
  /** ISO timestamp set when onboarding was completed, or null if not. */
  onboardedAt: string | null
  role: AccountRole | undefined
}

/** Everything an account surface needs, derived from one session read. */
export interface AccountView {
  user: AccountUser | null
  isSignedIn: boolean
  isAdmin: boolean
  role: AccountRole | undefined
  onboardedAt: string | null
  onboardingComplete: boolean
  onboardingStatus: OnboardingStatus
  loading: boolean
  session: Record<string, unknown> | null
}

/** The role ladder, as a set, so an unknown string is rejected rather than trusted. */
const ROLES: readonly string[] = [
  'ANONYMOUS',
  'VERIFIED',
  'ACADEMIC',
  'RESEARCHER',
  'MODERATOR',
  'ADMIN',
]

/**
 * Narrow an untrusted value to a known role.
 *
 * @param value A value read off the session user.
 * @returns The role when it is one of the known ladder values, otherwise `undefined`.
 */
export function asRole(value: unknown): AccountRole | undefined {
  return typeof value === 'string' && ROLES.includes(value)
    ? (value as AccountRole)
    : undefined
}

/**
 * Normalise the server-owned `onboardedAt` field to an ISO string.
 *
 * Accepts what Better Auth/the JSON session actually hands back (`string` or a
 * revived `Date`) and treats anything else — including `null`/absent — as not
 * completed. It never *infers* completion from a truthy-but-unrelated value.
 *
 * @param value The raw field from the session user.
 * @returns An ISO timestamp string, or `null` when onboarding is not complete.
 */
export function readOnboardedAt(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  return null
}

/** The signed-out view; also the context's default before any session is read. */
export const SIGNED_OUT_VIEW: AccountView = {
  user: null,
  isSignedIn: false,
  isAdmin: false,
  role: undefined,
  onboardedAt: null,
  onboardingComplete: false,
  onboardingStatus: 'signed-out',
  loading: false,
  session: null,
}

/**
 * Map a Better Auth session to the account view.
 *
 * @param session The unwrapped session (`{ user, session }`) or `null`.
 * @param loading Whether the session read is still pending. A pending read is
 *   reported as `loading` regardless of a stale/absent value, so the UI shows a
 *   loading state instead of briefly flashing "signed out".
 * @returns The derived {@link AccountView}.
 * @example
 * ```ts
 * deriveAccountView({ user: { id, email, name, onboardedAt: '2026-01-01T00:00:00.000Z' } })
 * // => { isSignedIn: true, onboardingComplete: true, onboardingStatus: 'complete', ... }
 * ```
 */
export function deriveAccountView(
  session: SessionShape,
  loading = false,
): AccountView {
  if (loading) {
    return { ...SIGNED_OUT_VIEW, loading: true, onboardingStatus: 'loading' }
  }

  const raw = session?.user
  if (!raw) return { ...SIGNED_OUT_VIEW }

  const role = asRole(raw.role)
  const onboardedAt = readOnboardedAt(raw.onboardedAt)

  return {
    user: {
      id: String(raw.id ?? ''),
      email: String(raw.email ?? ''),
      name: String(raw.name ?? ''),
      emailVerified: Boolean(raw.emailVerified),
      image: typeof raw.image === 'string' ? raw.image : null,
      bio: typeof raw.bio === 'string' ? raw.bio : null,
      website: typeof raw.website === 'string' ? raw.website : null,
      location: typeof raw.location === 'string' ? raw.location : null,
      onboardedAt,
      role,
    },
    isSignedIn: true,
    isAdmin: role === 'ADMIN',
    role,
    onboardedAt,
    onboardingComplete: onboardedAt !== null,
    onboardingStatus: onboardedAt !== null ? 'complete' : 'incomplete',
    loading: false,
    session: session?.session ?? null,
  }
}
