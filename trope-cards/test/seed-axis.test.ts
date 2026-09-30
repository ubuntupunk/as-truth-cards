import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cardAxis } from '../src/db/schema/tropeGraph'
import { cardCorpus } from '../src/db/seed/corpus'
import type { CardSeed } from '../src/db/seed/types'

/**
 * Corpus-level guarantees for the authored Axis classification.
 *
 * Read from the seed modules with no database, so it runs anywhere. These are the checks
 * that would have caught the original defect: `axis` was authored on every card, typed as
 * `string[]`, and never read, so a corpus with no axis at all validated cleanly.
 */

/** Enum values, typed so they can be looked up in a card's axis list. */
const AXIS_VALUES = [...cardAxis.enumValues]
/** The same values as a set, for membership tests against plain strings. */
const axes: ReadonlySet<string> = new Set(AXIS_VALUES)

/** Axis values authored across the whole corpus, counted per value. */
function axisTally(cards: readonly CardSeed[]): Map<string, number> {
  const tally = new Map<string, number>()
  for (const card of cards) {
    for (const axis of card.axis) {
      tally.set(axis, (tally.get(axis) ?? 0) + 1)
    }
  }
  return tally
}

describe('authored axis corpus', () => {
  it('classifies every card along at least one axis', () => {
    const unclassified = cardCorpus.filter((card) => card.axis.length === 0)
    assert.deepEqual(
      unclassified.map((c) => c.slug),
      [],
      'a card with no axis has no rhetorical classification',
    )
    assert.equal(cardCorpus.length, 47)
  })

  it('uses only values from the card_axis enum', () => {
    for (const card of cardCorpus) {
      for (const axis of card.axis) {
        assert.ok(
          axes.has(axis),
          `card "${card.slug}" uses axis "${axis}", which is not in the enum`,
        )
      }
    }
  })

  it('never repeats an axis on one card', () => {
    for (const card of cardCorpus) {
      assert.equal(
        new Set(card.axis).size,
        card.axis.length,
        `card "${card.slug}" repeats an axis: [${card.axis.join(', ')}]`,
      )
    }
  })

  it('exercises every enum value, so none is dead weight', () => {
    const used = new Set<string>(cardCorpus.flatMap((card) => [...card.axis]))
    for (const axis of axes) {
      assert.ok(used.has(axis), `no card carries axis ${axis}`)
    }
  })

  it('preserves the borderline multi-axis cards', () => {
    // Nine cards are genuinely two-axis: a rhetorical tactic that is also a theological
    // dispute, or a factual rebuttal that is also a tactic. Collapsing these to one axis is
    // the regression this suite exists to prevent, so each slug is listed rather than left
    // to a human reading the corpus.
    const multi = cardCorpus
      .filter((card) => card.axis.length > 1)
      .map((card) => `${card.slug} [${card.axis.join(', ')}]`)
      .sort()
    assert.deepEqual(multi, [
      'canaanite-card [HISTORICAL, FACT_REBUTTAL]',
      'chosen-people-master-race [TACTIC, THEOLOGICAL]',
      'elders-of-zion [FACT_REBUTTAL, TACTIC]',
      'jesus-is-a-muslim [THEOLOGICAL, FACT_REBUTTAL]',
      'jesus-was-a-zionist [THEOLOGICAL, FACT_REBUTTAL]',
      'land-of-the-children-of-israel [THEOLOGICAL, FACT_REBUTTAL]',
      'muhammad-was-a-zionist [THEOLOGICAL, FACT_REBUTTAL]',
      'talmud [TACTIC, THEOLOGICAL]',
      'uct-resolutions [TACTIC, FACT_REBUTTAL]',
    ])
  })

  it('keeps the HISTORICAL axis on the one card authored with it', () => {
    // The card is a continuity argument. Folding it into FACT_REBUTTAL to fit the deck's
    // original three axes would discard a real editorial classification, so the value stays
    // and the enum carries it.
    const canaanite = cardCorpus.find((card) => card.slug === 'canaanite-card')
    assert.ok(canaanite)
    assert.deepEqual([...canaanite.axis], ['HISTORICAL', 'FACT_REBUTTAL'])
  })

  it('authors 56 axis values across 47 cards', () => {
    const total = cardCorpus.reduce((n, card) => n + card.axis.length, 0)
    assert.equal(total, 56)
  })

  it('tallies as FACT_REBUTTAL 27, TACTIC 18, THEOLOGICAL 10, HISTORICAL 1', () => {
    assert.deepEqual(
      Object.fromEntries([...axisTally(cardCorpus)].sort()),
      {
        FACT_REBUTTAL: 27,
        HISTORICAL: 1,
        TACTIC: 18,
        THEOLOGICAL: 10,
      },
    )
  })
})

