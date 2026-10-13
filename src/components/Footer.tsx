import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'

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

          <div className="flex space-x-6">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.path}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
