import { useState } from 'preact/hooks'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_RETURN_TO,
  type EmailSignInClient,
  type FieldErrors,
  signInErrorMessage,
  submitSignIn,
  validateSignIn,
} from '@/auth/journey'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/hooks/useAdminCheck'
import { FORGOT_PASSWORD_PATH } from './ForgotPassword'

/**
 * The sign-in page, rebuilt to the improved frame (`62:12222`).
 *
 * Two columns instead of a lone centred card: the left column states what the
 * account is for and how a claim reaches its sources, the right carries the form.
 * Three things from the mockup are deliberately not rendered:
 *
 * - **"Email me a sign-in link."** No passwordless sign-in exists in
 *   `server/auth.ts`; shipping the control would promise a delivery the product
 *   cannot make. The divider that introduces it goes with it.
 * - **The confirmation state** ("Check your inbox… use a different email"),
 *   which is the same missing capability.
 * - **The "static examples" rail** below the frames, which is design
 *   documentation rather than page content.
 *
 * Its copy is kept where it describes the real product: the failure line, the
 * email-shape message, and the footnote that an account is not evidence.
 *
 * Colours come from the site theme rather than the account `graph-*` treatment
 * tokens. The sign-in page is pre-auth and public, and the graph tokens have no
 * dark-theme counterparts, so a visitor whose OS prefers dark would get a light
 * card under near-white text. The theme toggle, which defaults to the system
 * preference, is the honest control here.
 */

/** The claim → source → reasoning chips from the mockup's research vignette. */
const TRACE_STEPS: readonly { label: string; trailing?: string }[] = [
  { label: 'Claim', trailing: '→' },
  { label: 'Source', trailing: '→' },
  { label: 'Reasoning' },
]

/**
 * Sign-in page for existing users.
 */
const SignIn = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  const handleSubmit = async (event: Event) => {
    event.preventDefault()
    setError(null)

    const validation = validateSignIn({ email, password })
    if (!validation.ok) {
      setFieldErrors(validation.errors)
      return
    }
    setFieldErrors({})
    setLoading(true)

    const outcome = await submitSignIn(
      authClient as unknown as EmailSignInClient,
      { email, password },
      returnTo,
    )

    setLoading(false)
    if (outcome.ok) {
      navigate(outcome.redirect ?? DEFAULT_RETURN_TO)
    } else {
      setError(signInErrorMessage(outcome.error))
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <section
            aria-labelledby="signin-heading"
            className="flex flex-col gap-6"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                A personal research workspace
              </p>
              <h1
                id="signin-heading"
                className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
              >
                Return to your line of inquiry.
              </h1>
              <p className="mt-3 max-w-prose text-[17px] leading-relaxed text-muted-foreground">
                Keep saved cards, revisit your activity and contribute feedback.
                Your account supports the process—not the conclusion.
              </p>
            </div>

            <div className="rounded-[10px] border border-border bg-card p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Start with a question
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                What connects a claim to its sources?
              </p>
              <ol
                aria-label="Claim, source, reasoning"
                className="mt-4 flex flex-wrap items-center gap-2 text-sm"
              >
                {TRACE_STEPS.map((step) => (
                  <li key={step.label} className="flex items-center gap-2">
                    <span className="rounded-md border border-border bg-muted/50 px-2.5 py-1 font-medium text-foreground">
                      {step.label}
                    </span>
                    {step.trailing ? (
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground"
                      >
                        {step.trailing}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Trace the research. A save or a rating does not establish
                evidence quality.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Browsing before sign-in can create anonymous activity. Account
                activity is associated with your account; transfer of earlier
                activity is not specified here.
              </p>
            </div>
          </section>

          <section
            aria-labelledby="signin-form-heading"
            className="rounded-[10px] border border-border bg-card p-7"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Account / Sign in
            </p>
            <h2
              id="signin-form-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-foreground"
            >
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to keep your research activity with you.
            </p>

            {error ? (
              <div
                role="alert"
                data-testid="signin-error"
                className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  placeholder="you@example.org"
                  autoComplete="email"
                  required
                  disabled={loading}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={
                    fieldErrors.email ? 'signin-email-error' : undefined
                  }
                />
                {fieldErrors.email ? (
                  <p
                    id="signin-email-error"
                    className="text-xs text-destructive"
                  >
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to={FORGOT_PASSWORD_PATH}
                    className="text-sm font-semibold text-graph-accent underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="pr-16"
                    aria-invalid={fieldErrors.password ? true : undefined}
                    aria-describedby={
                      fieldErrors.password ? 'signin-password-error' : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-graph-accent"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p
                    id="signin-password-error"
                    className="text-xs text-destructive"
                  >
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
              New to Trope Deck?{' '}
              <Link
                to="/sign-up"
                className="font-semibold text-graph-accent underline-offset-4 hover:underline"
              >
                Create account →
              </Link>
            </p>
          </section>
        </div>

        <p className="mx-auto mt-10 max-w-5xl text-xs text-muted-foreground">
          Profile, participation and activity are not research evidence.
        </p>
      </main>
      <Footer />
    </div>
  )
}

export default SignIn
