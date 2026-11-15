import { useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import { AccountNav } from '@/components/account/account-nav'
import { ActivityPanels } from '@/components/account/activity-panels'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import {
  type GraphTreatment,
  graphTreatmentVars,
  readGraphTreatment,
} from '@/graph/appearance'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { deviceStorage } from '@/lib/device-storage'

/**
 * My activity — `/account/activity`.
 *
 * The improved account panels give this page the same shell as My profile and
 * Settings: the {@link AccountNav} sidebar inside the graph-treatment zone, with
 * the header and footer kept on the site stack outside it.
 *
 * The saved-cards list that used to live here is deliberately gone. It listed raw
 * slugs and linked into the graph, while `/account/saved` is the surface built for
 * that job (titles, summaries, unsave, and an honest unresolved-row state). Two
 * lists of the same rows would drift, so this page points at the real one instead
 * of duplicating it.
 *
 * Participation is still a placeholder: no participation capability ships yet, so
 * the page says that plainly rather than rendering an empty shell that reads like
 * "you have done nothing".
 */

/**
 * Activity page: saved-cards pointer and the participation boundary.
 *
 * @returns The activity route element.
 */
const AccountActivity = () => {
  const { isSignedIn, loading } = useAdminCheck()
  const navigate = useNavigate()
  const [treatment] = useState<GraphTreatment>(() =>
    readGraphTreatment(deviceStorage()),
  )

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-grow px-4 pb-16 pt-24">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-grow px-4 pb-16 pt-24">
          <div className="mx-auto w-full max-w-6xl">
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                My activity
              </h1>
              <p className="text-sm text-muted-foreground">
                You need to be signed in to view your activity.
              </p>
              <Button
                onClick={() => navigate('/sign-in?returnTo=/account/activity')}
              >
                Sign in
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-graph-page"
      data-treatment={treatment}
      style={graphTreatmentVars(treatment)}
    >
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        {/* The graph chrome tokens zone the account panels; the header and
            footer stay on the site stack because they sit outside it. */}
        <div
          className="mx-auto flex w-full max-w-7xl flex-col gap-8 md:flex-row md:gap-10"
          style={{ fontFamily: 'var(--graph-font-family)' }}
        >
          <AccountNav active="activity" />

          <ActivityPanels onOpenSaved={() => navigate('/account/saved')} />
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default AccountActivity
