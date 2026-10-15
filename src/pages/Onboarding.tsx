import { useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import { completeOnboarding } from '@/auth/onboarding'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { useAdminCheck } from '@/hooks/useAdminCheck'

/**
 * Onboarding page for new users.
 *
 * Completion is persisted server-side via {@link completeOnboarding}; the page
 * does not merely navigate. It also distinguishes the two account states
 * honestly: a user whose account already records `onboardedAt` sees a
 * "already set up" panel instead of a completion button, so re-visiting the route
 * never implies the account is not yet set up.
 */
const Onboarding = () => {
  const { isSignedIn, user, loading, onboardingComplete, refetch } =
    useAdminCheck()
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleComplete = async () => {
    setCompleting(true)
    setError(null)
    try {
      await completeOnboarding()
      await refetch()
      navigate('/account')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save onboarding progress',
      )
    } finally {
      setCompleting(false)
    }
  }

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

  if (!isSignedIn || !user) {
    navigate('/sign-in')
    return null
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto w-full max-w-2xl">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Welcome to Trope Deck
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {onboardingComplete
                  ? 'Your account is already set up'
                  : "Let's get you set up"}
              </p>
            </div>

            {error && (
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid="onboarding-error"
              >
                {error}
              </div>
            )}

            <div className="space-y-4 rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-foreground">
                {onboardingComplete
                  ? `Welcome back, ${user.name}. Onboarding was completed on your account.`
                  : `Welcome, ${user.name}! You're all set to start exploring and participating in Trope Deck.`}
              </p>
            </div>

            <div className="flex justify-end">
              {onboardingComplete ? (
                <Button onClick={() => navigate('/account')}>
                  Go to account
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={completing}>
                  {completing ? 'Completing...' : 'Complete onboarding'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Onboarding
