/**
 * Saved cards — `/account/saved`.
 *
 * Saving a card has stored an account-bound slug since the first M7 slice
 * (`src/deck/card-save-button.tsx`, `POST /api/saved-cards`), but the only place that
 * listed those slugs was the My activity page, as raw slugs. The improved account panels
 * give Saved cards its own sidebar entry; this route is that surface, which is why the
 * entry could finally be added to {@link AccountNav} without creating a dead link.
 *
 * Data comes from two independent reads and is joined in {@link assembleSavedCards}:
 * the account's saved-slug list (private, ordered newest-first by the API) and the public
 * card listing (titles and summaries). Neither is duplicated server-side — the saved row
 * deliberately stores only the slug.
 *
 * Unsave is optimistic and rolls back on failure, because a card that is still saved must
 * not disappear from the list just because a request failed.
 */

import { useEffect, useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import {
  assembleSavedCards,
  SAVED_CARDS_SIGN_IN_HREF,
  savedCardsPanelState,
} from '@/account/saved-cards-model'
import { listSavedCards, unsaveCard } from '@/auth/saved-cards'
import { AccountNav } from '@/components/account/account-nav'
import { SavedCardsPanel } from '@/components/account/saved-cards-panel'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { useDeckCards } from '@/deck/use-deck'
import {
  type GraphTreatment,
  graphTreatmentVars,
  readGraphTreatment,
} from '@/graph/appearance'
import { useAdminCheck } from '@/hooks/useAdminCheck'

/** The browser's localStorage, or null outside a browser / privacy mode. */
function deviceStorage(): Pick<Storage, 'getItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Best-effort error message extraction. */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== ''
    ? error.message
    : fallback
}

/**
 * Saved cards page: the account's reading list, joined with card titles.
 *
 * @returns The saved-cards route element.
 */
const AccountSaved = () => {
  const navigate = useNavigate()
  const { isSignedIn, loading } = useAdminCheck()
  const cards = useDeckCards()
  const [treatment] = useState<GraphTreatment>(() =>
    readGraphTreatment(deviceStorage()),
  )

  const [savedSlugs, setSavedSlugs] = useState<readonly string[] | null>(null)
  const [savedError, setSavedError] = useState<string | null>(null)
  const [unsavingSlug, setUnsavingSlug] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // reloadToken is an intentional re-run trigger: "Try again" increments it so this
  // effect re-issues the request. It is read nowhere else, which is the point.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is the retry trigger.
  useEffect(() => {
    if (loading) return
    if (!isSignedIn) {
      setSavedSlugs(null)
      setSavedError(null)
      return
    }

    let cancelled = false
    setSavedError(null)
    setSavedSlugs(null)

    listSavedCards()
      .then((slugs) => {
        if (!cancelled) setSavedSlugs(slugs)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSavedError(messageOf(error, 'Could not load your saved cards.'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [loading, isSignedIn, reloadToken])

  const handleUnsave = async (slug: string) => {
    const previous = savedSlugs ?? []
    setNotice(null)
    setUnsavingSlug(slug)
    // Optimistic: the row leaves the list immediately, and returns if the request fails.
    setSavedSlugs(previous.filter((saved) => saved !== slug))
    try {
      await unsaveCard(slug)
    } catch (error) {
      setSavedSlugs(previous)
      setNotice(
        messageOf(
          error,
          'Could not unsave that card. It is still in your saved cards.',
        ),
      )
    } finally {
      setUnsavingSlug(null)
    }
  }

  const handleRetry = () => {
    setSavedError(null)
    setSavedSlugs(null)
    setReloadToken((token) => token + 1)
    if (cards.isError) void cards.refetch()
  }

  const state = savedCardsPanelState({
    sessionLoading: loading,
    isSignedIn,
    savedError,
    savedSlugs,
    cardsPending: cards.isPending,
    cardsError: cards.isError,
    listing:
      savedSlugs !== null && cards.data !== undefined
        ? assembleSavedCards(savedSlugs, cards.data.items)
        : null,
  })

  return (
    <div
      className="flex min-h-screen flex-col bg-graph-page"
      data-treatment={treatment}
      style={graphTreatmentVars(treatment)}
    >
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        {/* The graph chrome tokens zone the account panels; the header and
            footer stay on the site stack because they sit outside it. */}
        <div
          className="mx-auto flex w-full max-w-7xl flex-col gap-8 md:flex-row md:gap-10"
          style={{ fontFamily: 'var(--graph-font-family)' }}
        >
          <AccountNav active="saved" />

          <div className="min-w-0 flex-1 space-y-8">
            <header>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Account / Saved cards
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                The cards you kept.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                A reading list tied to your account. Saving a card records
                interest; it never counts as support for a claim or as evidence.
              </p>
            </header>

            <SavedCardsPanel
              state={state}
              onUnsave={(slug) => {
                void handleUnsave(slug)
              }}
              unsavingSlug={unsavingSlug}
              notice={notice}
            />

            {state.kind === 'error' && (
              <Button onClick={handleRetry}>Try again</Button>
            )}

            {state.kind === 'signed-out' && (
              <Button onClick={() => navigate(SAVED_CARDS_SIGN_IN_HREF)}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default AccountSaved
