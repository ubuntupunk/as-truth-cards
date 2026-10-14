import { Coffee, Github } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'

/**
 * The canonical source repository. External to the app, so it is rendered as a
 * plain anchor rather than a router `Link`.
 */
export const REPO_URL = 'https://github.com/ubuntupunk/as-truth-cards'

/**
 * The Buy Me a Coffee link. External, so it renders as a plain anchor.
 */
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/ubuntupunk'

/**
 * The site-wide footer links. Each points at a real route — no placeholder
 * `href="#"` anchors — so the footer never presents inert compliance links.
 */
export const FOOTER_LINKS: readonly {
  readonly label: string
  readonly path: string
}[] = [
  { label: 'About', path: '/about' },
  { label: 'Privacy', path: '/privacy' },
  { label: 'Terms', path: '/terms' },
  { label: 'Resources', path: '/resources' },
]

const Footer = () => {
  const isVisible = useDelayedVisibility(300)

  return (
    <footer
      className={cn(
        'w-full py-8 px-6 mt-auto',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        'transition-all duration-700 ease-out',
      )}
    >
      <div className="container mx-auto">
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground mb-4 md:mb-0">
            © {new Date().getFullYear()} Trope Deck. Educational purposes only.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.path}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View the Trope Deck source on GitHub"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              href={BUY_ME_A_COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Buy the Trope Deck maintainers a coffee"
              className="inline-flex items-center gap-2 rounded-full bg-[#FFDD00] px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-105"
            >
              <Coffee className="h-4 w-4" aria-hidden="true" />
              Buy me a coffee
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
