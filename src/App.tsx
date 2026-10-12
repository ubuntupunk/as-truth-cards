import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense } from 'preact/compat'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { APP_ROUTES } from '@/app-routes'
import { ErrorBoundary } from '@/components/error-boundary'
import { withRouteBoundary } from '@/components/route-boundary'
import { RouteLoading } from '@/components/route-loading'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from './components/ThemeProvider'

const queryClient = new QueryClient()

/**
 * The application shell.
 *
 * Routes are guarded twice: an outer {@link ErrorBoundary} catches anything the
 * router itself throws, and each route element carries its own boundary (via
 * {@link withRouteBoundary}) so a single broken view shows that route's fallback
 * instead of blanking the app. The {@link Suspense} boundary supplies the
 * route-level loading state; it is the seam any future lazily-loaded route (or
 * a suspense-mode query) lands on without further wiring.
 *
 * @returns The provider stack and the routed application.
 */
const App = () => (
  <ThemeProvider defaultTheme="system">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary label="application">
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                {APP_ROUTES.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={withRouteBoundary(route)}
                  />
                ))}
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
)

export default App
