/**
 * Save/unsave button for cards with auth-aware behaviour.
 *
 * Signed out, the affordance is deliberately non-operative with its reason as
 * visible text (`aria-describedby`): saving is account-bound, so the button is
 * disabled and the note says why. Signed in, the toggle calls the account's
 * saved-cards API (`check` on mount, save/unsave on click).
 *
 * The signed-in toggle is a separate hooks component so the signed-out branch
 * stays hook-free — the deck tests invoke these presentational components as
 * plain functions, and the browser bundle is ESM where a runtime `require`
 * would throw. An earlier version resolved `preact/hooks` through `require`
 * inside a try/catch; in the ESM browser bundle `require` is `undefined`, so
 * the catch arm rendered the no-op fallback for signed-in readers too and
 * clicks did nothing. Static imports make both arms behave identically in
 * tests and in the running app.
 */
import { useEffect, useState } from 'preact/hooks'
import { checkSaved, saveCard, unsaveCard } from '@/auth/saved-cards'

export type CardSaveButtonProps = {
  readonly slug: string
  readonly isSignedIn?: boolean
}

const SAVE_CARD_NOTE_ID = 'save-card-note'

/**
 * The signed-in save/unsave toggle.
 *
 * Checks the card's saved state once per slug, then flips it through the
 * account API. The button is disabled only while a save/unsave request is in
 * flight, and its label always names the action it will perform.
 *
 * @param props See {@link CardSaveButtonProps}.
 * @returns The enabled save/unsave button with an error notice when a
 * save/unsave request fails.
 */
function SaveCardToggle({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    checkSaved(slug)
      .then((isSaved: boolean) => {
        if (!cancelled) setSaved(isSaved)
      })
      .catch(() => {
        // A failed check must not block saving; the click path reports errors.
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      if (saved) {
        await unsaveCard(slug)
        setSaved(false)
      } else {
        await saveCard(slug)
        setSaved(true)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update saved cards.',
      )
      console.error('Failed to toggle save:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        data-testid="save-card"
        disabled={loading}
        onClick={handleClick}
        className={`min-h-[44px] rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
          saved
            ? 'border-border bg-muted text-foreground hover:bg-muted/80'
            : 'border-border bg-background text-foreground hover:bg-muted'
        }`}
      >
        {loading ? 'Saving…' : saved ? 'Unsave card' : 'Save card'}
      </button>
      {error && (
        <p
          id="save-card-error"
          data-testid="save-card-error"
          aria-live="polite"
          className="text-xs text-destructive font-medium"
        >
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Save/unsave button for cards with auth-aware behaviour.
 *
 * @param props See {@link CardSaveButtonProps}.
 * @returns The disabled signed-out affordance with its reason, or the
 * signed-in {@link SaveCardToggle}.
 */
export function CardSaveButton({
  slug,
  isSignedIn = false,
}: CardSaveButtonProps) {
  if (isSignedIn) {
    return <SaveCardToggle slug={slug} />
  }

  // Signed out: visibly non-operative with the reason as visible text. The
  // button is disabled, so it carries no click handler — the header's
  // Sign-in link is the route into the account flow.
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-describedby={SAVE_CARD_NOTE_ID}
        data-testid="save-card"
        disabled
        className="min-h-[44px] cursor-not-allowed rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground"
      >
        Save card
      </button>
      <p
        id={SAVE_CARD_NOTE_ID}
        className="max-w-xs text-xs text-muted-foreground"
      >
        Sign in to save cards to your account.
      </p>
    </div>
  )
}
