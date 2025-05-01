'use client'

import { StackProvider, StackTheme } from '@stackframe/stack'
import { stackClientApp } from '@/stack/client'
import '@/index.css'
import { ThemeProvider } from '@/components/ThemeProvider'

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <StackProvider app={stackClientApp}>
          <StackTheme>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  )
}
