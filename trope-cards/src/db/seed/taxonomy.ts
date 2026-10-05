export const collectionsSeed = [
  {
    slug: 'classic',
    name: 'Classic Tropes',
    description: 'Historical and recurring antisemitic trope patterns.',
  },
  {
    slug: 'zionism-coded',
    name: 'Zionism-coded Tropes',
    description:
      'Contemporary claims requiring distinction between criticism of Zionism/Israel and anti-Jewish stereotyping.',
  },
  {
    slug: 'south-africa',
    name: 'South Africa',
    description: 'Regional cases and institutional disputes.',
  },
  {
    slug: 'fact-rebuttal',
    name: 'Fact-Rebuttal Reference',
    description:
      'Factual, historical, legal and definitional reference material.',
  },
  {
    slug: 'foundational',
    name: 'Foundational',
    description: 'Cross-cutting definitions and taxonomy cards.',
  },
] as const

export const mechanismsSeed = [
  [
    'inversion',
    'Inversion',
    'Reverses roles, meanings, or historical relationships.',
  ],
  [
    'conspiracy',
    'Conspiracy',
    'Attributes coordinated hidden control to a collective actor without adequate evidence.',
  ],
  [
    'substitution',
    'Substitution',
    'Replaces one group or actor with another while preserving an accusation or stereotype.',
  ],
  [
    'collectivisation',
    'Collectivisation',
    'Moves from an individual, institution, or government to a whole group.',
  ],
  [
    'exclusion',
    'Exclusion',
    'Treats identity or affiliation as grounds for exclusion from participation.',
  ],
  [
    'equivalence',
    'Equivalence',
    'Treats materially different actors, events, or categories as interchangeable.',
  ],
  [
    'double-standard',
    'Double standard',
    'Applies materially different evidentiary or moral standards to comparable cases.',
  ],
  [
    'essentialisation',
    'Essentialisation',
    'Treats a diverse population as possessing one fixed essence. Also covers treating ancestry, ethnicity, nationality, religion, or identity as a fixed essence that is assumed to pass unchanged across historical periods.',
  ],
  [
    'context-stripping',
    'Context stripping',
    'Removes a quotation, event, map, document, or historical episode from material context.',
  ],
  [
    'demonisation',
    'Demonisation',
    'Attributes inherent evil, contamination, or dehumanising characteristics to a collective.',
  ],
  [
    'guilt-by-association',
    'Guilt by association',
    'Treats association or affiliation as sufficient evidence of culpability.',
  ],
  [
    'racial-essentialism',
    'Racial essentialism',
    'Compresses a diverse population into a predetermined racial category.',
  ],
  [
    'anachronism',
    'Anachronism',
    'Applies a later political, national, religious, or social category to an earlier historical context without establishing that the category had the same meaning.',
  ],
  [
    'retrospective-identity',
    'Retrospective identity',
    'Projects a later identity category backward onto a historical person or community.',
  ],
] as const

/**
 * Concept vocabulary.
 *
 * A Concept names a *subject* a card is about; a Mechanism names a *move* the text performs.
 * That distinction is the whole reason both tables exist, so it is also the rule for what may not
 * appear here.
 *
 * Issue #3 Q2 required resolving the mechanism/concept slug collision, and there were two:
 * `collectivisation` and `racial-essentialism` existed in both tables with near-identical
 * definitions. `collectivisation` (mechanism) is "moves from an individual, institution, or
 * government to a whole group"; the concept of the same name is "attributing the conduct of an
 * individual to a wider collective". Same move. `racial-essentialism` and its concept counterpart
 * likewise restate each other, and sit close to the `essentialisation` mechanism besides.
 *
 * Those two concepts were removed rather than renamed. Renaming would have created a permanent
 * near-duplicate vocabulary entry — the mechanism keeps the canonical slug, and a concept such as
 * `collective-attribution` would differ from it only in wording, so a reader could not tell which
 * table a bare slug referred to. A concept that restates a mechanism also has no independent job:
 * it would be the same editorial fact in two places, which is the duplication Q1 forbids between
 * `claim_relations` and `inference_*`.
 *
 * So the concept vocabulary is deliberately narrow: three subject terms and one analytical frame.
 * `anti-zionism` keeps an explicit note that it is not synonymous with `antisemitism`, because the
 * project treats conflating them as an error worth recording in the data rather than in prose.
 */
