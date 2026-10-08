/**
 * Tests for `deck-model.ts` and `deck-status.ts` — the Deck's pure core.
 *
 * The contract under test is the three invariants the module documents: a
 * scope filters cards (never the ontology), navigation is a session over a
 * list (so `reconcileSession` decides restarts), and absent dimensions are
 * reported as absent (`count: null` is never rendered as `0`). The status
 * tests pin the presentation mapping: `OPEN` reaches the screen as
 * `OPEN · UNVERIFIED`, never as raw enum copy.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyScope,
  availableAxes,
  availableStatuses,
  DECK_PROJECTION_DEPTH,
  type DeckScope,
  DISCOVERY_LENSES,
  deckProjectionDepth,
  deriveCardPreview,
  deriveCardReading,
  discoveryPrompt,
  NO_SCOPE,
  positionLabel,
  positionRatio,
  previousCard,
  reconcileSession,
  shuffleNextCard,
  startDeck,
} from './deck-model'
import {
  cardStatusLabel,
  isUnverifiedStatus,
  researchStatusLabel,
} from './deck-status'
import {
  ALL_CARDS,
  CARD_VIEW,
  CONTESTED_CARD,
  DECK_PROJECTION,
  ESTABLISHED_CARD,
  FEATURED_CARD_ID,
  NEIGHBOUR_PROJECTION,
  OPEN_CARD,
  SHALLOW_PROJECTION,
} from './test-fixtures'

/** A scope over the three fixture cards. */
function scope(overrides: Partial<DeckScope> = {}): DeckScope {
  return { ...NO_SCOPE, ...overrides }
}

describe('applyScope', () => {
  it('keeps every card when no filter is active', () => {
    assert.equal(applyScope(ALL_CARDS, NO_SCOPE).length, 3)
  })

  it('filters by axis, keeping cards that carry it in any ordinal', () => {
    const scoped = applyScope(ALL_CARDS, scope({ axis: 'HISTORICAL' }))
    assert.deepEqual(
      scoped.map((card) => card.slug),
      ['an-open-question', 'a-contested-reading'],
    )
  })

  it('filters by research status', () => {
    const scoped = applyScope(ALL_CARDS, scope({ status: 'OPEN' }))
    assert.deepEqual(
      scoped.map((card) => card.slug),
      ['an-open-question'],
    )
  })

  it('ANDs the dimensions rather than ORing them', () => {
    assert.equal(
      applyScope(ALL_CARDS, scope({ axis: 'TACTIC', status: 'ESTABLISHED' }))
        .length,
      0,
    )
    assert.equal(
      applyScope(ALL_CARDS, scope({ axis: 'HISTORICAL', status: 'CONTESTED' }))
        .length,
      1,
    )
  })

  it('ignores the repeat policy, which governs navigation not membership', () => {
    assert.equal(
      applyScope(ALL_CARDS, scope({ withoutRepeats: true })).length,
      3,
    )
  })
})

describe('availableAxes / availableStatuses', () => {
  it('reports only the axes present, in canonical card_axis order', () => {
    assert.deepEqual(availableAxes(ALL_CARDS), [
      'TACTIC',
      'THEOLOGICAL',
      'HISTORICAL',
    ])
  })

  it('reports only the statuses present, in vocabulary order', () => {
    assert.deepEqual(availableStatuses(ALL_CARDS), [
      'ESTABLISHED',
      'CONTESTED',
      'OPEN',
    ])
  })

  it('offers no axis for a card list that carries none', () => {
    assert.deepEqual(availableAxes([]), [])
  })
})

describe('deck session navigation', () => {
  it('starts on the first card with it already seen', () => {
    const session = startDeck(ALL_CARDS, scope({ withoutRepeats: true }))
    assert.equal(session.position, 0)
    assert.deepEqual(session.seen, [0])
    assert.equal(session.withoutRepeats, true)
  })

  it('steps to the previous card, wrapping at the start', () => {
    const first = startDeck(ALL_CARDS, NO_SCOPE)
    const wrapped = previousCard(first)
    assert.equal(wrapped.position, 2)
    assert.ok(wrapped.seen.includes(2))
    assert.equal(previousCard(wrapped).position, 1)
  })

  it('shuffles to a card that is not the current one', () => {
    const session = startDeck(ALL_CARDS, NO_SCOPE)
    const next = shuffleNextCard(session, () => 0)
    assert.notEqual(next.position, session.position)
    assert.ok(next.seen.includes(next.position))
  })

  it('avoids cards already seen when the policy says so', () => {
    const seen = { ...startDeck(ALL_CARDS, scope({ withoutRepeats: true })) }
    const session = { ...seen, seen: [0, 1], position: 1 }
    assert.equal(shuffleNextCard(session, () => 0).position, 2)
  })

  it('falls back to the whole deck once every card has been seen', () => {
    const session = {
      ...startDeck(ALL_CARDS, scope({ withoutRepeats: true })),
      seen: [0, 1, 2],
      position: 1,
    }
    assert.equal(shuffleNextCard(session, () => 0).position, 0)
  })

  it('has nothing to shuffle in a one-card deck', () => {
    const session = startDeck([OPEN_CARD], NO_SCOPE)
    assert.equal(
      shuffleNextCard(session, () => 0),
      session,
    )
  })

  it('reports position as n / total, and 0 / 0 when empty', () => {
    assert.equal(positionLabel(startDeck(ALL_CARDS, NO_SCOPE)), '1 / 3')
    assert.equal(positionLabel(startDeck([], NO_SCOPE)), '0 / 0')
    assert.equal(positionRatio(startDeck([], NO_SCOPE)), 0)
    assert.equal(positionRatio(startDeck(ALL_CARDS, NO_SCOPE)), 1 / 3)
  })
})

