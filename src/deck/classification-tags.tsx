/**
 * The featured card's classification tags (SPEC §6.2).
 *
 * One chip per membership, each prefixed with the dimension it came from —
 * `Axis ·`, `Suit ·`, `Mechanism ·`, `Locale ·`. The prefix is not decoration:
 * `south-africa` is legitimately both a Suit and a Locale with different ids,
 * and an unprefixed `South Africa` chip cannot say which one it is. Labels
 * come from the shared vocabularies (`AXIS_LABELS`, `suitLabel`) for the
 * dimensions that have them and from `humanize` for the two that do not, so a
 * Suit never borrows a Locale's word and no dimension is re-derived here.
 */

import type { CardClassification } from '../../trope-cards/src/graph/types.ts'
import { AXIS_LABELS, humanize, suitLabel } from '../graph/deck-facets'

/** Props for {@link ClassificationTags}. */
export type ClassificationTagsProps = {
  readonly classification: CardClassification
}

/** One chip: the dimension it belongs to and the value to show. */
type Tag = {
  readonly key: string
  readonly dimension: string
  readonly label: string
}

/**
 * Flatten a card's classification into displayable chips.
 *
 * @param classification The card's five dimensions, verbatim from the graph.
 * @returns One chip per membership, dimensions in Axis/Suit/Mechanism/Locale
 * order.
 */
function toTags(classification: CardClassification): readonly Tag[] {
  return [
    ...classification.axes.map((assignment) => ({
      key: `axis-${assignment.axis}`,
      dimension: 'Axis',
      label: AXIS_LABELS[assignment.axis],
    })),
    ...classification.suits.map((slug) => ({
      key: `suit-${slug}`,
      dimension: 'Suit',
      label: suitLabel(slug),
    })),
    ...classification.mechanismSlugs.map((slug) => ({
      key: `mechanism-${slug}`,
      dimension: 'Mechanism',
      label: humanize(slug),
    })),
    ...classification.localeSlugs.map((slug) => ({
      key: `locale-${slug}`,
      dimension: 'Locale',
      label: humanize(slug),
    })),
  ]
}

/**
 * The classification region of the featured card.
 *
 * @param props See {@link ClassificationTagsProps}.
 * @returns The chips, or one honest line when the card is unclassified.
 */
export function ClassificationTags({
  classification,
}: ClassificationTagsProps) {
  const tags = toTags(classification)
  return (
    <section
      data-testid="classification-tags"
      aria-label="Classification"
      className="mt-4"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Classification
      </h3>
      {tags.length === 0 ? (
        <p
          data-testid="classification-empty"
          className="mt-1.5 text-sm text-muted-foreground"
        >
          No classification tags recorded for this card.
        </p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag.key}
              data-dimension={tag.dimension}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
            >
              <span className="text-muted-foreground">{tag.dimension}</span>
              <span aria-hidden="true"> · </span>
              {tag.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
