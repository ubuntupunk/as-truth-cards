/**
 * Human labels for the server-owned account role ladder.
 *
 * The improved account panels show "Verified researcher" as a placeholder; the
 * real surfaces report the account's actual role instead, with a note that the
 * role describes account access rather than research standing. Keeping the
 * mapping in one module means the public profile preview and the header account
 * menu cannot drift apart.
 */

/** Human labels for the role ladder. */
export const ROLE_LABELS: Readonly<Record<string, string>> = {
  ANONYMOUS: 'Anonymous',
  VERIFIED: 'Verified',
  ACADEMIC: 'Academic',
  RESEARCHER: 'Researcher',
  MODERATOR: 'Moderator',
  ADMIN: 'Admin',
}

/**
 * Label a server-owned account role, tolerating an absent or unknown value.
 *
 * @param accountRole The role string from the session, if any.
 * @returns The human label, defaulting to `Anonymous` — never an empty badge.
 */
export function roleLabel(accountRole: string | undefined): string {
  return ROLE_LABELS[accountRole ?? 'ANONYMOUS'] ?? 'Anonymous'
}