describe('reconcileSession', () => {
  it('restarts when the scoped card list changed', () => {
    const current = {
      ...startDeck(ALL_CARDS, NO_SCOPE),
      position: 2,
      seen: [0, 2],
    }
    const next = reconcileSession(current, [OPEN_CARD], NO_SCOPE)
    assert.equal(next.position, 0)
    assert.deepEqual(next.seen, [0])
    assert.equal(next.cards.length, 1)
  })

  it('keeps the reading place when only the repeat policy flips', () => {
    const current = startDeck(ALL_CARDS, NO_SCOPE)
    const moved = previousCard(current)
    const next = reconcileSession(
      moved,
      ALL_CARDS,
      scope({ withoutRepeats: true }),
    )
    assert.equal(next.position, moved.position)
    assert.deepEqual(next.seen, moved.seen)
    assert.equal(next.withoutRepeats, true)
  })

  it('returns the same object when nothing changed', () => {
    const current = startDeck(ALL_CARDS, NO_SCOPE)
    assert.equal(reconcileSession(current, ALL_CARDS, NO_SCOPE), current)
  })
})

describe('deriveCardPreview', () => {
  it('counts this card\u2019s claims and reasoning steps', () => {
    const preview = deriveCardPreview(DECK_PROJECTION, CARD_VIEW, {
      cardId: FEATURED_CARD_ID,
    })
    assert.equal(preview.claims.count, 2)
    assert.equal(preview.claims.note, null)
    assert.equal(preview.reasoningSteps.count, 2)
    assert.equal(preview.reasoningSteps.note, null)
  })

  it('counts the sources attributed to this card\u2019s own claims', () => {
    const preview = deriveCardPreview(DECK_PROJECTION, CARD_VIEW, {
      cardId: FEATURED_CARD_ID,
    })
    assert.equal(preview.provenance.count, 1)
    assert.equal(preview.provenance.note, null)
  })

  it('reports the view\u2019s own reason instead of a zero for an excluded dimension', () => {
    const preview = deriveCardPreview(DECK_PROJECTION, CARD_VIEW, {
      cardId: FEATURED_CARD_ID,
    })
    assert.equal(preview.evidence.count, null)
    assert.match(String(preview.evidence.note), /evidence_/)
    assert.ok(!String(preview.evidence.note).startsWith('0 '))
  })

  it('says the dimension sits deeper rather than reporting zero over a shallow projection', () => {
    const preview = deriveCardPreview(SHALLOW_PROJECTION, CARD_VIEW, {
      cardId: FEATURED_CARD_ID,
    })
    // One claim in reach at hop 1; the fixture's second claim sits deeper.
    assert.equal(preview.claims.count, 1)
    assert.equal(preview.reasoningSteps.count, null)
    assert.match(String(preview.reasoningSteps.note), /depth 1/)
    assert.equal(preview.provenance.count, null)
    assert.match(String(preview.provenance.note), /depth 1/)
  })

  it('counts only the featured card\u2019s rows when the projection carries a neighbour', () => {
    const preview = deriveCardPreview(NEIGHBOUR_PROJECTION, CARD_VIEW, {
      cardId: FEATURED_CARD_ID,
    })
    assert.equal(preview.claims.count, 2)
    assert.equal(preview.reasoningSteps.count, 2)
    assert.equal(preview.provenance.count, 1)
  })

  it('names the catalogue\u2019s failure when it rejected', () => {
    const preview = deriveCardPreview(DECK_PROJECTION, CARD_VIEW, {
      cardId: FEATURED_CARD_ID,
      catalogueError: 'boom',
    })
    // Rows the payload proved stay reportable; the reason explains the rest.
    assert.equal(preview.claims.count, 2)
    assert.equal(preview.evidence.count, null)
    assert.equal(preview.evidence.note, 'View catalogue unavailable: boom')
  })

  it('reports pending, not zero, for what it found nothing to count yet', () => {
    // Nothing found, catalogue unknown: the honest answer is "no claim yet",
    // not a zero about a view nobody has read.
    const preview = deriveCardPreview(SHALLOW_PROJECTION, null, {
      cardId: FEATURED_CARD_ID,
    })
    assert.deepEqual(preview.provenance, { count: null, note: null })
    assert.deepEqual(preview.evidence, { count: null, note: null })
    assert.equal(preview.claims.count, 1)
  })

  it('still reports rows the payload proved while the catalogue is loading', () => {
    const preview = deriveCardPreview(DECK_PROJECTION, null, {
      cardId: FEATURED_CARD_ID,
    })
    assert.equal(preview.claims.count, 2)
    assert.equal(preview.provenance.count, 1)
    assert.deepEqual(preview.evidence, { count: null, note: null })
  })
})