export const conceptsSeed = [
  [
    'antisemitism',
    'Antisemitism',
    'Hostility toward Jews as a group; the project should preserve the distinction between the term, its definitions, and its application to particular claims.',
  ],
  [
    'anti-zionism',
    'Anti-Zionism',
    'Opposition to Zionism as a political or ideological position; not synonymous with antisemitism.',
  ],
  [
    'zionism',
    'Zionism',
    'A family of Jewish nationalist movements and ideas with differing historical and contemporary forms.',
  ],
  [
    'historical-analogy',
    'Historical analogy',
    'Using similarities between historical cases to illuminate or argue about a contemporary case.',
  ],
] as const

/**
 * Card → Concept links, each traceable to authored card text.
 *
 * `card_concepts` was 0 rows, which left all concepts orphaned; the graph view warned about this
 * on every request. Q2 makes populating it a deliberate task and forbids inventing associations
 * for coverage, so each entry below cites the sentence in the card's own `summary` or
 * `editorialNotes` that supports it. A card whose text does not name the subject is absent even
 * where the association would be defensible — 15 CONTEXT_DEPENDENT cards could all be argued into
 * `antisemitism`, and none are listed, because none of them say so.
 */
export const cardConceptLinksSeed: ReadonlyArray<{
  cardSlug: string
  conceptSlug: string
  relationship: string
}> = [
  {
    cardSlug: 'elders-of-zion',
    conceptSlug: 'antisemitism',
    relationship:
      'Subject: summary calls the Protocols an "influential antisemitic forgery".',
  },
  {
    cardSlug: 'shylock',
    conceptSlug: 'antisemitism',
    relationship:
      'Subject: summary names the stereotype associating Jews with usury and predatory lending.',
  },
  {
    cardSlug: 'holocaust-denial-distortion',
    conceptSlug: 'antisemitism',
    relationship:
      'Subject: summary is about distorting the record of the Nazi genocide of European Jews.',
  },
  {
    cardSlug: 'weaponizing-antisemitism',
    conceptSlug: 'antisemitism',
    relationship: 'Subject: named in the title and summary.',
  },
  {
    cardSlug: 'jews-are-not-semites',
    conceptSlug: 'antisemitism',
    relationship:
      'Subject: summary is about the coinage of antisemitism and its scope.',
  },
  {
    cardSlug: 'jesus-was-a-zionist',
    conceptSlug: 'zionism',
    relationship:
      'Subject: summary separates first-century Jewish attachment from "that later political category".',
  },
  {
    cardSlug: 'muhammad-was-a-zionist',
    conceptSlug: 'zionism',
    relationship:
      'Subject: card tests the same anachronism against Zionism as a political category.',
  },
  {
    cardSlug: 'zionist-as-slur',
    conceptSlug: 'zionism',
    relationship:
      'Subject: summary is about a political label used as a proxy for a group.',
  },
  {
    cardSlug: 'zionist-as-slur',
    conceptSlug: 'antisemitism',
    relationship:
      'Subject: summary concerns using the label as a proxy for a Jewish or ethnic group.',
  },
  {
    cardSlug: 'apartheid-collaborators',
    conceptSlug: 'historical-analogy',
    relationship:
      'Method: summary is an explicitly comparative history question.',
  },
  {
    cardSlug: 'israel-apartheid-severance',
    conceptSlug: 'historical-analogy',
    relationship:
      'Method: summary examines change over time against the apartheid relationship as precedent.',
  },
  {
    cardSlug: 'apartheid-map',
    conceptSlug: 'historical-analogy',
    relationship:
      'Method: summary tests one case against the legal and political category of another.',
  },
]

export const localesSeed = [
  {
    slug: 'south-africa',
    name: 'South Africa',
    description: 'Regional cases and institutional disputes in South Africa.',
  },
] as const
