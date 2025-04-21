import { createContext } from 'react'

type Theme = 'light' | 'dark' | 'system'

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export { initialState, ThemeProviderContext }
