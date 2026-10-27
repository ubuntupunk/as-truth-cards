/**
 * Save/unsave button for cards with auth-aware behavior.
 */
import { checkSaved, saveCard, unsaveCard } from '@/auth/saved-cards'

export type CardSaveButtonProps = {
  readonly slug: string
  readonly isSignedIn?: boolean
}

const SAVE_CARD_NOTE_ID = 'save-card-note'

/**
 * Save/unsave button for cards with auth-aware behavior.
 * Uses hooks when available, falls back gracefully for SSR/tests.
 */
export function CardSaveButton({ slug, isSignedIn = false }: CardSaveButtonProps) {
  // Try to use hooks if available
  let useEffect: any
  let useState: any
  try {
    const hooks = require('preact/hooks')
    useEffect = hooks.useEffect
    useState = hooks.useState
  } catch {
    // Fallback for environments without hooks
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          aria-describedby={!isSignedIn ? SAVE_CARD_NOTE_ID : undefined}
          data-testid="save-card"
          disabled={!isSignedIn}
          onClick={() => {
            if (!isSignedIn && typeof window !== 'undefined') {
              const returnTo = window.location.pathname + window.location.search
              window.location.assign(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`)
            }
          }}
          className={`min-h-[44px] rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            isSignedIn
              ? 'border-border bg-background text-foreground hover:bg-muted'
              : 'cursor-pointer border-border bg-background text-foreground hover:bg-muted'
          }`}
        >
          Save card
        </button>
        {!isSignedIn && (
          <p id={SAVE_CARD_NOTE_ID} className="max-w-xs text-xs text-muted-foreground">
            Sign in to save cards to your account.
          </p>
        )}
      </div>
    )
  }

  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isSignedIn || !slug) return
    let cancelled = false
    checkSaved(slug)
      .then((s: boolean) => {
        if (!cancelled) setSaved(s)
      })
      .catch(() => {
        // ignore
      })
    return () => {
      cancelled = true
    }
  }, [slug, isSignedIn])

  const handleClick = async () => {
    if (!isSignedIn) {
      const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
      window.location.assign(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }
    setLoading(true)
    try {
      if (saved) {
        await unsaveCard(slug)
        setSaved(false)
      } else {
        await saveCard(slug)
        setSaved(true)
      }
    } catch (err) {
      console.error('Failed to toggle save:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-describedby={!isSignedIn ? SAVE_CARD_NOTE_ID : undefined}
        data-testid="save-card"
        disabled={loading}
        onClick={handleClick}
        className={`min-h-[44px] rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
          isSignedIn
            ? saved
              ? 'border-border bg-muted text-foreground hover:bg-muted/80'
              : 'border-border bg-background text-foreground hover:bg-muted'
            : 'cursor-pointer border-border bg-background text-foreground hover:bg-muted'
        }`}
      >
        {loading ? 'Saving...' : saved ? 'Unsave card' : 'Save card'}
      </button>
      {!isSignedIn && (
        <p id={SAVE_CARD_NOTE_ID} className="max-w-xs text-xs text-muted-foreground">
          Sign in to save cards to your account.
        </p>
      )}
    </div>
  )
}
