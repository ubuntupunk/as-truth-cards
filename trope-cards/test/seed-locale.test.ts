import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cardCorpus } from '../src/db/seed/corpus'
import { collectionsSeed, localesSeed } from '../src/db/seed/taxonomy'
import type { CardSeed } from '../src/db/seed/types'

/**
 * Corpus-level guarantees for the authored Locale classification.
 *
 * Read from the seed modules with no database, so it runs anywhere. The shape mirrors
 * `seed-axis.test.ts`, and for the same reason: the failure mode Locale has to avoid is
 * *absence*. `locales` was added as an optional field, so nothing in the toolchain would
 * complain about a card that quietly dropped its locale — and the one card that is silently
 * mis-tagged as South African is worse than one that is merely untagged.
 *
 * The assertions are deliberately about the relationship between locales and the other
 * dimensions, because that relationship is the part Issue #6 actually rules on.
 */

/** Locale slugs the seed defines. */
const localeSlugs: ReadonlySet<string> = new Set(localesSeed.map((l) => l.slug))
/** Collection slugs the seed defines. */
const collectionSlugs: ReadonlySet<string> = new Set(
  collectionsSeed.map((c) => c.slug),
)

/** Cards in the corpus that declare at least one locale. */
function localisedCards(cards: readonly CardSeed[]): CardSeed[] {
  return cards.filter((card) => (card.locales ?? []).length > 0)
}

describe('authored locale corpus', () => {
  it('defines every locale it uses', () => {
    for (const card of cardCorpus) {
      for (const slug of card.locales ?? []) {
        assert.ok(
          localeSlugs.has(slug),
          `card "${card.slug}" uses locale "${slug}", which taxonomy.ts does not define`,
        )
      }
    }
  })

  it('never repeats a locale on one card', () => {
    for (const card of cardCorpus) {
      const locales = card.locales ?? []
      assert.equal(
        new Set(locales).size,
        locales.length,
        `card "${card.slug}" repeats a locale: [${locales.join(', ')}]`,
      )
    }
  })

  it('gives every card in the taxonomy at least one card, so no locale is dead weight', () => {
    const used = new Set(cardCorpus.flatMap((card) => [...(card.locales ?? [])]))
    for (const slug of localeSlugs) {
      assert.ok(
        used.has(slug),
        `locale "${slug}" is defined but no card is set in it`,
      )
    }
  })

  it('leaves a card with no locale untagged rather than defaulting it', () => {
    const untagged = cardCorpus.filter((card) => (card.locales ?? []).length === 0)
    assert.ok(
      untagged.length > 0,
      'if every card had a locale, nothing would prove the field is genuinely optional',
    )
  })
})

describe('locale is independent of collection', () => {
  it('has cards whose locale is not restated by their collection', () => {
    // Every card in this corpus carries at least one collection, so "locale with no
    // collection" is not a case the corpus can produce. The reachable case is the one that
    // matters: a card that is *about* South Africa while being curated somewhere else. If
    // locale were a relabelling of collection, these three could not exist.
    const localeNotRestated = localisedCards(cardCorpus).filter(
      (card) => !card.collection.includes('south-africa'),
    )
    assert.deepEqual(
      localeNotRestated.map((c) => c.slug).sort(),
      [
        'anc-hamas-equivalence',
        'apartheid-collaborators',
        'israel-apartheid-severance',
      ],
      'these three are South Africa cards curated under other suits',
    )
  })

  it('has cards in a collection and no locale', () => {
    const collectionNoLocale = cardCorpus.filter(
      (card) => card.collection.length > 0 && (card.locales ?? []).length === 0,
    )
    assert.equal(
      collectionNoLocale.length,
      cardCorpus.length - 7,
      'every card is collected, so locale must be what distinguishes the other 40',
    )
  })

  it('never derives the south-africa locale from the south-africa collection', () => {
    const inCollection = cardCorpus.filter((card) =>
      card.collection.includes('south-africa'),
    )
    assert.ok(inCollection.length > 0, 'the south-africa collection is in use')
    const inCollectionNotLocalised = inCollection.filter(
      (card) => !(card.locales ?? []).includes('south-africa'),
    )
    assert.deepEqual(
      inCollectionNotLocalised.map((c) => c.slug),
      [],
      'these cards are curated under the south-africa collection but are not South Africa ' +
        'cards; inferring one from the other is exactly the conflation Issue #6 forbids',
    )
  })

  it('pins the shared south-africa slug as a known hazard on four cards', () => {
    // `south-africa` names a collection *and* a locale. That is authored, not accidental:
    // the collection is a curation bucket and the locale is the card's setting, and the
    // four cards below genuinely satisfy both. The slug collision is safe only because the
    // two taxonomies are separate tables with separate ids — so this test exists to make
    // the hazard explicit and to fail loudly if someone "deduplicates" the slugs later.
    const both = localisedCards(cardCorpus).filter((card) =>
      card.collection.includes('south-africa'),
    )
    assert.deepEqual(both.map((c) => c.slug).sort(), [
      'cape-union-mart',
      'mendelsohn',
      'sa-jews-for-a-free-palestine',
      'uct-resolutions',
    ])
  })
})

describe('the south-africa locale', () => {
  const tagged = localisedCards(cardCorpus).filter((card) =>
    (card.locales ?? []).includes('south-africa'),
  )

  it('is defined with a name and description', () => {
    const locale = localesSeed.find((l) => l.slug === 'south-africa')
    assert.ok(locale, 'taxonomy.ts must define south-africa')
    assert.ok(locale.name.length > 0)
    assert.ok((locale.description ?? '').length > 0)
  })

  it('is authored on the seven South Africa cards', () => {
    assert.equal(
      tagged.length,
      7,
      `expected 7 south-africa cards, found: ${tagged.map((c) => c.slug).join(', ')}`,
    )
  })

  it('is not recoverable from a card\'s own text, which is why it needs its own table', () => {
    // `sa-jews-for-a-free-palestine` is tagged south-africa, yet neither its slug, title,
    // summary nor core question ever names South Africa. An earlier version of this test
    // asserted the opposite — that every tagged card mentions South Africa — which was
    // wrong twice over: it was a brittle keyword scrape, and it asserted that locale is
    // derivable from card text. Issue #6 rules that derivation out. Locale is an editorial
    // judgement, so the only correct way to recover it is to read `card_locales`.
    const saCard = cardCorpus.find(
      (card) => card.slug === 'sa-jews-for-a-free-palestine',
    )
    assert.ok(saCard)
    assert.ok((saCard.locales ?? []).includes('south-africa'))
    const text = [
      saCard.slug,
      saCard.title,
      saCard.summary ?? '',
      saCard.coreQuestion ?? '',
    ]
      .join(' ')
      .toLowerCase()
    assert.ok(
      !text.includes('south africa') && !text.includes('apartheid'),
      'if this card did name South Africa, it would no longer prove that locale cannot be ' +
        'inferred from text',
    )
  })
})

describe('locale and collection slugs overlap deliberately', () => {
  it('shares exactly one slug between the two taxonomies', () => {
    const shared = [...localeSlugs].filter((slug) => collectionSlugs.has(slug))
    assert.deepEqual(
      shared,
      ['south-africa'],
      'the two taxonomies are allowed to use the same human-facing label; what keeps them ' +
        'apart is the separate table and id, asserted in test/schema-locale.test.ts',
    )
  })
})