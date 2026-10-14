import { useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { authClient, useAdminCheck } from '@/hooks/useAdminCheck'

/**
 * Account settings page.
 */
const Account = () => {
  const { isSignedIn, user, loading, role } = useAdminCheck()
  const [signingOut, setSigningOut] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
      navigate('/')
    } catch (err) {
      console.error('Failed to sign out:', err)
    } finally {
      setSigningOut(false)
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
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-grow px-4 pb-16 pt-24">
          <div className="mx-auto w-full max-w-2xl">
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Account
              </h1>
              <p className="text-sm text-muted-foreground">
                You need to be signed in to view this page.
              </p>
              <Button onClick={() => navigate('/sign-in?returnTo=/account')}>
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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto w-full max-w-2xl">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Account
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage your account settings
              </p>
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-card p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Profile
                </h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Name</p>
                  <p className="text-sm text-muted-foreground">{user.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Role</p>
                  <p className="text-sm text-muted-foreground">
                    {role || 'ANONYMOUS'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Status</p>
                  <p className="text-sm text-muted-foreground">
                    {user.emailVerified ? 'Verified' : 'Unverified'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Account
