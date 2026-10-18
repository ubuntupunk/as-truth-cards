import { AppearanceSelector } from '@/components/appearance-selector'
import { Button } from '@/components/ui/button'
import type { GraphTreatment } from '@/graph/appearance'

/**
 * The "Private account" card from the improved profile panel (`62:13320`):
 * the email address with its honest verification state, and the appearance
 * selector.
 *
 * The improved mockup only draws the *verified* state ("Email verified" badge,
 * "Change email in Settings" action). The unverified state is the
 * spec-required counterpart (SPEC §9.4 authenticated-unverified, §17
 * onboarding≠verification, §10 amber-with-textual-status): an amber "Email not
 * verified" badge plus a real resend action wired to Better Auth's existing
 * verification capability. "Change email in Settings" is omitted — email
 * change is not implemented anywhere yet, and a dead button would misrepresent
 * that. Both omissions are labelled design decisions in the issue report.
 */

/** Props for {@link PrivateAccountCard}. */
export interface PrivateAccountCardProps {
  email: string
  emailVerified: boolean
  resendStatus: 'idle' | 'sending' | 'sent'
  resendError: string | null
  onResend: () => void
  treatment: GraphTreatment
  onSelectTreatment: (treatment: GraphTreatment) => void
}

/**
 * Render the private account card.
 *
 * @param props Email, verification state, resend controls and appearance.
 * @returns The private account card.
 */
export const PrivateAccountCard = ({
  email,
  emailVerified,
  resendStatus,
  resendError,
  onResend,
  treatment,
  onSelectTreatment,
}: PrivateAccountCardProps) => (
  <section
    aria-label="Private account"
    className="min-w-0 flex-1 rounded-xl border border-border bg-card p-6"
    data-testid="private-account-card"
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Private account
      </p>
      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Only in account details
      </span>
    </div>

    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Email address
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <p
          className="min-w-0 truncate text-sm text-foreground"
          data-testid="account-email"
        >
          {email}
        </p>
        {emailVerified ? (
          <span
            className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
            data-testid="verification-status"
          >
            Email verified
          </span>
        ) : (
          <span
            className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
            data-testid="verification-status"
          >
            Email not verified
          </span>
        )}
      </div>

      {emailVerified ? null : (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResend}
            disabled={resendStatus === 'sending'}
            data-testid="resend-verification"
          >
            {resendStatus === 'sending'
              ? 'Sending…'
              : 'Resend verification email'}
          </Button>
          {resendStatus === 'sent' ? (
            <p
              role="status"
              className="text-xs text-muted-foreground"
              data-testid="resend-verification-status"
            >
              If this address can receive mail, a verification link is on its
              way.
            </p>
          ) : null}
          {resendError ? (
            <p
              role="alert"
              className="text-xs text-destructive"
              data-testid="resend-verification-error"
            >
              {resendError}
            </p>
          ) : null}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        {emailVerified
          ? 'Verification applies to this email address only. It does not establish research expertise.'
          : 'Verification confirms this email address only. It does not establish research expertise.'}
      </p>
    </div>

    <div className="mt-6 space-y-3 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Appearance
      </p>
      <AppearanceSelector value={treatment} onSelect={onSelectTreatment} />
    </div>

    <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
      Your email, sessions and activity are not public profile fields. Profile
      and participation are not research evidence.
    </p>
  </section>
)
