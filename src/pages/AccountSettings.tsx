import { useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import { AccountNav } from '@/components/account/account-nav'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { ResearchPreferencesPanel } from '@/components/research-preferences-panel'
import { Button } from '@/components/ui/button'
import {
  GRAPH_TREATMENT_LABELS,
  type GraphTreatment,
  graphTreatmentVars,
  readGraphTreatment,
  writeGraphTreatment,
} from '@/graph/appearance'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import {
  type ParticipationPreferences,
  readParticipationPreferences,
  saveParticipationPreferences,
} from '@/onboarding/preferences'

/**
 * The account settings page — parity with the other account surfaces:
 * the same sidebar, the same treatment zone, and the research-preferences panel
 * the onboarding completion panel's "Review Settings" opens.
 *
 * The panel is where the answers collected in guided setup are actually
 * editable. They are device-local (there is no account column for them, and
 * this project does not invent one), so the page says "stored on this device"
 * rather than implying the account owns them.
 */

/** The browser's localStorage, or null outside a browser / privacy mode. */
function deviceStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Settings page: research preferences, appearance, and the profile pointer.
 *
 * @returns The settings route element.
 */
const AccountSettings = () => {
  const { isSignedIn, user, loading } = useAdminCheck()
  const navigate = useNavigate()
  const [preferences, setPreferences] = useState<ParticipationPreferences>(() =>
    readParticipationPreferences(deviceStorage()),
  )
  const [treatment, setTreatment] = useState<GraphTreatment>(() =>
    readGraphTreatment(deviceStorage()),
  )
  const [pendingExit, setPendingExit] = useState<'activity' | 'profile' | null>(
    null,
  )

  const handleSave = async (
    next: ParticipationPreferences,
    nextTreatment: GraphTreatment,
  ) => {
    saveParticipationPreferences(next, deviceStorage())
    writeGraphTreatment(nextTreatment, deviceStorage())
    setPreferences(next)
    setTreatment(nextTreatment)
  }

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

  if (!isSignedIn || !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-grow px-4 pb-16 pt-24">
          <div className="mx-auto w-full max-w-6xl">
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Settings
              </h1>
              <p className="text-sm text-muted-foreground">
                You need to be signed in to manage your settings.
              </p>
              <Button
                onClick={() => navigate('/sign-in?returnTo=/account/settings')}
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
          <AccountNav active="settings" />

          <div className="min-w-0 flex-1 space-y-8">
            <header>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Account / Settings
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Set the terms you work on.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Research preferences are optional and stay on this device.
                Profile, email and sessions stay in your account.
              </p>
            </header>

            <ResearchPreferencesPanel
              values={preferences}
              treatment={treatment}
              name={user.name}
              summary={{
                profile: user.name,
                appearance: GRAPH_TREATMENT_LABELS[treatment],
                researchPreferences: '',
              }}
              onSave={handleSave}
              onEditProfile={() => navigate('/account')}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
              <p className="text-xs text-muted-foreground">
                Signed in as {user.email}
              </p>
              <Button
                variant="outline"
                onClick={() => setPendingExit('activity')}
              >
                My activity
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {pendingExit ? (
        <div
          role="alertdialog"
          aria-label="Unsaved preferences"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-graph-border bg-graph-surface p-4"
          data-testid="settings-unsaved-prompt"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              You have unsaved preference changes. Leaving discards them.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => setPendingExit(null)}>
                Keep editing
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate(
                    pendingExit === 'profile'
                      ? '/account'
                      : '/account/activity',
                  )
                }
              >
                Leave and discard
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AccountSettings
