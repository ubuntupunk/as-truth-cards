import { ChevronDown, Menu, X } from 'lucide-react'
import type { VNode } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AccountMenuPanel,
  type MenuLinkProps,
} from '@/components/header/account-menu'
import {
  type GraphTreatment,
  readGraphTreatment,
  writeGraphTreatment,
} from '@/graph/appearance'
import { useAccount } from '@/hooks/session-context'
import { authClient, useAdminCheck } from '@/hooks/useAdminCheck'
import { deviceStorage } from '@/lib/device-storage'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'
import { ThemeToggle } from './ThemeToggle'

/**
 * The global navigation, aligned to the approved product hierarchy:
 * Decks, Explorer, Graph, Research, Compose, Sources. Each entry is the
 * current section while its path/prefix is mounted; every surface now has a
 * route behind it, so no entry renders as a dead link and no page invents its
 * own second nav.
 *
 * Compose (`/research/compose`) is listed as its own entry rather than hidden
 * behind Research: it is a fully implemented authoring surface, and the
 * approved IA requires it to be reachable in one click. Research therefore
 * matches its own path exactly, so the two never highlight at once.
 *
 * Below `md` the horizontal row cannot fit without clipping (the row needs
 * ~648px), so the entries move into a toggleable menu behind a hamburger button.
 * That keeps every primary destination reachable at 320–375px instead of
 * overflowing a `fixed` header that produces no scroll to recover them.
 *
 * The brand renders with an editorial sub-heading identifying the project's
 * scope. It lives in its own `min-w-0` column so it wraps instead of widening
 * the header on narrow viewports, which would otherwise reintroduce the
 * clipping this responsive nav exists to prevent.
 */
type NavEntry = {
  label: string
  path: string
  prefixes?: readonly string[]
}

export const NAV_ENTRIES: readonly NavEntry[] = [
  { label: 'Decks', path: '/' },
  { label: 'Explorer', path: '/explore' },
  { label: 'Graph', path: '/graph' },
  { label: 'Research', path: '/research' },
  { label: 'Compose', path: '/research/compose' },
  { label: 'Sources', path: '/sources', prefixes: ['/sources'] },
]

/**
 * Whether a nav entry is the current section for a given path.
 *
 * An entry with `prefixes` matches any path under one of them (so Sources stays
 * current while a source is selected); otherwise the match is exact, which is
 * what keeps Research and Compose from both highlighting on
 * `/research/compose`.
 *
 * @param entry A navigation entry.
 * @param pathname The current `location.pathname`.
 * @returns `true` when the entry is the current section.
 */
export function isNavEntryActive(entry: NavEntry, pathname: string): boolean {
  return entry.prefixes
    ? entry.prefixes.some((prefix) => pathname.startsWith(prefix))
    : pathname === entry.path
}

/**
 * The shared nav link treatment (underline grows on hover and while current).
 *
 * @param props.active Whether the link is the current section.
 */
const NavLink = ({ label, active }: { label: string; active?: boolean }) => (
  <span
    className={cn(
      'relative py-2 text-sm font-medium transition-colors',
      active
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground',
      'after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 hover:after:origin-bottom-left hover:after:scale-x-100',
      active ? 'after:scale-x-100' : '',
    )}
  >
    {label}
  </span>
)

/**
 * The router link handed to {@link AccountMenuPanel}.
 *
 * The panel takes an injected link renderer so its contents can be tested without
 * mounting a router; the header is where the real `Link` comes from.
 *
 * @param props Destination, classes, click hook, and children.
 * @returns The router link.
 */
const RouterMenuLink = ({
  to,
  className,
  onClick,
  children,
}: MenuLinkProps): VNode => (
  <Link to={to} className={className} onClick={onClick}>
    {children}
  </Link>
)

/**
 * The header, including the two account affordances.
 *
 * Signed in, the account cluster is a disclosure: a trigger showing the avatar
 * (or initial), the display name and a chevron, opening the account panel. It
 * closes on Escape (returning focus to the trigger), on a pointer down outside
 * it, on navigation, and on sign-out. The mobile menu keeps its plain Account
 * link, because a floating 376px panel has nowhere to go inside a 320px
 * viewport.
 */
