import type { CardRelationshipSeed, CardSeed, ClaimSeed } from './types'

/**
 * Trope Graph v0.6 — Identity Retrospection cluster additions.
 *
 * CONSOLIDATION NOTES
 * -------------------
 * 1. Mechanism slugs were normalised onto the canonical kebab-case set introduced in
 *    v0.5 (src/db/seed/taxonomy.ts). The archived v0.6 file used SCREAMING_SNAKE_CASE
 *    slugs that duplicated existing rows:
 *      RETROSPECTIVE_IDENTITY -> retrospective-identity   (same name)
 *      ANACHRONISM            -> anachronism              (same name)
 *      ESSENTIALISM           -> essentialisation         ("Essentialism" and
 *                                 "Essentialisation" are the same mechanism; the v0.6
 *                                 wording is folded into the description below)
 *    The v0.6 mechanism list is therefore no longer seeded as separate rows. Its
 *    description wording is preserved in `essentialisation`'s description in taxonomy.ts.
 *
 * 2. `claimType` was absent from every v0.6 claim, but `trope_graph.claims.claim_type`
 *    is NOT NULL. Types were assigned from the wording of each claim. Where a statement
 *    explicitly describes itself as an interpretation, INTERPRETIVE was used, because
 *    the project treats "this is an interpretive reading" as a claim-level fact.
 *
 * 3. Relationship type strings were mapped onto the `relationship_type` enum. The
 *    archived file used free text such as 'similar mechanism'.
 *
 * 4. The `axis` field was authored here but read by nobody until migration 0008, so both
 *    cards silently lost their classification on every seed run. Two normalisations were
 *    applied when it became a real relation:
 *      'FACT-REBUTTAL' -> FACT_REBUTTAL   (matches the `card_axis` enum, which uses
 *                                         SCREAMING_SNAKE_CASE like every other enum
 *                                         in this schema)
 *      'HISTORICAL'    -> kept as-is      (see below)
 *    `canaanite-card` is the corpus's only HISTORICAL-axis card. HISTORICAL is a fourth
 *    `card_axis` value alongside the deck draft's original three, and it is what this
 *    card is: an argument about population continuity. It was not folded into
 *    FACT_REBUTTAL, which would have discarded the classification.
 */

export const identityRetrospectionCards: CardSeed[] = [
  {
    slug: 'jesus-was-a-zionist',
    title: 'Jesus Was a Zionist',
    primaryType: 'THEOLOGY',
    status: 'CONTESTED',
    collection: ['zionism-coded'],
    axis: ['THEOLOGICAL', 'FACT_REBUTTAL'],
    mechanisms: ['retrospective-identity', 'anachronism'],
    summary:
      'Tests the proposition that Jesus held the modern political ideology of Zionism, and separates first-century Jewish attachment to Israel and Jerusalem from that later political category.',
    editorialNotes:
      'Keep first-century historical claims, the modern political category, and the retrospective mapping between them as separate claims. Do not let the mapping collapse into an assertion about either period.',
    coreQuestion:
      'What does “Zionist” mean when applied retrospectively to a first-century Jewish figure?',
  },
  {
    slug: 'canaanite-card',
    title: 'The Canaanite Card',
    primaryType: 'REFERENCE',
    status: 'CONTESTED',
    collection: ['fact-rebuttal'],
    axis: ['HISTORICAL', 'FACT_REBUTTAL'],
    mechanisms: ['retrospective-identity', 'anachronism', 'essentialisation'],
    summary:
      'Reference card separating ancient Canaanite populations, Israelite ethnogenesis, and modern Palestinian identity, so that ancestry and continuity are not read as exclusive descent.',
    editorialNotes:
      'Distinguish ancient geography and population, the archaeologically attested emergence of Israel, shared regional ancestry, and modern national identity. Continuity is not the same proposition as exclusive descent.',
    coreQuestion:
      'What can legitimately be inferred from ancient Canaanite populations, Israelite ethnogenesis, ancient ancestry and modern Palestinian identity?',
  },
] as const

/**
 * Claim statements for the Identity Retrospection cluster.
 *
 * `slug` is a seed-local identifier used to wire premises and conclusions. The
 * `trope_graph.claims` table has no slug column, so the seed runner resolves these
 * labels to claim ids in memory. If a claim is absent here, any binding that references
 * it will fail loudly rather than silently insert a dangling reference.
 */
