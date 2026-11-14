/**
 * Presentational email-address panel for `/account/settings`.
 *
 * The panel states the capability's real shape rather than implying the address
 * changes on submit: a request mails a verification link to the **new** address,
 * and the account keeps its current address until that link is opened. The
 * request outcome is reported as "requested", never as "sent", because delivery
 * is best-effort and invisible to the client (bd as-truth-cards-tid).
 *
 * Every value and transition is a prop, so the copy is render-testable with the
 * string harness and the page owns the request.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Props for {@link EmailPanel}. */
export interface EmailPanelProps {
  /** The address on the account right now. */
  readonly currentEmail: string
  /** Whether that current address is verified. */
  readonly emailVerified: boolean
  /** The in-progress value of the new-address field. */
  readonly value: string
  /** Field-local validation message, shown beside the input. */
  readonly fieldError: string | null
  /** A request is in flight. */
  readonly busy: boolean
  /** A failed request's message. */
  readonly error: string | null
  /** The last accepted request's status line. */
  readonly status: string | null
  /** Called with the new field value on each edit. */
  readonly onChange: (value: string) => void
  /** Called when the form is submitted with a validated value. */
  readonly onSubmit: () => void
}

/** The hint bound to the field for assistive technology. */
const EMAIL_HINT =
  'We mail a verification link to this address. The account keeps its current address until you open that link.'

/**
 * Render the current address, its verification state, and the change form.
 *
 * @param props See {@link EmailPanelProps}.
 * @returns The panel as a labelled section.
 */
export function EmailPanel({
  currentEmail,
  emailVerified,
  value,
  fieldError,
  busy,
  error,
  status,
  onChange,
  onSubmit,
}: EmailPanelProps) {
  return (
    <section
      data-testid="email-panel"
      aria-labelledby="email-panel-heading"
      className="rounded-xl border border-graph-border bg-graph-surface p-5"
    >
      <h2
        id="email-panel-heading"
        className="text-lg font-semibold text-foreground"
      >
        Email address
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p
          className="min-w-0 truncate text-sm text-foreground"
          data-testid="current-email"
        >
          {currentEmail}
        </p>
        <span
          className={
            emailVerified
              ? 'rounded-md bg-graph-accent/10 px-2 py-0.5 text-xs font-semibold text-graph-accent'
              : 'rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400'
          }
          data-testid="email-panel-verification"
        >
          {emailVerified ? 'Email verified' : 'Email not verified'}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Changing your email mails a verification link to the new address. The
        change completes only when that link is opened; until then this account
        keeps {currentEmail}.
      </p>

      {emailVerified ? null : (
        <p
          className="mt-2 text-xs leading-relaxed text-muted-foreground"
          data-testid="email-panel-unverified-note"
        >
          This address is not marked verified. A new address is marked verified
          only after you open its link.
        </p>
      )}

      <form
        className="mt-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="change-email">New email address</Label>
          <Input
            id="change-email"
            name="email"
            type="email"
            autoComplete="email"
            value={value}
            disabled={busy}
            aria-invalid={fieldError !== null ? true : undefined}
            aria-describedby={
              fieldError !== null
                ? 'change-email-hint change-email-field-error'
                : 'change-email-hint'
            }
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <p
            id="change-email-hint"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            {EMAIL_HINT}
          </p>
          {fieldError !== null && (
            <p
              id="change-email-field-error"
              className="text-xs font-medium text-destructive"
              data-testid="change-email-field-error"
            >
              {fieldError}
            </p>
          )}
        </div>

        <Button type="submit" disabled={busy}>
          {busy ? 'Requesting…' : 'Request email change'}
        </Button>

        {status !== null && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-muted-foreground"
            data-testid="change-email-status"
          >
            {status}
          </p>
        )}

        {error !== null && (
          <p
            role="alert"
            className="text-xs font-medium text-destructive"
            data-testid="change-email-error"
          >
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
