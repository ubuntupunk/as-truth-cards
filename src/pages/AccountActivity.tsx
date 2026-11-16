import { useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import { AccountNav } from '@/components/account/account-nav'
import { ActivityPanels } from '@/components/account/activity-panels'
import { PageMain, PageShell } from '@/components/page-shell'
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
      <PageShell>
        <PageMain>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </PageMain>
      </PageShell>
    )
  }

  if (!isSignedIn) {
    return (
      <PageShell>
        <PageMain>
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
        </PageMain>
      </PageShell>
    )
  }

  return (
    <PageShell treatment={treatment} style={graphTreatmentVars(treatment)}>
      <PageMain
        innerClassName="flex flex-col gap-8 md:flex-row md:gap-10"
        innerStyle={{ fontFamily: 'var(--graph-font-family)' }}
      >
        <AccountNav active="activity" />

        <ActivityPanels onOpenSaved={() => navigate('/account/saved')} />
      </PageMain>
    </PageShell>
  )
}

export default AccountActivity