describe('axis is independent of primaryType', () => {
  it('does not mirror it: the two dimensions disagree on real cards', () => {
    // primaryType is legacy content-shape classification. If axis were a projection of it,
    // these counts would be identical, and the argument for persisting axis separately
    // would evaporate. They are not, and they are not close.
    const axisTactic = cardCorpus.filter((card) => card.axis.includes('TACTIC')).length
    const typeTactic = cardCorpus.filter(
      (card) => card.primaryType === 'TACTIC',
    ).length
    const axisTheological = cardCorpus.filter((card) =>
      card.axis.includes('THEOLOGICAL'),
    ).length
    const typeTheology = cardCorpus.filter(
      (card) => card.primaryType === 'THEOLOGY',
    ).length

    assert.equal(axisTactic, 18)
    assert.equal(typeTactic, 13)
    assert.equal(axisTheological, 10)
    assert.equal(typeTheology, 9)
    assert.notEqual(axisTactic, typeTactic)
  })

  it('has cards whose primary axis contradicts their primaryType', () => {
    // A FACT card argued along the tactic axis: content shape and rhetorical function
    // genuinely differ, which is why the two cannot be collapsed into one field.
    const divergent = cardCorpus.filter(
      (card) =>
        (card.primaryType === 'TACTIC' && !card.axis.includes('TACTIC')) ||
        (card.primaryType === 'THEOLOGY' && !card.axis.includes('THEOLOGICAL')) ||
        (card.primaryType === 'FACT' && card.axis.includes('TACTIC')),
    )
    assert.ok(
      divergent.length > 0,
      'expected at least one card where primaryType and primary axis disagree',
    )
  })
})

describe('axis does not imply epistemic status', () => {
  it('places CONTESTED cards on every axis', () => {
    // 21 of 47 cards are CONTESTED. If axis tracked epistemic status, the CONTESTED set
    // would collapse onto one or two axes. It does not, and it must not.
    const contestedAxes = new Set<string>(
      cardCorpus
        .filter((card) => card.status === 'CONTESTED')
        .flatMap((card) => [...card.axis]),
    )
    for (const axis of axes) {
      assert.ok(
        contestedAxes.has(axis),
        `no CONTESTED card carries axis ${axis}`,
      )
    }
  })

  it('places non-CONTESTED cards on every axis with more than one card', () => {
    for (const axis of AXIS_VALUES) {
      const carriers = cardCorpus.filter((card) => card.axis.includes(axis))
      // HISTORICAL has a single card, so it cannot show a spread either way. Asserting it
      // would demand a second card exist, which is an editorial decision, not an invariant.
      if (carriers.length < 2) continue
      const stable = carriers.filter((card) => card.status !== 'CONTESTED')
      assert.ok(
        stable.length > 0,
        `every card on axis ${axis} is CONTESTED, which would make axis a status proxy`,
      )
    }
  })
})

describe('axis is independent of suit', () => {
  it('spreads every multi-card axis across at least two collections', () => {
    // Collections are browse suits; axis is rhetorical function. A card's suit says where it
    // sits in the deck, and must not determine how it argues.
    for (const axis of AXIS_VALUES) {
      const carriers = cardCorpus.filter((card) => card.axis.includes(axis))
      if (carriers.length < 2) continue
      const collections = new Set(
        carriers.flatMap((card) => [...card.collection]),
      )
      assert.ok(
        collections.size >= 2,
        `axis ${axis} appears in only one collection: ${[...collections].join(', ')}`,
      )
    }
  })

  it('gives at least one card a single suit, so suits are not a restatement of axis', () => {
    assert.ok(
      cardCorpus.some((card) => card.collection.length === 1),
      'expected single-collection cards',
    )
  })
})
