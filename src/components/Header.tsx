import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'
import { ThemeToggle } from './ThemeToggle'

/**
 * The global navigation, aligned to the approved product hierarchy:
 * Decks, Explorer, Graph, Research, Sources. Graph is visibly the current
 * section while it is mounted. Explorer now has a route (`/explore`);
 * Research / Sources have no route behind them yet, so they render as inert
 * spans (never dead links) until their pages exist — no page invents its own
 * second nav.
 */
type NavEntry =
  | { kind: 'link'; label: string; path: string }
  | { kind: 'inert'; label: string }

const NAV_ENTRIES: readonly NavEntry[] = [
  { kind: 'link', label: 'Decks', path: '/' },
  { kind: 'link', label: 'Explorer', path: '/explore' },
  { kind: 'link', label: 'Graph', path: '/graph' },
  { kind: 'inert', label: 'Research' },
  { kind: 'inert', label: 'Sources' },
]

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

const Header = () => {
  const location = useLocation()
  const isVisible = useDelayedVisibility(100)
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <header
      className={cn(
        'fixed top-0 w-full z-50 px-6 py-4 glass transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4',
      )}
    >
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-medium tracking-tight hover-lift">
          Trope Cards
        </Link>

        <div className="flex items-center space-x-4">
          <nav className="flex space-x-8" aria-label="Global navigation">
            {NAV_ENTRIES.map((entry) =>
              entry.kind === 'link' ? (
                <Link
                  key={entry.label}
                  to={entry.path}
                  aria-current={
                    location.pathname === entry.path ? 'page' : undefined
                  }
                  className="relative"
                >
                  <NavLink
                    label={entry.label}
                    active={location.pathname === entry.path}
                  />
                </Link>
              ) : (
                <span
                  key={entry.label}
                  aria-disabled="true"
                  className="cursor-not-allowed"
                >
                  <NavLink label={entry.label} />
                </span>
              ),
            )}
            {isAdmin ? (
              <Link
                to="/admin"
                aria-current={isAdmin ? 'page' : undefined}
                className="relative"
              >
                <NavLink label="Admin" active={isAdmin} />
              </Link>
            ) : null}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export default Header
