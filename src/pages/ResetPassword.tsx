import { useState } from 'preact/hooks'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/hooks/useAdminCheck'

/** The path the reset email redirects back to (`?token=…` or `?error=…`). */
export const RESET_PASSWORD_PATH = '/reset-password'

/** Shown when the link carried no token, or a token Better Auth rejected. */
export const INVALID_RESET_TOKEN_MESSAGE =
  'This reset link is invalid or has expired. Request a new one.'

/** Client-side check before the request leaves the browser. */
export const PASSWORDS_DO_NOT_MATCH_MESSAGE = 'Those passwords don’t match.'

/**
 * The slice of the Better Auth client {@link submitResetPassword} depends on.
 *
 * Narrowed so the flow can be tested with a recording double rather than the
 * real (untyped) client.
 */
export interface ResetPasswordClient {
  resetPassword: (args: {
    newPassword: string
    token: string
  }) => Promise<{ error?: { message?: string } | null } | undefined>
}

/** Whether the page has a usable token to work with. */
export type ResetTokenState = 'ready' | 'invalid'

/**
 * Decide whether the reset form may render.
 *
 * Better Auth either redirects back with `?token=…` (valid link) or
 * `?error=INVALID_TOKEN` (expired/replayed link); a bare visit with neither is
 * treated as invalid too, so the form never submits an empty token.
 *
 * @param args.token The `token` query parameter, when present.
 * @param args.error The `error` query parameter, when present.
 * @returns `'ready'` when the form should render, `'invalid'` otherwise.
 */
export function resetTokenState({
  token,
  error,
}: {
  token: string | null
  error: string | null
}): ResetTokenState {
  if (error || !token) return 'invalid'
  return 'ready'
}

/**
 * Check the two password fields agree before submitting.
 *
 * @param password The new password.
 * @param confirm The confirmation field.
 * @returns An error message, or `null` when the pair is acceptable.
 */
export function validateNewPassword(
  password: string,
  confirm: string,
): string | null {
  if (password !== confirm) return PASSWORDS_DO_NOT_MATCH_MESSAGE
  return null
}

/**
 * Complete the reset by handing the new password and token to Better Auth.
 *
 * @param client The auth client (or a test double).
 * @param args.token The verification token from the email link.
 * @param args.password The new password.
 * @param args.confirm The confirmation field.
 * @returns A user-facing error message, or `null` when the reset succeeded.
 */
export async function submitResetPassword(
  client: ResetPasswordClient,
  {
    token,
    password,
    confirm,
  }: { token: string; password: string; confirm: string },
): Promise<string | null> {
  const mismatch = validateNewPassword(password, confirm)
  if (mismatch) return mismatch

  try {
    const result = await client.resetPassword({ newPassword: password, token })
    if (result?.error?.message) {
      return result.error.message
    }
    return null
  } catch (error) {
    return error instanceof Error
      ? error.message
      : 'Failed to reset your password'
  }
}

/**
 * Choose-a-new-password page reached from the reset email.
 *
 * Reads `token`/`error` from the query string: an invalid or absent token shows a
 * route back to the request form instead of a form that cannot submit.
 */
const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const state = resetTokenState({ token, error: searchParams.get('error') })

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (state === 'invalid' || !token) return
    setError(null)
    setLoading(true)

    const message = await submitResetPassword(
      authClient as unknown as ResetPasswordClient,
      { token, password, confirm },
    )

    if (message) {
      setError(message)
    } else {
      setDone(true)
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
                Choose a new password
              </h1>
            </div>

            {state === 'invalid' && (
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid="reset-password-invalid"
              >
                {INVALID_RESET_TOKEN_MESSAGE}{' '}
                <Link
                  to="/forgot-password"
                  className="font-medium underline underline-offset-4"
                >
                  Request another link
                </Link>
              </div>
            )}

            {error && (
              <div
                className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid="reset-password-error"
              >
                {error}
              </div>
            )}

            {done ? (
              <div
                className="rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground"
                data-testid="reset-password-done"
              >
                Your password has been reset.{' '}
                <Link
                  to="/sign-in"
                  className="font-medium text-graph-accent underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </div>
            ) : (
              state === 'ready' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.currentTarget.value)}
                      required
                      disabled={loading}
                      minLength={8}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm new password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.currentTarget.value)}
                      required
                      disabled={loading}
                      minLength={8}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Resetting...' : 'Reset password'}
                  </Button>
                </form>
              )
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default ResetPassword
