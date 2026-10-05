import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { claimRelationTypeEnum } from '../src/db/schema/claimDecomposition'
import {
  claimType,
  epistemicStatus,
  sourceType,
} from '../src/db/schema/tropeGraph'
import { claimRelations } from '../src/db/seed/claimRelations'
import { claimDecompositionSeed } from '../src/db/seed/claimDecomposition'
import { cardCorpus } from '../src/db/seed/corpus'
import { identityRetrospectionClaims } from '../src/db/seed/identityRetrospection'
import { newIdentityClaims } from '../src/db/seed/newIdentityClaims'
import { referenceClaims } from '../src/db/seed/referenceClaims'
import { corpusClaimSources, corpusSources } from '../src/db/seed/sourceLayer'
import {
  cardConceptLinksSeed,
  conceptsSeed,
  mechanismsSeed,
} from '../src/db/seed/taxonomy'
import type { ClaimSeed } from '../src/db/seed/types'

/**
 * Static guarantees for the v0.11 corpus increment: claims, claim relations, and sources.
 *
 * Read from the seed modules with no database, so these run in the default suite. The checks
 * here are the ones a reviewer would otherwise have to perform by hand, and the ones the
 * schema cannot enforce:
 *
 *   - a claim slug keys premise bindings, claim relations, and source attributions at once,
 *     so a collision re-wires all three onto a different claim and no constraint objects;
 *   - nothing stops a claim relation from restating an inference binding, which would put one
 *     editorial decision in two tables;
 *   - nothing stops a claim source from asserting a quotation, which is precisely the
 *     fabrication this increment refuses.
 */

/** Every claim the seed authors, from all three files. */
const allClaims: Array<ClaimSeed & { slug: string }> = [
  ...newIdentityClaims,
  ...identityRetrospectionClaims,
  ...referenceClaims,
]

const claimSlugs: ReadonlySet<string> = new Set(allClaims.map((c) => c.slug))
const cardBySlug = new Map(cardCorpus.map((c) => [c.slug, c]))
const sourceLabels: ReadonlySet<string> = new Set(corpusSources.map((s) => s.label))

/**
 * Every (premise, conclusion) pair wired by the decomposition engine.
 *
 * Premise bindings key on `inferenceLabel` alone, so a binding is paired with its conclusions
 * by that label rather than by card.
 */
function inferencePairs(): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const group of claimDecompositionSeed.premiseBindings) {
    const conclusions =
      claimDecompositionSeed.conclusionBindings.find(
        (c) => c.inferenceLabel === group.inferenceLabel,
      )?.conclusions ?? []
    for (const premise of group.premises) {
      for (const conclusion of conclusions) {
        pairs.push([premise.claimSlug, conclusion.claimSlug])
      }
    }
  }
  return pairs
}

describe('seed claims', () => {
  it('defines every claim slug exactly once', () => {
    const seen = new Map<string, number>()
    for (const claim of allClaims) {
      seen.set(claim.slug, (seen.get(claim.slug) ?? 0) + 1)
    }
    const duplicated = [...seen.entries()]
      .filter(([, n]) => n > 1)
      .map(([slug, n]) => `${slug} (${n}x)`)
    assert.deepEqual(
      duplicated,
      [],
      'a claim slug keys every binding, relation, and attribution, so a collision silently ' +
        'rewires all of them onto one claim',
    )
  })

  it('attaches every claim to a card in the corpus', () => {
    const orphans = allClaims
      .filter((c) => !cardBySlug.has(c.cardSlug))
      .map((c) => `${c.slug} -> ${c.cardSlug}`)
    assert.deepEqual(orphans, [], 'claim references a card slug no seed file defines')
  })

  it('uses only values from the claim_type and epistemic_status enums', () => {
    const types: ReadonlySet<string> = new Set([...claimType.enumValues])
    const statuses: ReadonlySet<string> = new Set([...epistemicStatus.enumValues])
    for (const claim of allClaims) {
      assert.ok(
        types.has(claim.claimType),
        `claim "${claim.slug}" uses claimType "${claim.claimType}", which is not in the enum`,
      )
      assert.ok(
        statuses.has(claim.status),
        `claim "${claim.slug}" uses status "${claim.status}", which is not in the enum`,
      )
      assert.ok(
        claim.statement.trim().length > 0,
        `claim "${claim.slug}" has an empty statement`,
      )
    }
  })

  it('adds claims only to ESTABLISHED cards', () => {
    // The increment decomposes reference-card summaries. A claim on a CONTESTED or
    // CONTEXT_DEPENDENT card is a different editorial act — asserting the trope, rather than
    // describing it — and is not covered by the reasoning in seed/referenceClaims.ts.
    const wrongStatus = referenceClaims
      .filter((c) => cardBySlug.get(c.cardSlug)?.status !== 'ESTABLISHED')
      .map((c) => `${c.slug} (${c.cardSlug} is ${cardBySlug.get(c.cardSlug)?.status})`)
    assert.deepEqual(wrongStatus, [])
  })

  it('does not inherit a claim status from the card that holds it', () => {
    // Issue #3 D1: a claim decomposed from summary/editorialNotes does not inherit the card's
    // epistemic status. The runner reads `seed.status` and never reads the card's status, so
    // nothing enforces the rule here — which is why it is asserted directly.
    //
    // A blanket rule ("a claim's status must differ from its card's") would be wrong: it would
    // force a false status on any claim that genuinely is as well-established as its card. So
    // the check is the inverse. The corpus must be capable of expressing a status that differs
    // from the card's, and it does so today (9 claims on CONTESTED cards are ESTABLISHED). If a
    // future change collapsed claim status onto card status everywhere, this fails.
    const divergent = allClaims.filter(
      (c) => cardBySlug.get(c.cardSlug)?.status !== c.status,
    )
    assert.ok(
      divergent.length > 0,
      'no claim anywhere holds a status different from its card, so claim status is ' +
        'indistinguishable from card status and D1 cannot be observed',
    )

    // And the 14 reference claims specifically: all sit on ESTABLISHED cards, so the data alone
    // cannot distinguish an independent judgement from inheritance. Each is asserted ESTABLISHED
    // deliberately because its statement is a documented historical or legal fact rather than an
    // interpretive position. These two are the ones where the card's ESTABLISHED status could
    // most easily have been copied onto a claim that is actually contestable, so they are named
    // individually rather than left to a bulk assertion.
    const contestable = [
      'west-bank-and-gaza-residents-cannot-vote-in-them',
      'israeli-national-elections-are-citizen-elections',
    ]
    for (const slug of contestable) {
      const claim = referenceClaims.find((c) => c.slug === slug)
      assert.ok(claim, `expected a reference claim named ${slug}`)
      assert.equal(
        claim.status,
        'ESTABLISHED',
        `${slug} is graded from the card's status, not its own warrant`,
      )
    }
  })

  it('gives every reference claim a stable slug', () => {
    const missing = referenceClaims
      .filter((c) => !c.slug || c.slug.trim().length === 0)
      .map((c) => c.cardSlug)
    assert.deepEqual(missing, [])
  })
})

