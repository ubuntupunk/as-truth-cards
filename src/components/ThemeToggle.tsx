import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { Button } from '@/components/ui/button'

/**
 * Icon button that flips the displayed appearance to its opposite.
 *
 * Uses the resolved appearance rather than the raw choice, so a user on
 * `system` switches away from what is currently on screen instead of always
 * jumping to the same theme.
 *
 * @returns A ghost icon button reflecting the resolved appearance.
 * @example
 * ```tsx
 * <ThemeToggle />
 * ```
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const nextTheme = resolvedTheme === 'light' ? 'dark' : 'light'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  )
}
