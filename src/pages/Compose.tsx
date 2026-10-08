/**
 * The Compose / Decompose surface — Phase C, route `/research/compose`.
 *
 * A vertical slice that is *honest about what it may write*: the read half (the card's
 * canonical decomposition, its claims, the authoring pool) comes from `GET /api/graph`, and
 * the write half (steps, chains) goes only to the drafts API — a per-user
 * `decomposition_drafts` row that can never become canonical. The two never cross: the pool
 * is drawn from the card's own claims only, chains attach only the draft's own steps, and
 * there is no button that promotes a draft.
 *
 * Render order is the honesty contract inherited from the other read surfaces:
 *
 * 1. card picker and status first — a deep link `?card=<slug>` is the only navigation, and an
 *    unknown slug is called out rather than guessed at;
 * 2. then the vocabulary and the projection (loading / API error / malformed shape);
 * 3. then the canonical decomposition panel and the authoring surface.
 *
 * Auth is derived, not fetched twice: the drafts GET is the only gated request, so a 401
 * *is* the signed-out state, an in-flight GET is the "checking" state, and a success is
 * signed-in. The authoring surface is what those three states gate. Switching cards remounts
 * that surface (`key={slug}`), so an author never carries one card's draft into another's.
 */

import { useEffect, useMemo, useState } from 'preact/hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { CanonicalDecomposition } from '@/compose/canonical-read'
import {
  ComposeEditor,
  PermissionGate,
  SaveBar,
} from '@/compose/compose-editor'
import {
  type ComposeAuthState,
  canSaveDraft,
  draftIssues,
  draftsEqual,
  EMPTY_DRAFT,
} from '@/compose/compose-model'
import type {
  CanonicalClaim,
  ComposeProjection,
} from '@/compose/compose-projector'
import { claimPool, selectComposeProjection } from '@/compose/compose-projector'
import type { DraftPayload, DraftVocabulary } from '@/compose/draft-types'
import {
  useCanonicalProjection,
  useComposeDraft,
  useDeleteDraft,
  useDraftVocabularies,
  useSaveDraft,
} from '@/compose/use-compose'
import { useDeckCards } from '@/deck/use-deck'
import {
  ApiErrorState,
  LoadingState,
  MalformedState,
} from '@/graph/graph-states'
import { ProjectionShapeError } from '@/graph/projection-guards'
import { GraphApiError } from '@/graph/use-graph'

/** The drafts GET's contract violation that means "no session". */
const NO_SESSION_STATUS = 401

/**
 * The authoring workspace for one card.
 *
 * Owns the draft query, the save/delete mutations and the authoring slate. Remounted per
 * card (the page keys it by slug), so all of its state resets exactly when the card
 * changes, and no effect has to chase that transition.
 *
 * @param props The card slug, the served vocabulary, and the scoped canonical readout.
 * @returns Save bar, canonical read, and the gated editor.
 */
function ComposeWorkspace({
  slug,
  vocab,
  projection,
  pool,
  onSignIn,
}: {
  slug: string
  vocab: DraftVocabulary
  projection: ComposeProjection
  pool: ReadonlyMap<string, CanonicalClaim>
  onSignIn: () => void
}) {
  const draftQuery = useComposeDraft(slug)
  const saveMutation = useSaveDraft(slug)
  const deleteMutation = useDeleteDraft(slug)

  const signedIn = draftQuery.data !== undefined
  const signedOut =
    draftQuery.error instanceof GraphApiError &&
    draftQuery.error.status === NO_SESSION_STATUS
  const auth: ComposeAuthState = signedIn
    ? 'signed-in'
    : signedOut
      ? 'signed-out'
      : 'signing-in'

  const serverPayload = draftQuery.data?.draft?.payload ?? EMPTY_DRAFT

  const [localDraft, setLocalDraft] = useState<DraftPayload | null>(null)

  // Hydrate once, after the drafts GET settles. Intentionally not re-synced on every
  // refetch, so a revalidation never clobbers a draft the author is mid-edit on.
  useEffect(() => {
    if (localDraft === null && draftQuery.isSuccess) {
      setLocalDraft(
        structuredClone(draftQuery.data.draft?.payload ?? EMPTY_DRAFT),
      )
    }
  }, [localDraft, draftQuery])

  const dirty = localDraft !== null && !draftsEqual(localDraft, serverPayload)
  const hasDraft = draftQuery.data?.draft !== null
  const savedAt = draftQuery.data?.draft?.updatedAt ?? null

  const issues = useMemo(
    () => (localDraft !== null ? draftIssues(localDraft) : []),
    [localDraft],
  )
  const canSave = localDraft !== null && canSaveDraft(localDraft)

  const onSave = () => {
    if (localDraft !== null && canSave) saveMutation.mutate(localDraft)
  }
  const onDiscard = () => {
    if (dirty) setLocalDraft(structuredClone(serverPayload))
  }
  const onDelete = () => {
    if (!hasDraft) return
    deleteMutation.mutate(undefined, {
      onSuccess: () => setLocalDraft(structuredClone(EMPTY_DRAFT)),
    })
  }

  const savingError =
    saveMutation.error instanceof GraphApiError
      ? saveMutation.error.message
      : null

  if (draftQuery.isLoading) {
    return <LoadingState labelled="Loading your draft…" />
  }
  if (draftQuery.isError && !signedOut) {
    return <ApiErrorState error={draftQuery.error} />
  }

  return (
    <div data-testid="compose-editor-region" className="space-y-4">
      <SaveBar
        auth={auth}
        dirty={dirty}
        canSave={canSave}
        issueCount={issues.length}
        hasDraft={hasDraft}
        savedAt={savedAt}
        saving={saveMutation.isPending}
        savingError={savingError}
        onSave={onSave}
        onDiscard={onDiscard}
        onDelete={onDelete}
      />
      <CanonicalDecomposition data={projection} />
      <PermissionGate auth={auth} onSignIn={onSignIn}>
        {localDraft !== null ? (
          <ComposeEditor
            draft={localDraft}
            vocab={vocab}
            pool={pool}
            issues={issues}
            onChange={setLocalDraft}
          />
        ) : (
          <LoadingState labelled="Loading your draft…" />
        )}
      </PermissionGate>
    </div>
  )
}