export const identityRetrospectionClaims: Array<ClaimSeed & { slug: string }> =
  [
    {
      cardSlug: 'jesus-was-a-zionist',
      slug: 'jesus-jewish-first-century',
      statement: 'Jesus was a Jewish figure of first-century Roman Judaea.',
      claimType: 'HISTORICAL',
      status: 'ESTABLISHED',
    },
    {
      cardSlug: 'jesus-was-a-zionist',
      slug: 'modern-zionism-later-political-category',
      statement:
        'Modern political Zionism is a later historical movement, so applying the modern political identity to Jesus is a retrospective interpretation.',
      claimType: 'HISTORICAL',
      status: 'ESTABLISHED',
    },
    {
      cardSlug: 'jesus-was-a-zionist',
      slug: 'jesus-zionist-interpretive-inference',
      statement:
        'The proposition that Jesus was a Zionist depends on the meaning assigned to “Zionist” and is therefore an interpretive inference rather than a straightforward historical identity.',
      claimType: 'INTERPRETIVE',
      status: 'CONTESTED',
    },
    {
      cardSlug: 'canaanite-card',
      slug: 'canaanite-world-diverse-populations',
      statement:
        'Canaan refers to an ancient geographic and cultural region inhabited by multiple populations.',
      claimType: 'HISTORICAL',
      status: 'ESTABLISHED',
    },
    {
      cardSlug: 'canaanite-card',
      slug: 'israelite-ethnogenesis-canaanite-context',
      statement:
        'A significant archaeological interpretation places early Israelite ethnogenesis within the broader Canaanite cultural and population context.',
      claimType: 'INTERPRETIVE',
      status: 'CONTESTED',
    },
    {
      cardSlug: 'canaanite-card',
      slug: 'merneptah-israel-attestation',
      statement:
        'The Merneptah Stele provides an extrabiblical reference to Israel in the late second millennium BCE.',
      claimType: 'EMPIRICAL',
      status: 'ESTABLISHED',
    },
    {
      cardSlug: 'canaanite-card',
      slug: 'ancient-levantine-ancestry-shared',
      statement:
        'Modern populations of the Levant, including Jews and Palestinians, share ancestry with ancient populations of the region.',
      claimType: 'EMPIRICAL',
      status: 'ESTABLISHED',
    },
    {
      cardSlug: 'canaanite-card',
      slug: 'canaanite-ancestry-modern-palestinian-narrative',
      statement:
        'Some modern Palestinian nationalist narratives connect Palestinians with ancient Canaanites as part of an argument for continuity and autochthony.',
      claimType: 'DESCRIPTIVE',
      status: 'ESTABLISHED',
    },
    {
      cardSlug: 'canaanite-card',
      slug: 'canaanite-palestinian-not-equivalence',
      statement:
        'Evidence of ancestry or continuity does not by itself establish that a modern Palestinian identity is identical to the ancient Canaanite population.',
      claimType: 'INTERPRETIVE',
      status: 'CONTESTED',
    },
    {
      cardSlug: 'canaanite-card',
      slug: 'palestinians-predated-hebrews-decompose',
      statement:
        'The claim that Palestinians predated Hebrews must be decomposed because “Canaanite”, “Israelite/Hebrew”, and “Palestinian” refer to categories from different historical periods.',
      claimType: 'INTERPRETIVE',
      status: 'CONTESTED',
    },
  ] as const

/**
 * Typed graph edges between cards.
 *
 * The archived v0.6 file expressed these as free-text pairs with no entity type. Every
 * endpoint resolves to a card slug present in either draftCards.ts or the list above, so
 * all edges are CARD → CARD.
 *
 * `'similar mechanism'` in the archive maps to the SIMILAR_MECHANISM enum value.
 */
export const identityRetrospectionRelationships: CardRelationshipSeed[] = [
  {
    fromCardSlug: 'jesus-is-a-muslim',
    toCardSlug: 'jesus-was-a-zionist',
    relationshipType: 'SIMILAR_MECHANISM',
  },
  {
    fromCardSlug: 'jesus-was-a-palestinian',
    toCardSlug: 'jesus-was-a-zionist',
    relationshipType: 'SIMILAR_MECHANISM',
  },
  {
    fromCardSlug: 'jesus-was-a-palestinian',
    toCardSlug: 'canaanite-card',
    relationshipType: 'SIMILAR_MECHANISM',
  },
  {
    fromCardSlug: 'jesus-is-a-muslim',
    toCardSlug: 'canaanite-card',
    relationshipType: 'RELATED',
  },
  {
    fromCardSlug: 'chronology',
    toCardSlug: 'canaanite-card',
    relationshipType: 'CONTEXTUALISES',
  },
  {
    fromCardSlug: 'chronology',
    toCardSlug: 'jesus-was-a-zionist',
    relationshipType: 'CONTEXTUALISES',
  },
  {
    fromCardSlug: 'jews-are-not-white',
    toCardSlug: 'canaanite-card',
    relationshipType: 'RELATED',
  },
  {
    fromCardSlug: 'jews-are-white',
    toCardSlug: 'canaanite-card',
    relationshipType: 'RELATED',
  },
  {
    fromCardSlug: 'white-european-settlers',
    toCardSlug: 'canaanite-card',
    relationshipType: 'CHALLENGES',
  },
  {
    fromCardSlug: 'settler-colonialism',
    toCardSlug: 'canaanite-card',
    relationshipType: 'CONTEXTUALISES',
  },
  {
    fromCardSlug: 'balfour-colonial-origins',
    toCardSlug: 'canaanite-card',
    relationshipType: 'CONTEXTUALISES',
  },
] as const
