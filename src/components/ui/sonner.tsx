import type * as React from 'react'
import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/components/ThemeProvider'

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Sonner toaster wired to the app's single light/dark authority.
 *
 * @param props - Props forwarded to the underlying Sonner toaster.
 * @returns A toaster whose theme follows the resolved app theme.
 * @example
 * ```tsx
 * <Toaster />
 * ```
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
