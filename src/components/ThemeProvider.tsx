import type React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { deviceStorage } from '@/lib/device-storage'

/** A user-selectable appearance choice. */
type Theme = 'light' | 'dark' | 'system'

/** The concrete appearance actually painted on screen. */
type ResolvedTheme = 'light' | 'dark'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

/** Every accepted persisted value; anything else falls back to the default. */
const THEMES: ReadonlySet<string> = new Set<Theme>(['light', 'dark', 'system'])

/**
 * Narrow an untrusted stored value to a supported theme.
 *
 * @param value - Raw value read from device storage.
 * @returns True when the value is one of {@link THEMES}.
 */
function isTheme(value: string | null | undefined): value is Theme {
  return value != null && THEMES.has(value)
}

/**
 * Read the OS-level dark preference, degrading to light when it cannot be read.
 *
 * @returns Whether the operating system currently prefers a dark appearance.
 */
function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Turn a theme choice into the appearance that should be painted.
 *
 * @param theme - The user's selected theme.
 * @param systemPrefersDark - Current OS-level dark preference.
 * @returns The concrete light or dark appearance.
 */
function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  return theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme
}

/**
 * Read a validated theme from guarded device storage.
 *
 * @param storageKey - Key under which the theme choice is persisted.
 * @param defaultTheme - Value to use when nothing valid is stored.
 * @returns The stored theme, or `defaultTheme` for missing/garbage values.
 */
function readStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  try {
    const stored = deviceStorage()?.getItem(storageKey) ?? null
    return isTheme(stored) ? stored : defaultTheme
  } catch {
    return defaultTheme
  }
}

/**
 * Persist a theme choice, tolerating blocked or full storage.
 *
 * @param storageKey - Key under which the theme choice is persisted.
 * @param theme - The theme to write.
 */
function writeStoredTheme(storageKey: string, theme: Theme): void {
  try {
    deviceStorage()?.setItem(storageKey, theme)
  } catch {
    // Storage may be unavailable or full; the in-memory choice still applies.
  }
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
)

/**
 * Single source of truth for the app's light/dark appearance.
 *
 * Reads a validated choice from device storage, resolves `system` against the
 * live OS preference, and mirrors the result onto `<html>` as both a class and
 * `style.colorScheme`. When `system` is selected, subsequent OS preference
 * changes are applied until the user picks an explicit theme.
 *
 * @param props - Provider props.
 * @param props.children - The subtree that can call {@link useTheme}.
 * @param props.defaultTheme - Theme used when nothing valid is persisted.
 * @param props.storageKey - Storage key for the theme choice.
 * @returns A context provider wrapping `children`.
 * @example
 * ```tsx
 * <ThemeProvider defaultTheme="system">
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() =>
    readStoredTheme(storageKey, defaultTheme),
  )
  const [systemPrefersDark, setSystemPrefersDark] =
    useState(getSystemPrefersDark)

  const resolvedTheme = resolveTheme(theme, systemPrefersDark)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent): void => {
      setSystemPrefersDark(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    setSystemPrefersDark(mediaQuery.matches)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    setTheme: (nextTheme: Theme) => {
      writeStoredTheme(storageKey, nextTheme)
      setThemeState(nextTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

/**
 * Access the shared light/dark theme state.
 *
 * @returns The selected theme, its resolved appearance, and `setTheme`.
 * @throws When called outside a {@link ThemeProvider}.
 * @example
 * ```tsx
 * const { resolvedTheme, setTheme } = useTheme()
 * ```
 */
export const useTheme = (): ThemeProviderState => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
