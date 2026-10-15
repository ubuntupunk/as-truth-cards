import { useState } from 'preact/hooks'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/hooks/useAdminCheck'

/**
 * Sign-up page for new users.
 */
const SignUp = () => {
  const [name, setName] = useState('')
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
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || 'Failed to create account')
      } else {
        const redirect =
          returnTo && returnTo.startsWith('/') ? returnTo : '/account'
        navigate(redirect)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
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
                Create account
              </h1>
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  to="/sign-in"
                  className="font-medium text-graph-accent underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {error && (
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid="signup-error"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e: any) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  disabled={loading}
                />
              </div>

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
                  minLength={8}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default SignUp
