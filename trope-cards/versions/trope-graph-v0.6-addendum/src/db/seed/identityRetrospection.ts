/** Trope Graph v0.6 — Identity Retrospection cluster additions. */

export const identityRetrospectionMechanisms = [
  {
    slug: 'RETROSPECTIVE_IDENTITY',
    name: 'Retrospective identity',
    description:
      'Assigning a later identity, political category, national identity, or population label to an earlier person or population.',
  },
  {
    slug: 'ANACHRONISM',
    name: 'Anachronism',
    description:
      'Applying a later category, institution, concept, or terminology to an earlier historical period without establishing continuity of meaning.',
  },
  {
    slug: 'ESSENTIALISM',
    name: 'Essentialism',
    description:
      'Treating ancestry, ethnicity, nationality, religion, or identity as a fixed essence that passes unchanged across historical periods.',
  },
] as const;

export const identityRetrospectionCards = [
  {
    slug: 'jesus-was-a-zionist',
    title: 'Jesus Was a Zionist',
    type: 'THEOLOGY',
    epistemicStatus: 'CONTESTED',
    mechanisms: ['RETROSPECTIVE_IDENTITY', 'ANACHRONISM'],
    coreQuestion:
      'What does “Zionist” mean when applied retrospectively to a first-century Jewish figure?',
  },
  {
    slug: 'canaanite-card',
    title: 'The Canaanite Card',
    type: 'REFERENCE',
    epistemicStatus: 'CONTESTED',
    mechanisms: ['RETROSPECTIVE_IDENTITY', 'ANACHRONISM', 'ESSENTIALISM'],
    coreQuestion:
      'What can legitimately be inferred from ancient Canaanite populations, Israelite ethnogenesis, ancient ancestry and modern Palestinian identity?',
  },
] as const;

export const identityRetrospectionClaims = [
  {
    cardSlug: 'jesus-was-a-zionist',
    slug: 'jesus-jewish-first-century',
    text: 'Jesus was a Jewish figure of first-century Roman Judaea.',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'jesus-was-a-zionist',
    slug: 'modern-zionism-later-political-category',
    text: 'Modern political Zionism is a later historical movement, so applying the modern political identity to Jesus is a retrospective interpretation.',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'jesus-was-a-zionist',
    slug: 'jesus-zionist-interpretive-inference',
    text: 'The proposition that Jesus was a Zionist depends on the meaning assigned to “Zionist” and is therefore an interpretive inference rather than a straightforward historical identity.',
    status: 'CONTESTED',
  },
  {
    cardSlug: 'canaanite-card',
    slug: 'canaanite-world-diverse-populations',
    text: 'Canaan refers to an ancient geographic and cultural region inhabited by multiple populations.',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'canaanite-card',
    slug: 'israelite-ethnogenesis-canaanite-context',
    text: 'A significant archaeological interpretation places early Israelite ethnogenesis within the broader Canaanite cultural and population context.',
    status: 'CONTESTED',
  },
  {
    cardSlug: 'canaanite-card',
    slug: 'merneptah-israel-attestation',
    text: 'The Merneptah Stele provides an extrabiblical reference to Israel in the late second millennium BCE.',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'canaanite-card',
    slug: 'ancient-levantine-ancestry-shared',
    text: 'Modern populations of the Levant, including Jews and Palestinians, share ancestry with ancient populations of the region.',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'canaanite-card',
    slug: 'canaanite-ancestry-modern-palestinian-narrative',
    text: 'Some modern Palestinian nationalist narratives connect Palestinians with ancient Canaanites as part of an argument for continuity and autochthony.',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'canaanite-card',
    slug: 'canaanite-palestinian-not-equivalence',
    text: 'Evidence of ancestry or continuity does not by itself establish that a modern Palestinian identity is identical to the ancient Canaanite population.',
    status: 'CONTESTED',
  },
  {
    cardSlug: 'canaanite-card',
    slug: 'palestinians-predated-hebrews-decompose',
    text: 'The claim that Palestinians predated Hebrews must be decomposed because “Canaanite”, “Israelite/Hebrew”, and “Palestinian” refer to categories from different historical periods.',
    status: 'CONTESTED',
  },
] as const;

export const identityRetrospectionRelationships = [
  ['jesus-is-a-muslim', 'jesus-was-a-zionist', 'similar mechanism'],
  ['jesus-was-a-palestinian', 'jesus-was-a-zionist', 'similar mechanism'],
  ['jesus-was-a-palestinian', 'canaanite-card', 'similar mechanism'],
  ['jesus-is-a-muslim', 'canaanite-card', 'related'],
  ['the-land-of-the-children-of-israel', 'canaanite-card', 'contextualises'],
  ['chronology', 'canaanite-card', 'contextualises'],
  ['chronology', 'jesus-was-a-zionist', 'contextualises'],
  ['jews-are-not-white', 'canaanite-card', 'related'],
  ['jews-are-white', 'canaanite-card', 'related'],
  ['white-european-settlers', 'canaanite-card', 'challenges'],
  ['settler-colonialism', 'canaanite-card', 'contextualises'],
  ['balfour-colonial-origins', 'canaanite-card', 'contextualises'],
] as const;
