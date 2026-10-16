import { useState } from 'preact/hooks'
import { Link } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/hooks/useAdminCheck'
import { RESET_PASSWORD_PATH } from './ResetPassword'

/** The path that renders {@link ForgotPassword}; linked from the sign-in form. */
export const FORGOT_PASSWORD_PATH = '/forgot-password'

/**
 * Shown after a request whether or not the address exists.
 *
 * Better Auth answers the same way for unknown emails, so this must not differ
 * either — a distinct "no such account" message would leak which addresses are
 * registered.
 *
 * The wording is deliberately *"has been requested"*, not *"we sent"*: the
 * endpoint's 200 means the request was accepted, not that the mail provider
 * delivered it (`sendEmail` is best-effort and can be unconfigured). Promising
 * delivery the server cannot guarantee would be a lie the user cannot act on;
 * telling them to retry if nothing arrives is honest and recoverable.
 */
export const FORGOT_PASSWORD_SENT_MESSAGE =
  'If an account exists for that email address, a reset link has been requested. Check your inbox shortly — if it does not arrive, request another.'

/**
 * The slice of the Better Auth client the reset helpers depend on.
 *
 * Narrowing here (rather than importing the whole client type) keeps the flow
 * testable: the tests pass a plain object that records the call.
 */
export interface PasswordResetClient {
  requestPasswordReset: (args: {
    email: string
    redirectTo: string
  }) => Promise<{ error?: { message?: string } | null } | undefined>
}

/**
 * Ask Better Auth to email a password-reset link.
 *
 * The `redirectTo` is the page the email link bounces back to; it is built from
 * the current origin so the same code works on localhost and in production, and
 * so the value stays inside Better Auth's trusted origins.
 *
 * @param client The auth client (or a test double).
 * @param args.email The address to send the reset link to.
 * @param args.origin The current page origin (e.g. `window.location.origin`).
 * @returns A user-facing error message, or `null` when the request was accepted.
 */
export async function requestPasswordReset(
  client: PasswordResetClient,
  { email, origin }: { email: string; origin: string },
): Promise<string | null> {
  try {
    const result = await client.requestPasswordReset({
      email,
      redirectTo: `${origin}${RESET_PASSWORD_PATH}`,
    })
    if (result?.error?.message) {
      return result.error.message
    }
    return null
  } catch (error) {
    return error instanceof Error
      ? error.message
      : 'Failed to request a password reset'
  }
}

/**
 * Request-password-reset page.
 *
 * Collects an email address and asks Better Auth to mail a reset link. The
 * success state is intentionally identical for known and unknown addresses.
 */
const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const message = await requestPasswordReset(
      authClient as unknown as PasswordResetClient,
      { email, origin: window.location.origin },
    )

    if (message) {
      setError(message)
    } else {
      setSent(true)
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mt-8 space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Reset password
              </h1>
              <p className="text-sm text-muted-foreground">
                Remembered it?{' '}
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
                data-testid="forgot-password-error"
              >
                {error}
              </div>
            )}

            {sent ? (
              <div
                className="rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground"
                data-testid="forgot-password-sent"
              >
                {FORGOT_PASSWORD_SENT_MESSAGE}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending link...' : 'Send reset link'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default ForgotPassword
