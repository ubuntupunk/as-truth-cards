import React from 'react'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'

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
            © {new Date().getFullYear()} Truth Cards. Educational purposes only.
          </p>

          <div className="flex space-x-6">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Resources
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
