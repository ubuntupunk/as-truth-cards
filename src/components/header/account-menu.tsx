/**
 * The header account menu — the improved "Account / open menu" panel
 * (`62:11735`, `62:11897`, `62:12057`).
 *
 * The design's four entries are kept, but two copies are adapted to what the
 * product actually does:
 *
 * - The mockup labels My activity "History, ratings and feedback". Ratings and
 *   feedback do not exist yet, and `/account/activity` says so plainly, so the
 *   subtitle describes what the page really shows instead of promising more.
 * - The mockup says "Verified researcher". Role comes from the server-owned
 *   ladder (anonymous, verified, academic, researcher, moderator, admin) and is
 *   never upgraded for display; the panel shows the real label and states that
 *   role describes account access, not research standing.
 *
 * The appearance control writes the same device-local treatment the account
 * pages read, and the note is the design's own: appearance changes the look,
 * not the card, side, or research session.
 *
 * Surfaces and borders come from the site token set, not the `graph-*` palette:
 * the panel hangs off the header, which sits outside any `data-treatment` zone,
 * so graph tokens would render a white card under near-white text in the dark
 * theme.
 */

import type { ComponentChildren } from 'preact'
import { roleLabel } from '@/account/role-label'
import { initialOf } from '@/components/account/public-profile-card'
import {
  AppearanceSelector,
  type AppearanceSelectorProps,
} from '@/components/appearance-selector'
import { Button } from '@/components/ui/button'
import type { GraphTreatment } from '@/graph/appearance'
import { cn } from '@/lib/utils'

/** One account-menu destination. */
export interface AccountMenuItem {
  readonly label: string
  /** One honest sentence describing what the destination shows. */
  readonly description: string
  readonly path: string
  /** Personal entries sit above the divider; settings sits below it. */
  readonly group: 'personal' | 'settings'
}

/**
 * The account-menu destinations, in panel order.
 *
 * Every `path` is a served route (`src/app-routes.tsx`); the header test asserts
 * that, so the menu cannot grow a dead link.
 */
export const ACCOUNT_MENU_ITEMS: readonly AccountMenuItem[] = [
  {
    label: 'My profile',
    description: 'Public fields and private account details',
    path: '/account',
    group: 'personal',
  },
  {
    label: 'My activity',
    description: 'Saved cards and account activity',
    path: '/account/activity',
    group: 'personal',
  },
  {
    label: 'Saved cards',
    description: 'Cards you chose to keep',
    path: '/account/saved',
    group: 'personal',
  },
  {
    label: 'Settings',
    description: 'Account, privacy and security',
    path: '/account/settings',
    group: 'settings',
  },
]

/** The minimal link surface the panel needs (injected so tests skip a router). */
export interface MenuLinkProps {
  readonly to: string
  readonly className?: string
  readonly onClick?: () => void
  readonly children: ComponentChildren
}

/** A link renderer; defaults to the router's `Link` in {@link AccountMenu}. */
export type MenuLink = (props: MenuLinkProps) => ComponentChildren

/** Props for {@link AccountMenuPanel}. */
export interface AccountMenuPanelProps {
  readonly name: string
  readonly email: string
  readonly imageUrl: string | null
  /** The server-owned role, or `undefined` when the session has none yet. */
  readonly accountRole: string | undefined
  readonly treatment: GraphTreatment
  readonly onSelectTreatment: AppearanceSelectorProps['onSelect']
  readonly onSignOut: () => void
  readonly signingOut?: boolean
  /** Closes the menu before navigating. */
  readonly onNavigate: () => void
  /** Injected link renderer; defaults to the router link in `Header`. */
  readonly link: MenuLink
}

/**
 * Render the open account menu panel.
 *
 * @param props Identity, destinations, appearance control, and sign-out.
 * @returns The floating menu card.
 */
export function AccountMenuPanel({
  name,
  email,
  imageUrl,
  accountRole,
  treatment,
  onSelectTreatment,
  onSignOut,
  signingOut = false,
  onNavigate,
  link: Link,
}: AccountMenuPanelProps) {
  const displayName = name.trim() !== '' ? name.trim() : email

  return (
    <div
      data-testid="account-menu"
      className="w-[376px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-5 shadow-xl"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Account / Open menu
      </p>

      <div className="mt-3 flex items-center gap-3.5">
        {imageUrl && imageUrl !== '' ? (
          <img
            src={imageUrl}
            alt=""
            className="h-[72px] w-[72px] shrink-0 rounded-xl object-cover"
            data-testid="account-menu-avatar"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-graph-accent/10 text-2xl font-semibold text-graph-accent"
            data-testid="account-menu-initials"
          >
            {initialOf(displayName)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-foreground">
            {displayName}
          </p>
          <p className="mt-0.5 text-sm text-graph-accent">
            {roleLabel(accountRole)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Role describes account access, not research standing. It is separate
        from verified email and is not research evidence.
      </p>

      <hr className="my-4 border-border" />

      <nav aria-label="Account" className="flex flex-col">
        {ACCOUNT_MENU_ITEMS.map((item, index) => (
          <div key={item.path}>
            {index > 0 && item.group === 'settings' ? (
              <hr className="my-2 border-border" />
            ) : null}
            <Link
              to={item.path}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg py-2.5 text-left hover:bg-muted/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="text-lg text-muted-foreground"
              >
                ›
              </span>
            </Link>
          </div>
        ))}
      </nav>

      <div className="mt-3 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Appearance
        </p>
        <AppearanceSelector value={treatment} onSelect={onSelectTreatment} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Appearance only. Keep the current card, side and research session.
        </p>
      </div>

      <hr className="my-4 border-border" />

      <Button
        type="button"
        variant="ghost"
        className={cn(
          'w-full justify-start px-0 text-sm font-semibold text-foreground hover:bg-transparent hover:text-foreground',
          signingOut ? 'opacity-60' : '',
        )}
        disabled={signingOut}
        onClick={onSignOut}
        data-testid="account-menu-sign-out"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  )
}
