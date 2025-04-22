import { StackProvider, StackTheme } from '@stackframe/stack'
import { stackClientApp } from '@/stack/client'
import '@/index.css'

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <StackProvider app={stackClientApp}>
          <StackTheme>{children}</StackTheme>
        </StackProvider>
      </body>
    </html>
  )
}