/**
 * The `/research/compose` page.
 *
 * @returns The composed screen: card picker, canonical read, authoring surface.
 */
const Compose = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedSlug = searchParams.get('card')

  const cardsQuery = useDeckCards()
  const cards = cardsQuery.data?.items ?? []
  const listingLoaded = cardsQuery.data !== undefined || cardsQuery.isError

  const unknownSlug =
    listingLoaded && requestedSlug !== null
      ? !cards.some((card) => card.slug === requestedSlug)
      : false
  const activeSlug = unknownSlug ? null : requestedSlug

  const vocabQuery = useDraftVocabularies()
  const projectionQuery = useCanonicalProjection(activeSlug)

  const cardId =
    projectionQuery.data?.nodes.find((node) => node.type === 'card')?.id ?? null
  const projection =
    projectionQuery.data !== undefined && cardId !== null
      ? selectComposeProjection(projectionQuery.data, cardId)
      : null
  const pool = useMemo(
    () =>
      projectionQuery.data !== undefined && cardId !== null
        ? claimPool(projectionQuery.data, cardId)
        : new Map<string, CanonicalClaim>(),
    [projectionQuery.data, cardId],
  )

  const onPickCard = (slug: string) => {
    if (slug === '') setSearchParams({})
    else setSearchParams({ card: slug })
  }

  const picker = (
    <section
      data-testid="compose-picker"
      aria-label="Choose a card"
      className="rounded-lg border border-graph-border/70 bg-graph-muted/30 p-4"
    >
      <span className="block text-xs font-medium text-muted-foreground">
        Card
      </span>
      {cardsQuery.isLoading ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Loading the card list…
        </p>
      ) : cards.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          No cards in the corpus yet.
        </p>
      ) : (
        <select
          data-testid="compose-picker-select"
          aria-label="Card"
          value={activeSlug ?? ''}
          onChange={(event) =>
            onPickCard((event.target as HTMLSelectElement).value)
          }
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Pick a card…</option>
          {cards.map((card) => (
            <option key={card.slug} value={card.slug}>
              {card.title}
            </option>
          ))}
        </select>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        Author a decomposition of one card. The canonical reasoning is shown for
        study, kept separate, and never edited here.
      </p>
    </section>
  )

  const renderEditor = () => {
    if (unknownSlug) {
      return (
        <div
          data-testid="compose-unknown-card"
          className="rounded-lg border border-dashed border-graph-border/70 bg-graph-muted/30 p-4"
        >
          <p className="text-sm text-foreground">
            “{requestedSlug}” is not a card in the served listing.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick one from the list to author its decomposition.
          </p>
        </div>
      )
    }

    if (activeSlug === null) {
      return (
        <p
          data-testid="compose-nothing-chosen"
          className="rounded-lg border border-dashed border-graph-border/70 bg-graph-muted/30 p-4 text-sm text-muted-foreground"
        >
          Choose a card above to start composing.
        </p>
      )
    }

    if (vocabQuery.isLoading || projectionQuery.isLoading) {
      return <LoadingState labelled="Loading the decomposition…" />
    }
    if (vocabQuery.error instanceof ProjectionShapeError) {
      return <MalformedState error={vocabQuery.error} />
    }
    if (vocabQuery.isError) {
      return <ApiErrorState error={vocabQuery.error} />
    }
    if (projectionQuery.error instanceof ProjectionShapeError) {
      return <MalformedState error={projectionQuery.error} />
    }
    if (projectionQuery.isError) {
      return <ApiErrorState error={projectionQuery.error} />
    }
    if (
      vocabQuery.data === undefined ||
      projectionQuery.data === undefined ||
      projection === null
    ) {
      return <LoadingState labelled="Loading the decomposition…" />
    }

    return (
      <ComposeWorkspace
        key={activeSlug}
        slug={activeSlug}
        vocab={vocabQuery.data.vocabularies}
        projection={projection}
        pool={pool}
        onSignIn={() => navigate('/admin')}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        <div className="mx-auto w-full max-w-5xl">
          <nav
            data-testid="compose-context-bar"
            aria-label="Breadcrumb"
            className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span>Trope Cards</span>
            <span aria-hidden="true">·</span>
            <span>Research</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-foreground">Compose</span>
          </nav>

          <header className="mt-4" data-testid="compose-heading">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Research / Compose
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              Compose
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Study a card's canonical decomposition, then author your own —
              saved to your account, never into the corpus.
            </p>
          </header>

          <div className="mt-5 space-y-4">
            {picker}
            {renderEditor()}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Compose
