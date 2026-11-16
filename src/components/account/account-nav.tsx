import { Link } from 'react-router-dom'

/**
 * The account-area sidebar from the improved account panels ("Your account":
 * My profile / My activity / Saved cards / Settings, the research-session note,
 * and the return link).
 *
 * Figma authority: "Account / Profile — Atmospheric · Improved", account
 * navigation (`62:13273`). The designed "Saved cards" entry was omitted while no
 * saved-cards route existed (this project does not ship dead links); it returns
 * now that `/account/saved` serves the surface.
 */

/** Which account page is rendering, for the active treatment. */
export type AccountNavSection = 'profile' | 'activity' | 'saved' | 'settings'

/** The navigable account sections, in panel order. */
export const ACCOUNT_NAV_SECTIONS: readonly {
  key: AccountNavSection
  label: string
  to: string
}[] = [
  { key: 'profile', label: 'My profile', to: '/account' },
  { key: 'activity', label: 'My activity', to: '/account/activity' },
  { key: 'saved', label: 'Saved cards', to: '/account/saved' },
  { key: 'settings', label: 'Settings', to: '/account/settings' },
]

/** Props for {@link AccountNav}. */
export interface AccountNavProps {
  active: AccountNavSection
}

/**
 * Render the account sidebar navigation.
 *
 * @param props The currently active section.
 * @returns The sidebar as a labelled navigation landmark.
 */
export const AccountNav = ({ active }: AccountNavProps) => (
  <nav
    aria-label="Your account"
    className="w-full shrink-0 md:w-[210px]"
    data-testid="account-nav"
  >
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      Your account
    </p>
    <ul className="mt-2 flex flex-col gap-1">
      {ACCOUNT_NAV_SECTIONS.map((section) => {
        const current = section.key === active
        return (
          <li key={section.key}>
            <Link
              to={section.to}
              aria-current={current ? 'page' : undefined}
              className={
                current
                  ? 'block rounded-md border-l-2 border-graph-accent bg-graph-accent/10 px-3.5 py-3 text-sm font-semibold text-graph-accent'
                  : 'block rounded-md px-3.5 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            >
              {section.label}
            </Link>
          </li>
        )
      })}
    </ul>
    <div className="mt-6 border-t border-graph-border pt-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Personal account tools. Your research session stays separate.
      </p>
      <Link
        to="/"
        className="mt-3 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Return to the deck
      </Link>
    </div>
  </nav>
)