describe('deckProjectionDepth', () => {
  it('asks deep enough for attribution by default', () => {
    assert.equal(DECK_PROJECTION_DEPTH, 2)
    assert.equal(deckProjectionDepth(null), 2)
  })

  it('never asks beyond what the view can serve', () => {
    assert.equal(deckProjectionDepth({ ...CARD_VIEW, maxDepth: 1 }), 1)
    assert.equal(deckProjectionDepth({ ...CARD_VIEW, maxDepth: 3 }), 2)
  })
})

describe('deriveCardReading', () => {
  it('keeps claims, steps and sources as three separate lists', () => {
    const reading = deriveCardReading(DECK_PROJECTION, FEATURED_CARD_ID)
    assert.equal(reading.claims.length, 2)
    assert.equal(reading.steps.length, 2)
    assert.equal(reading.sources.length, 1)
  })

  it('reads a claim status and description, and a step without one', () => {
    const reading = deriveCardReading(DECK_PROJECTION, FEATURED_CARD_ID)
    assert.equal(reading.claims[0].label, 'Jesus was born in Bethlehem')
    assert.equal(reading.claims[0].status, 'ESTABLISHED')
    assert.equal(reading.claims[0].detail, 'An attested historical claim.')
    assert.equal(reading.steps[0].status, null)
    assert.equal(reading.steps[0].detail, 'Bridges the two claims.')
  })

  it('reads a source citation as provenance text, with no epistemic status', () => {
    const reading = deriveCardReading(DECK_PROJECTION, FEATURED_CARD_ID)
    assert.equal(
      reading.sources[0].detail,
      'A. Author, A primary source (A Press, 2026).',
    )
    assert.equal(reading.sources[0].status, null)
  })

  it('leaves a neighbour card\u2019s rows out of every list', () => {
    const reading = deriveCardReading(NEIGHBOUR_PROJECTION, FEATURED_CARD_ID)
    assert.equal(reading.claims.length, 2)
    assert.equal(reading.steps.length, 2)
    assert.equal(reading.sources.length, 1)
    const labels = [
      ...reading.claims,
      ...reading.steps,
      ...reading.sources,
    ].map((entry) => entry.label)
    assert.ok(
      !labels.some((label) => label.includes('neighbour')),
      labels.join(' | '),
    )
  })
})

describe('discoveryPrompt', () => {
  it('prefers the card’s authored core question', () => {
    const model = discoveryPrompt(OPEN_CARD)
    assert.equal(model.question, 'Was the figure inflated?')
  })

  it('falls back to a check-first question naming the card', () => {
    const model = discoveryPrompt(ESTABLISHED_CARD)
    assert.ok(model.question.includes('An established case'))
    assert.ok(model.question.startsWith('What would you need to check'))
  })

  it('offers exactly the four SPEC lenses, each as a question', () => {
    const model = discoveryPrompt(CONTESTED_CARD)
    assert.deepEqual(
      model.lenses.map((lens) => lens.label),
      ['language', 'place', 'collective memory', 'concepts'],
    )
    assert.equal(model.lenses, DISCOVERY_LENSES)
    for (const lens of model.lenses) assert.ok(lens.question.endsWith('?'))
  })
})

describe('research status presentation', () => {
  it('states OPEN as the badge the spec specifies', () => {
    assert.equal(cardStatusLabel('OPEN'), 'OPEN · UNVERIFIED')
  })

  it('never exposes the raw enum spelling to the screen', () => {
    assert.equal(cardStatusLabel('CONTEXT_DEPENDENT'), 'CONTEXT-DEPENDENT')
    assert.equal(cardStatusLabel('ESTABLISHED'), 'ESTABLISHED')
  })

  it('treats everything the corpus has not established as unverified', () => {
    assert.equal(isUnverifiedStatus('OPEN'), true)
    assert.equal(isUnverifiedStatus('CONTESTED'), true)
    assert.equal(isUnverifiedStatus('ESTABLISHED'), false)
  })

  it('labels the research-status filter the way the spec words it', () => {
    assert.equal(researchStatusLabel('OPEN'), 'Open questions')
  })
})
