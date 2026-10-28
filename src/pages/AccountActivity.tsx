import { useEffect, useState } from 'preact/hooks'
import { Link } from 'react-router-dom'
import { listSavedCards } from '@/auth/saved-cards'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { useAdminCheck } from '@/hooks/useAdminCheck'

/**
 * Account activity / My Activity page showing saved cards and participation.
 */
const AccountActivity = () => {
  const { isSignedIn, loading } = useAdminCheck()
  const [saved, setSaved] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)

  useEffect(() => {
    if (loading || !isSignedIn) {
      setLoadingSaved(false)
      return
    }
    let cancelled = false
    listSavedCards()
      .then((slugs) => {
        if (!cancelled) setSaved(slugs)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false)
      })
    return () => {
      cancelled = true
    }
  }, [loading, isSignedIn])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-grow px-4 pb-16 pt-24">
          <div className="mx-auto w-full max-w-2xl">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto w-full max-w-2xl">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                My Activity
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                View your saved cards and participation history
              </p>
            </div>

            <section>
              <h2 className="text-lg font-semibold text-foreground">
                Saved cards
              </h2>
              {loadingSaved ? (
                <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
              ) : !isSignedIn ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Sign in to view your saved cards.
                </p>
              ) : error ? (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              ) : saved.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No saved cards yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {saved.map((slug) => (
                    <li
                      key={slug}
                      className="rounded-lg border border-graph-border bg-graph-surface p-3"
                    >
                      <Link
                        to={`/graph?focus=${encodeURIComponent(slug)}`}
                        className="text-sm font-medium text-foreground hover:underline"
                      >
                        {slug}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-foreground">
                Participation
              </h2>
              <div className="mt-3 rounded-lg border border-border bg-card p-6">
                <p className="text-sm text-muted-foreground">
                  Participation tracking will be available as participation
                  features are enabled.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default AccountActivity
