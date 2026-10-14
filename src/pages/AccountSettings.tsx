import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { useAdminCheck } from '@/hooks/useAdminCheck'

/**
 * Account settings page.
 */
const AccountSettings = () => {
  const { isSignedIn, loading } = useAdminCheck()

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
                Settings
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage your account preferences
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                {isSignedIn
                  ? 'Additional settings will be available soon.'
                  : 'Sign in to manage your settings.'}
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default AccountSettings
