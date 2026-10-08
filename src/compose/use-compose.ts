/**
 * TanStack Query hooks for the Compose/Decompose drafts API.
 *
 * Same shape as `src/graph/use-graph.ts`: a validated fetch path shared by every request, a
 * Query key that mirrors the request exactly, and `retry: false` everywhere, so a 401
 * ("signed out") or a 400 ("the draft is invalid") surfaces as a state instead of a
 * spinner. The server is the vocabulary and structure authority; the guards here only check
 * envelopes, and the served vocabulary is what populates the editor's options.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'
import {
  assertGraphProjection,
  ProjectionShapeError,
} from '../graph/projection-guards'
import { fetchValidated, GraphApiError } from '../graph/use-graph'
import {
  type DraftPayload,
  type DraftReadResponse,
  type DraftSaveResponse,
  isDraftEnvelope,
  isVocabulariesResponse,
  type StoredDraft,
  type VocabulariesResponse,
} from './draft-types'

/** React Query key for the vocabulary catalogue. */
export const DRAFT_VOCABULARIES_QUERY_KEY = [
  'composition',
  'vocabularies',
] as const

/**
 * The React Query key for one user's draft on one card.
 *
 * Scoped by card slug; the query returns a *signed-in* user's own draft, and a signed-out
 * session sees a 401, which the page maps to the signed-out state. The key does not carry
 * the user id — signing in does not change the URL, so the cache is cleared by the mutation
 * invalidations rather than by a key that would go stale mid-session.
 *
 * @param cardSlug The card the draft is authored against.
 * @returns A stable `['composition', 'draft', cardSlug]` tuple.
 */
export function composeDraftQueryKey(cardSlug: string): readonly unknown[] {
  return ['composition', 'draft', cardSlug]
}

/**
 * The canonical decomposition projection the editor studies, from the graph API.
 *
 * Reuses the shared projection query so the read view and the Deck can never disagree about
 * what the canonical corpus says. The `argument` view is the one that emits `argument_chain`
 * nodes as first-class citizens; the taxonomy view excludes them, so a draft chain could
 * never be set beside a canonical one. Depth 3 is what reaches a chain from its card: the
 * chain sits one hop past the step, so depth 2 would hide every canonical chain. The gating
 * rule (disabled until a focus exists) is the same one the Graph page uses, hoisted into a
 * plain option object for testability.
 *
 * @param cardSlug The card to project.
 * @returns The projection query options.
 */
export function canonicalProjectionQueryOptions(cardSlug: string | null) {
  const params = {
    focus: cardSlug,
    view: 'argument',
    depth: 3,
  } as const
  return {
    queryKey: ['graph', 'projection', params.focus, params.view, params.depth],
    queryFn: () =>
      fetchValidated(
        `/api/graph?${new URLSearchParams({
          focus: String(params.focus),
          view: params.view,
          depth: String(params.depth),
        }).toString()}`,
        assertGraphProjection,
      ),
    enabled: cardSlug !== null,
    retry: false,
    staleTime: 30_000,
  }
}

/**
 * Fetch the drafts vocabulary.
 *
 * @returns The served canonical vocabulary, or an {@link GraphApiError} on a non-2xx.
 */