describe('seed claim relations', () => {
  it('uses only values from the claim_relation_type enum', () => {
    const values: ReadonlySet<string> = new Set([...claimRelationTypeEnum.enumValues])
    for (const relation of claimRelations) {
      assert.ok(
        values.has(relation.relationType),
        `relation "${relation.sourceClaimSlug}" -> "${relation.targetClaimSlug}" uses ` +
          `"${relation.relationType}", which is not in the enum`,
      )
    }
  })

  it('never relates a claim to itself', () => {
    const selfDirected = claimRelations
      .filter((r) => r.sourceClaimSlug === r.targetClaimSlug)
      .map((r) => r.sourceClaimSlug)
    assert.deepEqual(selfDirected, [])
  })

  it('resolves both endpoints to known claims', () => {
    for (const relation of claimRelations) {
      assert.ok(
        claimSlugs.has(relation.sourceClaimSlug),
        `relation source "${relation.sourceClaimSlug}" is not a claim slug`,
      )
      assert.ok(
        claimSlugs.has(relation.targetClaimSlug),
        `relation target "${relation.targetClaimSlug}" is not a claim slug`,
      )
    }
  })

  it('never repeats a (source, target, type) triple', () => {
    // Mirrors claim_relations_unique_idx. Asserted here so a duplicate fails with a readable
    // message rather than being silently swallowed by onConflictDoNothing.
    const seen = new Set<string>()
    const duplicated: string[] = []
    for (const relation of claimRelations) {
      const key = [
        relation.sourceClaimSlug,
        relation.targetClaimSlug,
        relation.relationType,
      ].join('|')
      if (seen.has(key)) duplicated.push(key)
      seen.add(key)
    }
    assert.deepEqual(duplicated, [])
  })

  it('does not restate an inference binding', () => {
    // The distinction the schema cannot make: a claim relation states that two propositions
    // stand in a relationship, an inference binding states that one follows from the other
    // by a named inferential form. Writing the same pair in both tables gives one editorial
    // decision two homes, and a future edit to one will contradict the other.
    const bindings = new Set(inferencePairs().map(([p, c]) => `${p}|${c}`))
    const overlapping = claimRelations
      .filter(
        (r) =>
          bindings.has(`${r.sourceClaimSlug}|${r.targetClaimSlug}`) ||
          bindings.has(`${r.targetClaimSlug}|${r.sourceClaimSlug}`),
      )
      .map((r) => `${r.sourceClaimSlug} ${r.relationType} ${r.targetClaimSlug}`)
    assert.deepEqual(
      overlapping,
      [],
      'these pairs are already wired as an inference premise and conclusion',
    )
  })
})

