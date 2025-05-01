'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'
import { ThemeToggle } from './ThemeToggle'
import { useUser, UserButton } from '@stackframe/stack'

const Header = () => {
  const pathname = usePathname()
  const isVisible = useDelayedVisibility(100)
  const isAdmin = pathname?.startsWith('/admin')
  const user = useUser()

  return (
    <header
      className={cn(
        'fixed top-0 w-full z-50 px-6 py-4 glass transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      )}
    >
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-medium tracking-tight hover-lift">
          Anti-Semitism Truth Cards
        </Link>

        <div className="flex items-center space-x-4">
          <nav className="flex space-x-8">
            <ThemeToggle />
            {[
              { path: '/', label: 'Home' },
              { path: '/about', label: 'About' },
              { path: '/admin', label: 'Admin', protected: true },
            ]
              .filter((link) => !link.protected || isAdmin)
              .map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={cn(
                    'relative py-2 text-sm font-medium transition-colors hover-lift',
                    'after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 hover:after:origin-bottom-left hover:after:scale-x-100',
                    pathname === '/admin' && link.path === '/admin' ? 'after:scale-x-100' : ''
                  )}
                >
                  {link.label}
                </Link>
              ))}
          </nav>
          {user ? (
            <UserButton />
          ) : (
            <Link
              href="/handler/sign-in"
              className="text-sm font-medium transition-colors hover-lift"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
