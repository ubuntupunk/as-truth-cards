import { useState } from 'preact/hooks'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_RETURN_TO,
  type EmailSignUpClient,
  MIN_PASSWORD_LENGTH,
  submitSignUp,
} from '@/auth/journey'
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

    const outcome = await submitSignUp(
      authClient as unknown as EmailSignUpClient,
      { name, email, password },
      returnTo,
    )

    setLoading(false)
    if (outcome.ok) {
      navigate(outcome.redirect ?? DEFAULT_RETURN_TO)
    } else {
      setError(outcome.error ?? 'Failed to create account')
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
                  onChange={(e) => setName(e.currentTarget.value)}
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
                  onChange={(e) => setEmail(e.currentTarget.value)}
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
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  required
                  disabled={loading}
                  minLength={MIN_PASSWORD_LENGTH}
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
