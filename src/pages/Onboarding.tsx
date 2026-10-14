import { useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { authClient, useAdminCheck } from '@/hooks/useAdminCheck'

/**
 * Onboarding page for new users.
 */
const Onboarding = () => {
  const { isSignedIn, user, loading } = useAdminCheck()
  const [completing, setCompleting] = useState(false)
  const navigate = useNavigate()

  const handleComplete = async () => {
    setCompleting(true)
    try {
      navigate('/account')
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
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
                Let's get you set up
              </p>
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-foreground">
                Welcome, {user.name}! You're all set to start exploring and
                participating in Trope Deck.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleComplete} disabled={completing}>
                {completing ? 'Completing...' : 'Complete onboarding'}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Onboarding
