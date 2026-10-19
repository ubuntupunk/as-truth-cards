/**
 * The routed 404 surface — the `*` catch-all in `app-routes.tsx`.
 *
 * The previous page was the stock Vite placeholder: a gray full-screen box, a
 * blue underlined link, and none of the app's identity. This composes the
 * standard page shell (header, content, footer) around {@link NotFoundPanel},
 * so an unknown URL lands on the same typographic system and token palette as
 * every other surface.
 *
 * The `console.error` on mount is kept deliberately. The server answers an
 * unknown path with the SPA shell (HTTP 200), so the attempted pathname is not
 * visible in any access log — this line is how a broken inbound link gets
 * traced back to the URL that produced it. It needs `useLocation`, which is
 * exactly why the copy lives in the pure panel component: the Node harness has
 * no router context.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { NotFoundPanel } from '@/components/not-found-panel'

/**
 * The catch-all 404 page.
 *
 * @returns The routed page: the shared header, the centered not-found panel,
 * and the shared footer.
 */
const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error(
      '404 Error: User attempted to access non-existent route:',
      location.pathname,
    )
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex flex-grow items-center justify-center px-4 pb-16 pt-24">
        <NotFoundPanel />
      </main>

      <Footer />
    </div>
  )
}

export default NotFound
