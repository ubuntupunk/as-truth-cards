/**
 * Presentation labels for a card's research status (SPEC §6.1–6.2, §10).
 *
 * `epistemic_status` is ontology vocabulary: it belongs to the graph, it is
 * never rendered as raw UI copy, and it is never inferred from colour. This
 * module is the *only* place the enum becomes words on screen, and it maps —
 * it never derives, ranks, or re-parses. A status stays a status: `CONTESTED`
 * does not become a Suit called `contested`, and an amber badge never carries
 * meaning that its text does not also carry (SPEC §10: status must not rely on
 * colour alone).
 */

import type { EpistemicStatusValue } from '../../trope-cards/src/graph/types.ts'

/** `epistemic_status` declaration order, as the schema declares it. */
export const EPISTEMIC_STATUS_ORDER: readonly EpistemicStatusValue[] = [
  'ESTABLISHED',
  'CONTESTED',
  'OPEN',
  'CONTEXT_DEPENDENT',
  'UNSUPPORTED',
  'LIVE',
]

/** Human label for each status as a research-status *filter* (SPEC §6.1). */
export const RESEARCH_STATUS_LABELS: Readonly<
  Record<EpistemicStatusValue, string>
> = {
  ESTABLISHED: 'Established',
  CONTESTED: 'Contested',
  OPEN: 'Open questions',
  CONTEXT_DEPENDENT: 'Context-dependent',
  UNSUPPORTED: 'Unsupported',
  LIVE: 'Live',
}

/**
 * The badge token for a status, as SPEC §6.2 states it.
 *
 * `OPEN` carries the `· UNVERIFIED` qualifier because that is the badge the
 * spec specifies and because an open question must never read as checked
 * work; every other status is reported under its own name, which is already
 * the whole claim being made.
 *
 * @param status The card's `epistemic_status`.
 * @returns Badge text such as `OPEN · UNVERIFIED` or `CONTESTED`.
 */
export function cardStatusLabel(status: EpistemicStatusValue): string {
  if (status === 'OPEN') return 'OPEN · UNVERIFIED'
  return status.replace(/_/g, '-')
}

/**
 * Whether a status must be presented as unverified material.
 *
 * Drives the amber treatment only — {@link cardStatusLabel} always says in
 * words what the badge means, so colour is redundant reinforcement and never
 * the message.
 *
 * @param status The card's `epistemic_status`.
 * @returns `true` for anything the corpus has not established.
 */
export function isUnverifiedStatus(status: EpistemicStatusValue): boolean {
  return status !== 'ESTABLISHED'
}

/**
 * The filter label for one status.
 *
 * @param status The card's `epistemic_status`.
 * @returns The human label from {@link RESEARCH_STATUS_LABELS}.
 */
export function researchStatusLabel(status: EpistemicStatusValue): string {
  return RESEARCH_STATUS_LABELS[status]
}
