import { useState } from 'preact/hooks'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/hooks/useAdminCheck'

/**
 * Sign-in page for existing users.
 */
const SignIn = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || 'Failed to sign in')
      } else {
        // Navigate to returnTo if it's a valid same-origin relative path
        const redirect = returnTo && returnTo.startsWith('/') ? returnTo : '/account'
        navigate(redirect)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mt-8 space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Sign in
              </h1>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/sign-up" className="text-primary hover:underline">
                  Create account
                </Link>
              </p>
            </div>

            {error && (
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid="signin-error"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e: any) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default SignIn