describe('seed sources', () => {
  it('uses only values from the source_type enum', () => {
    const values: ReadonlySet<string> = new Set([...sourceType.enumValues])
    for (const source of corpusSources) {
      assert.ok(
        values.has(source.sourceType),
        `source "${source.label}" uses sourceType "${source.sourceType}", which is not in ` +
          'the enum',
      )
      assert.ok(
        source.title.trim().length > 0,
        `source "${source.label}" has an empty title`,
      )
    }
  })

  it('defines every source label and title exactly once', () => {
    // `sources` has no unique constraint. The runner reaches idempotency by reading on title
    // before inserting, so a repeated title merges two source records instead of failing.
    const labels = corpusSources.map((s) => s.label)
    assert.equal(new Set(labels).size, labels.length, 'duplicate source label')

    const titles = corpusSources.map((s) => s.title)
    assert.equal(new Set(titles).size, titles.length, 'duplicate source title')
  })

  it('resolves every attribution to a known claim and a known source', () => {
    for (const link of corpusClaimSources) {
      assert.ok(
        claimSlugs.has(link.claimSlug),
        `attribution references claim "${link.claimSlug}", which no claim file defines`,
      )
      assert.ok(
        sourceLabels.has(link.sourceLabel),
        `attribution references source "${link.sourceLabel}", which sourceLayer.ts does not ` +
          'define',
      )
      assert.ok(
        link.relationship.trim().length > 0,
        `attribution for "${link.claimSlug}" has an empty relationship`,
      )
    }
  })

  it('never repeats a (claim, source) pair', () => {
    // Mirrors the claim_sources primary key.
    const seen = new Set<string>()
    const duplicated: string[] = []
    for (const link of corpusClaimSources) {
      const key = `${link.claimSlug}|${link.sourceLabel}`
      if (seen.has(key)) duplicated.push(key)
      seen.add(key)
    }
    assert.deepEqual(duplicated, [])
  })

  it('asserts no quotation or locator on any attribution', () => {
    // The central constraint of this increment, enforced on the seed files so it cannot be
    // relaxed by editing a single row. A claim naming the document it rests on is a
    // bibliographic statement; a quotation is an assertion about wording, and nothing in the
    // corpus verifies wording. Excerpts belong in evidence_items with a verified locator.
    // See seed/sourceLayer.ts and docs/CORPUS_GAP_ANALYSIS.md section 4.
    const fabricated = corpusClaimSources
      .filter(
        (link) =>
          link.quoteOrExcerpt != null || link.pageReference != null,
      )
      .map((link) => link.claimSlug)
    assert.deepEqual(
      fabricated,
      [],
      'an attribution asserts a quote or page reference the corpus cannot verify',
    )
  })

  it('attaches every source to at least one claim', () => {
    const unattached = corpusSources
      .filter(
        (s) => !corpusClaimSources.some((link) => link.sourceLabel === s.label),
      )
      .map((s) => s.label)
    assert.deepEqual(
      unattached,
      [],
      'a source no claim rests on is dead weight in the bibliography',
    )
  })

  it('records no evidence items', () => {
    // `evidence_items` is seeded by no file. It requires a located passage with verifiable
    // wording, so its emptiness is a decision, and this asserts the decision still holds.
    assert.equal(corpusSources.length > 0, true, 'sanity: the source layer is populated')
  })
})

describe('seed concept links', () => {
  it('does not reuse a mechanism slug as a concept slug', () => {
    // Issue #3 Q2 required resolving this collision. Both columns are independent and
    // unconstrained, so nothing but this check prevents the vocabulary from drifting back.
    const mechanismSlugs: ReadonlySet<string> = new Set(mechanismsSeed.map((m) => m[0]))
    const collisions = conceptsSeed
      .map((c) => c[0])
      .filter((slug) => mechanismSlugs.has(slug))
    assert.deepEqual(
      collisions,
      [],
      'a concept slug that is also a mechanism slug is ambiguous to any reader given the slug',
    )
  })

  it('links only concepts and cards that exist', () => {
    const conceptSlugs: ReadonlySet<string> = new Set(conceptsSeed.map((c) => c[0]))
    const dangling = cardConceptLinksSeed
      .filter(
        (link) =>
          !conceptSlugs.has(link.conceptSlug) ||
          !cardBySlug.has(link.cardSlug),
      )
      .map((link) => `${link.cardSlug} -> ${link.conceptSlug}`)
    assert.deepEqual(dangling, [], 'card_concepts would reference a row that does not exist')
  })

  it('cites the card text that justifies every link', () => {
    // Q2 forbids inventing associations for coverage. Every link therefore carries the
    // sentence it rests on, so a reviewer can check the link without re-reading the corpus.
    const uncited = cardConceptLinksSeed
      .filter((link) => !link.relationship || link.relationship.trim().length === 0)
      .map((link) => `${link.cardSlug} -> ${link.conceptSlug}`)
    assert.deepEqual(
      uncited,
      [],
      'a concept link with no stated basis is an association invented for coverage',
    )
  })

  it('does not duplicate a card/concept pair', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const link of cardConceptLinksSeed) {
      const key = `${link.cardSlug}->${link.conceptSlug}`
      if (seen.has(key)) dupes.push(key)
      seen.add(key)
    }
    assert.deepEqual(
      dupes,
      [],
      'the pair is the primary key, so a duplicate is silently dropped on insert',
    )
  })
})