export function useDraftVocabularies() {
  return useQuery<VocabulariesResponse>({
    queryKey: DRAFT_VOCABULARIES_QUERY_KEY,
    queryFn: () =>
      fetchValidated('/api/drafts/vocabularies', isVocabulariesResponse),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch the signed-in user's draft on a card, when one exists.
 *
 * @param cardSlug The card slug, or `null` while no card is chosen (then disabled).
 * @returns `{ draft }` where `draft` is the stored draft or `null` — a 401 surfaces as a
 * {@link GraphApiError} the page maps to the signed-out state.
 */
export function useComposeDraft(cardSlug: string | null) {
  return useQuery<DraftReadResponse>({
    queryKey: composeDraftQueryKey(cardSlug ?? ''),
    queryFn: () =>
      fetchValidated(
        `/api/drafts/${encodeURIComponent(cardSlug ?? '')}`,
        isDraftEnvelope,
      ),
    enabled: cardSlug !== null,
    retry: false,
  })
}

/**
 * The canonical projection that backs the read view.
 *
 * @param cardSlug The card slug, or `null` while none is chosen.
 * @returns The projection query result, disabled until a card is chosen.
 */
export function useCanonicalProjection(cardSlug: string | null) {
  return useQuery<GraphProjection>(canonicalProjectionQueryOptions(cardSlug))
}

/**
 * Save (put) the draft for a user and card.
 *
 * Invalidates the draft query on success so a subsequent read reflects the save. The
 * mutation is the *only* path that writes: nothing in this module writes canonical data,
 * and the server rejects any payload whose claims are not on the card.
 *
 * @param cardSlug The card the draft is authored against.
 * @returns A mutation whose `mutate` takes a {@link DraftPayload}.
 */
export function useSaveDraft(cardSlug: string | null) {
  const queryClient = useQueryClient()
  return useMutation<DraftSaveResponse, GraphApiError, DraftPayload>({
    mutationKey: ['composition', 'save', cardSlug ?? ''],
    mutationFn: async (payload: DraftPayload) => {
      if (cardSlug === null)
        throw new GraphApiError(0, 'No card selected for the draft', null)
      const response = await fetch(
        `/api/drafts/${encodeURIComponent(cardSlug)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ payload }),
        },
      )
      return decodeDraftResponse(response)
    },
    onSuccess: () => {
      if (cardSlug !== null) {
        void queryClient.invalidateQueries({
          queryKey: composeDraftQueryKey(cardSlug),
        })
      }
    },
  })
}

/**
 * Delete the signed-in user's draft on a card.
 *
 * @param cardSlug The card whose draft should be removed.
 * @returns A mutation; on success it surfaces the now-deleted draft as `null` again.
 */
export function useDeleteDraft(cardSlug: string | null) {
  const queryClient = useQueryClient()
  return useMutation<void, GraphApiError, void>({
    mutationKey: ['composition', 'delete', cardSlug ?? ''],
    mutationFn: async () => {
      if (cardSlug === null)
        throw new GraphApiError(0, 'No card selected for the draft', null)
      const response = await fetch(
        `/api/drafts/${encodeURIComponent(cardSlug)}`,
        {
          method: 'DELETE',
        },
      )
      if (!response.ok)
        throw await decodeError(response, 'delete the decomposition draft')
    },
    onSuccess: () => {
      if (cardSlug !== null) {
        void queryClient.invalidateQueries({
          queryKey: composeDraftQueryKey(cardSlug),
        })
      }
    },
  })
}

/**
 * Decode a 2xx-or-4xx draft response into the typed envelope or a typed rejection.
 *
 * @param response The raw response.
 * @returns The typed save response.
 * @throws {GraphApiError} on a non-2xx, carrying the server's issues when present.
 */
async function decodeDraftResponse(
  response: Response,
): Promise<DraftSaveResponse> {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw await decodeError(response, 'save the decomposition draft')
  }
  if (!isDraftEnvelope(body)) {
    throw new ProjectionShapeError(
      'draft envelope',
      'the save response is not a draft',
    )
  }
  const envelope = body as { draft: StoredDraft | null }
  if (envelope.draft === null) {
    throw new ProjectionShapeError(
      'draft envelope',
      'the save returned no draft',
    )
  }
  return { draft: envelope.draft }
}

/**
 * Build a {@link GraphApiError} from a non-2xx response, preserving the server's issues.
 *
 * The PUT surface advertises its rejection reasons (structurally invalid vs. off-card
 * claims); the editor shows them verbatim, so the message carries `detail` rather than
 * swallowing it.
 *
 * @param response The failed response.
 * @param action Human phrasing for the error fallback.
 * @returns A GraphApiError with the server's message.
 */
async function decodeError(
  response: Response,
  action: string,
): Promise<GraphApiError> {
  const body: unknown = await response.json().catch(() => null)
  if (isRecord(body) && typeof body.error === 'string') {
    const rejection = body
    const detail =
      Array.isArray(rejection.issues) && rejection.issues.length > 0
        ? `The draft has ${rejection.issues.length} problem(s) to fix.`
        : isRecord(rejection.detail) && Array.isArray(rejection.detail.claims)
          ? 'Some claims are not on this card.'
          : null
    return new GraphApiError(response.status, body.error, detail)
  }
  return new GraphApiError(
    response.status,
    `Request failed with HTTP ${response.status} while trying to ${action}`,
    null,
  )
}

/**
 * Truthiness helper over unknown JSON.
 *
 * @param value Any value.
 * @returns `true` when `value` is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
