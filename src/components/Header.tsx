
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDelayedVisibility } from '@/utils/animations';

const Header = () => {
  const location = useLocation();
  const isVisible = useDelayedVisibility(100);
  
  return (
    <header className={cn(
      "fixed top-0 w-full z-50 px-6 py-4 glass transition-all duration-700 ease-out",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
    )}>
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-medium tracking-tight hover-lift">
          Truth Cards
        </Link>
        
        <nav className="flex space-x-8">
          {[
            { path: '/', label: 'Home' },
            { path: '/about', label: 'About' },
          ].map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                "relative py-2 text-sm font-medium transition-colors hover-lift",
                "after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 hover:after:origin-bottom-left hover:after:scale-x-100",
                location.pathname === link.path ? "after:scale-x-100" : ""
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
