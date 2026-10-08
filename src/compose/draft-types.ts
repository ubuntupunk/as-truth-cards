/**
 * The Compose/Decompose client contract.
 *
 * Types are a compile-time mirror of the server contract
 * (`server/composition/draft-contract.ts`); at runtime the *vocabulary* is fetched from
 * `GET /api/drafts/vocabularies` and every response is run through a presence-level guard.
 * Nothing here enforces structure — the server does that authoritatively on save — these
 * types and guards only keep the two sides honest about the same JSON envelope.
 */

import type {
  ArgumentChainKindValue,
  InferencePremiseRoleValue,
  InferenceStepRoleValue,
  InferenceTypeValue,
} from '../../trope-cards/src/graph/types.ts'

/** The canonical decomposition vocabulary, as served by the drafts API. */
export type DraftVocabulary = {
  readonly inferenceTypes: readonly InferenceTypeValue[]
  readonly premiseRoles: readonly InferencePremiseRoleValue[]
  readonly chainKinds: readonly ArgumentChainKindValue[]
  readonly stepRoles: readonly InferenceStepRoleValue[]
}

/** One claim reference used as a premise, with its epistemic role in the step. */
export type DraftPremise = {
  readonly claimId: string
  readonly role: InferencePremiseRoleValue
  readonly ordinal: number
}

/** One claim reference used as a conclusion. */
export type DraftConclusion = {
  readonly claimId: string
  readonly ordinal: number
}

/** One authored reasoning step: premises and conclusions over card claims. */
export type DraftStep = {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly inferenceType: InferenceTypeValue
  readonly epistemicStatus: string
  readonly notes: string | null
  readonly premises: readonly DraftPremise[]
  readonly conclusions: readonly DraftConclusion[]
}

/** One argument chain: a named path through the draft's own steps. */
export type DraftChain = {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly kind: ArgumentChainKindValue
  readonly epistemicStatus: string
  readonly steps: readonly {
    readonly stepKey: string
    readonly role: InferenceStepRoleValue
    readonly ordinal: number
  }[]
}

/** A draft as the API transports it: exactly one step and chain family per card. */
export type DraftPayload = {
  readonly steps: readonly DraftStep[]
  readonly chains: readonly DraftChain[]
}

/** A saved draft row. */
export type StoredDraft = {
  readonly cardSlug: string
  readonly payload: DraftPayload
  readonly createdAt: string
  readonly updatedAt: string
}

/** `GET /api/drafts/vocabularies` body. */
export type VocabulariesResponse = { readonly vocabularies: DraftVocabulary }

/** `GET /api/drafts/:cardSlug` body: never *missing*, always explicitly `null`. */
export type DraftReadResponse = { readonly draft: StoredDraft | null }

/** `PUT /api/drafts/:cardSlug` body. */
export type DraftSaveResponse = { readonly draft: StoredDraft }

/** `PUT /api/drafts/:cardSlug` rejection reasons. */
export type DraftSaveRejection =
  | {
      readonly error: string
      readonly issues: readonly { path: string; message: string }[]
    }
  | {
      readonly error: string
      readonly detail?: { readonly claims: readonly string[] }
    }

/**
 * Presence-level shape guard for the vocabulary response.
 *
 * @param value The parsed JSON body.
 * @returns `true` when every required array is present and non-empty.
 */
export function isVocabulariesResponse(
  value: unknown,
): value is VocabulariesResponse {
  if (!isRecord(value)) return false
  const vocab = value.vocabularies
  if (!isRecord(vocab)) return false
  return (
    Array.isArray(vocab.inferenceTypes) &&
    vocab.inferenceTypes.length > 0 &&
    Array.isArray(vocab.premiseRoles) &&
    vocab.premiseRoles.length > 0 &&
    Array.isArray(vocab.chainKinds) &&
    vocab.chainKinds.length > 0 &&
    Array.isArray(vocab.stepRoles) &&
    vocab.stepRoles.length > 0
  )
}

/**
 * Presence-level shape guard for a draft envelope.
 *
 * The server is the structure authority; this guard only confirms the envelope is a draft
 * and not an error page. Payload contents are trusted to the server's validation — a user's
 * own saved work is not re-lexed with a second ontology on every read.
 *
 * @param value The parsed JSON body.
 * @returns `true` when the value carries a `draft` that is `null` or a plausible row.
 */
export function isDraftEnvelope(value: unknown): value is DraftReadResponse {
  if (!isRecord(value)) return false
  return value.draft === null || isStoredDraft(value.draft)
}

/** `true` when `value` is a plausible stored draft. */
function isStoredDraft(value: unknown): value is StoredDraft {
  if (!isRecord(value)) return false
  if (typeof value.cardSlug !== 'string') return false
  if (typeof value.createdAt !== 'string') return false
  if (typeof value.updatedAt !== 'string') return false
  if (!isRecord(value.payload)) return false
  return (
    Array.isArray(value.payload.steps) && Array.isArray(value.payload.chains)
  )
}

/**
 * Truthiness helper over unknown JSON, narrows `null`/non-objects away.
 *
 * @param value Any value.
 * @returns `true` when `value` is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
