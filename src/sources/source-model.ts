/**
 * The Sources model — Phase E (ROADMAP §170–200), the pure half.
 *
 * A **Source** is a canonical bibliography/provenance record: a document, work,
 * or artefact the corpus cites. It is deliberately *not* an `evidence_item`.
 * The ontology keeps them apart (SPEC §8.2): attaching a source to a claim is a
 * provenance *lead*, recorded in `claim_sources`, and it does not by itself
 * establish support. This module holds the display vocabulary for that
 * distinction — "attributed", never "supported", "provenance", never
 * "evidence" — plus the one URL contract for opening a source's provenance
 * neighbourhood in the graph.
 *
 * Nothing here reads the network, authenticates, or mutates `trope_graph`. The
 * count the wire calls `claimSourceCount` is an attribution count, and the copy
 * derived from it must never read as verified evidence.
 */

import { EVIDENCE_VIEW_NAME } from '../../trope-cards/src/graph/views.ts'
import type { SourceSummary } from '../graph/projection-guards'
import type { GraphParams } from '../graph/query-params'
import type { ResearchEntry } from '../research/research-session'

/** Convert an enum-ish `sourceType` into a readable label without remapping it. */
export function humanizeSourceType(sourceType: string): string {
  const words = sourceType.split('_').filter((word) => word.length > 0)
  if (words.length === 0) return sourceType
  return words
    .map((word, index) =>
      index === 0
        ? word.charAt(0) + word.slice(1).toLowerCase()
        : word.toLowerCase(),
    )
    .join(' ')
}

/**
 * How a source's attribution count reads on screen.
 *
 * Phrases the relation as *attribution*, never *support*: the count is how many
 * claims name the source in `claim_sources`, which is provenance and not a
 * verification verdict. Zero is stated plainly rather than implied — an
 * uncited source is a real, honest state, not a blank.
 *
 * @param count The `claimSourceCount` the API reported.
 * @returns A phrase such as `"No claims attributed"` or `"3 claims attributed"`.
 */
export function attributionSummary(count: number): string {
  if (count === 0) return 'No claims attributed'
  return `${count} claim${count === 1 ? '' : 's'} attributed`
}

/** One labelled metadata line, present only when the corpus populated it. */
export type SourceMetadataLine = {
  readonly label: string
  readonly value: string
}

/**
 * The source's populated bibliographic fields, in a stable order.
 *
 * Absent fields (`null`) are omitted rather than rendered as "—", so the page
 * never implies metadata it does not have; a source with none yields `[]` and
 * the caller renders the empty-metadata note instead.
 *
 * @param source One source row.
 * @returns The populated `Author` / `Publisher` / `Citation` lines.
 */
export function sourceMetadataLines(
  source: SourceSummary,
): readonly SourceMetadataLine[] {
  const lines: SourceMetadataLine[] = []
  if (source.author !== null)
    lines.push({ label: 'Author', value: source.author })
  if (source.publisher !== null) {
    lines.push({ label: 'Publisher', value: source.publisher })
  }
  if (source.citation !== null) {
    lines.push({ label: 'Citation', value: source.citation })
  }
  return lines
}

/**
 * The graph params that open a source's provenance neighbourhood.
 *
 * Always the `evidence` view, which is the only registered view whose
 * `focusTypes` accepts a `source`; the default depth keeps the read to the
 * source and its directly attributed claims rather than pulling reasoning in.
 * Kept as one function so the page, the "Open in graph" link and a saved
 * research entry cannot disagree about where a source opens.
 *
 * @param sourceId The canonical source uuid.
 * @returns Params for `serializeGraphParams`.
 */
export function sourceAttributionParams(sourceId: string): GraphParams {
  return { focus: sourceId, view: EVIDENCE_VIEW_NAME, depth: null }
}

/**
 * Build a research-session entry for a source.
 *
 * Reuses the Phase D {@link ResearchEntry} model unchanged: a source is just
 * another focusable canonical entity (`type: 'source'`), and saving it stores a
 * pointer, not a copy. The stored view matches {@link sourceAttributionParams}
 * so re-opening the entry from the Research Workspace lands on the same
 * provenance projection this page shows.
 *
 * @param source The source row being saved.
 * @param now Epoch milliseconds; injectable so tests are deterministic.
 * @returns The entry to add to the session.
 */
export function sourceToResearchEntry(
  source: SourceSummary,
  now: number = Date.now(),
): ResearchEntry {
  const params = sourceAttributionParams(source.id)
  return {
    id: source.id,
    type: 'source',
    label: source.title,
    view: params.view,
    depth: params.depth,
    addedAt: now,
  }
}