const Header = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const isVisible = useDelayedVisibility(100)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [treatment, setTreatment] = useState<GraphTreatment>(() =>
    readGraphTreatment(deviceStorage()),
  )
  const lastPathname = useRef(location.pathname)
  const accountRef = useRef<HTMLDivElement>(null)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const { isSignedIn, isAdmin: isAdminRole } = useAdminCheck()
  const { user, role } = useAccount()
  const isAdmin = location.pathname.startsWith('/admin') || isAdminRole

  const entries: readonly NavEntry[] = isAdmin
    ? [...NAV_ENTRIES, { label: 'Admin', path: '/admin' }]
    : NAV_ENTRIES

  // Closing on navigation keeps the menu from lingering across route changes,
  // and Escape dismisses it like any other disclosure.
  useEffect(() => {
    if (lastPathname.current === location.pathname) return
    lastPathname.current = location.pathname
    setMenuOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen && !accountOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (accountOpen) {
        setAccountOpen(false)
        accountTriggerRef.current?.focus()
      }
      setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, accountOpen])

  // A click anywhere outside the account cluster dismisses the panel, the way a
  // menu is expected to behave. Kept on `pointerdown` so it fires before a
  // link's own `click` handler can navigate and remount the tree.
  useEffect(() => {
    if (!accountOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Node &&
        accountRef.current !== null &&
        !accountRef.current.contains(target)
      ) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [accountOpen])

  const handleSelectTreatment = (next: GraphTreatment) => {
    setTreatment(next)
    writeGraphTreatment(next, deviceStorage())
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
      setAccountOpen(false)
      navigate('/')
    } catch (err) {
      console.error('Failed to sign out:', err)
    } finally {
      setSigningOut(false)
    }
  }

  const accountName = user?.name?.trim() || user?.email || 'Account'

  return (
    <header
      className={cn(
        'fixed top-0 w-full z-50 px-6 py-4 glass transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4',
      )}
    >
      <div className="container mx-auto flex justify-between items-center gap-4">
        <div className="flex min-w-0 flex-col">
          <Link
            to="/"
            className="self-start inline-flex items-center gap-2 text-2xl font-medium tracking-tight hover-lift"
          >
            <img
              src="/fig-2-1.jpg"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 rounded-full object-cover"
            />
            Trope Deck
          </Link>
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Antisemitism Ontologies &amp; Counter-Tactics
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <nav
            className="hidden md:flex md:space-x-8"
            aria-label="Global navigation"
          >
            {entries.map((entry) => {
              const active = isNavEntryActive(entry, location.pathname)
              return (
                <Link
                  key={entry.label}
                  to={entry.path}
                  aria-current={active ? 'page' : undefined}
                  className="relative"
                >
                  <NavLink label={entry.label} active={active} />
                </Link>
              )
            })}
          </nav>
          <ThemeToggle />
          {isSignedIn ? (
            <div ref={accountRef} className="relative hidden md:block">
              <button
                ref={accountTriggerRef}
                type="button"
                data-testid="account-menu-trigger"
                aria-expanded={accountOpen}
                aria-controls="account-menu-panel"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {user?.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground"
                  >
                    {accountName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="max-w-[10rem] truncate">{accountName}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'h-4 w-4 transition-transform',
                    accountOpen ? 'rotate-180' : '',
                  )}
                />
              </button>
              {accountOpen ? (
                <div
                  id="account-menu-panel"
                  className="absolute right-0 top-full z-50 mt-2"
                >
                  <AccountMenuPanel
                    name={user?.name ?? ''}
                    email={user?.email ?? ''}
                    imageUrl={user?.image ?? null}
                    accountRole={role}
                    treatment={treatment}
                    onSelectTreatment={handleSelectTreatment}
                    onSignOut={handleSignOut}
                    signingOut={signingOut}
                    onNavigate={() => setAccountOpen(false)}
                    link={RouterMenuLink}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              to="/sign-in"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground md:block"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            data-testid="nav-menu-toggle"
            className="rounded-md border border-input p-2 text-muted-foreground hover:text-foreground md:hidden"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="global-nav-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="global-nav-menu"
          data-testid="nav-menu"
          aria-label="Global navigation"
          className="container mx-auto mt-3 flex flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-lg md:hidden"
        >
          {entries.map((entry) => {
            const active = isNavEntryActive(entry, location.pathname)
            return (
              <Link
                key={entry.label}
                to={entry.path}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {entry.label}
              </Link>
            )
          })}
          <div className="my-1 border-t border-border" />
          {isSignedIn ? (
            <Link
              to="/account"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                  {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <span>Account</span>
            </Link>
          ) : (
            <Link
              to="/sign-in"
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Sign in
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  )
}

export default Header
