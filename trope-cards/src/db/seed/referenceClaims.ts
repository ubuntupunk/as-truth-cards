import type { ClaimSeed } from './types'

/**
 * Claims for the `ESTABLISHED` reference cards — the v0.11 corpus increment.
 *
 * WHY THESE CARDS
 * ---------------
 * Before this file, all 19 claims in the corpus belonged to the Identity Retrospection
 * cluster. The 8 `ESTABLISHED` cards had none, which is backwards: an `ESTABLISHED` card
 * is reference material whose summary states checkable facts, so its content decomposes
 * into claims most directly. See docs/CORPUS_GAP_ANALYSIS.md §2.
 *
 * THE ONE RULE APPLIED
 * --------------------
 * Every claim below is a decomposition of text that already exists on its card — the
 * `summary`, or the `editorialNotes` where present. Nothing new is asserted. The test for
 * each candidate was: *is this already entailed by the card's authored text?* Where the
 * answer was no, the claim was not written.
 *
 * Claims deliberately NOT written because they failed that test:
 *   - which translator's rendering of a passage supports a claim
 *   - the year a specific policy began
 *   - what a named person stated or intended
 *   - which parties were involved in an institutional dispute
 * Those need sourcing, which §4 of the gap analysis explains this increment does not
 * fabricate.
 *
 * `chronology` is excluded even though it is `ESTABLISHED`. Its summary — "Places competing
 * national movements and political developments on their respective timelines" — describes
 * what the card *does*, not a proposition the card asserts. There is nothing there to
 * decompose without importing outside research.
 *
 * The 15 `CONTEXT_DEPENDENT` cards are also excluded. Most are tactic descriptions, where a
 * claim would assert the trope itself rather than describe its operation — a materially
 * different and riskier editorial act than decomposing a reference card.
 */
export const referenceClaims: Array<ClaimSeed & { slug: string }> = [
  // -- elders-of-zion -------------------------------------------------------
  // Summary: "The Protocols of the Elders of Zion as a fabricated conspiracy text and
  // influential antisemitic forgery." Two propositions: what it is, what it did.
  {
    cardSlug: 'elders-of-zion',
    slug: 'elders-of-zion-text-is-fabricated',
    statement:
      'The Protocols of the Elders of Zion is a fabricated text, not the record of any actual conspiracy.',
    claimType: 'HISTORICAL',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'elders-of-zion',
    slug: 'elders-of-zion-text-is-influential-forgery',
    statement:
      'The Protocols of the Elders of Zion circulated as an influential antisemitic forgery.',
    claimType: 'EMPIRICAL',
    status: 'ESTABLISHED',
  },

  // -- jews-are-not-semites -------------------------------------------------
  // Summary: "Explains the nineteenth-century political coinage of antisemitism and the
  // distinction between linguistic Semitic classification and the modern term."
  {
    cardSlug: 'jews-are-not-semites',
    slug: 'semite-is-a-linguistic-classification',
    statement:
      'Semitic is a linguistic and ethnolinguistic classification, not a modern political category.',
    claimType: 'DESCRIPTIVE',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'jews-are-not-semites',
    slug: 'antisemitism-coined-in-nineteenth-century',
    statement:
      'Antisemitism as a political term was coined in nineteenth-century Europe.',
    claimType: 'HISTORICAL',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'jews-are-not-semites',
    slug: 'jews-are-semitic-speaking-peoples',
    statement:
      'Jewish populations are Semitic-speaking peoples falling within that linguistic classification.',
    claimType: 'DESCRIPTIVE',
    status: 'ESTABLISHED',
  },

  // -- voting-rights --------------------------------------------------------
  // Summary: "Separates Israeli citizenship and national elections from the status of
  // residents of the West Bank and Gaza." Two statuses, kept apart.
  {
    cardSlug: 'voting-rights',
    slug: 'israeli-national-elections-are-citizen-elections',
    statement:
      'Israeli national elections are elections in which Israeli citizens vote.',
    claimType: 'LEGAL',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'voting-rights',
    slug: 'west-bank-and-gaza-residents-cannot-vote-in-them',
    statement:
      'Residents of the West Bank and Gaza do not vote in Israeli national elections.',
    claimType: 'EMPIRICAL',
    status: 'ESTABLISHED',
  },

  // -- palestinian-flag -----------------------------------------------------
  // Summary: "Distinguishes the Pan-Arab genealogy of the flag design from its later
  // Palestinian national meaning."
  {
    cardSlug: 'palestinian-flag',
    slug: 'palestinian-flag-design-genealogy-pan-arab',
    statement:
      'The Palestinian flag’s colour design descends from the flag used during the Pan-Arab revolt.',
    claimType: 'HISTORICAL',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'palestinian-flag',
    slug: 'palestinian-flag-carries-national-meaning',
    statement: 'The flag has since come to carry Palestinian national meaning.',
    claimType: 'DESCRIPTIVE',
    status: 'ESTABLISHED',
  },

  // -- shylock --------------------------------------------------------------
  // Summary: "A historical stereotype associating Jews with deceptive commerce,
  // predatory lending, or usury." EditorialNotes: "...while distinguishing regions and
  // periods."
  {
    cardSlug: 'shylock',
    slug: 'shylock-usury-stereotype',
    statement:
      'A historical stereotype associates Jewish people with usury, predatory lending, or deceptive commerce.',
    claimType: 'DESCRIPTIVE',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'shylock',
    slug: 'shylock-stereotype-varies-by-region-and-period',
    statement:
      'The stereotype takes different forms in different regions and periods rather than holding in one fixed form.',
    claimType: 'HISTORICAL',
    status: 'ESTABLISHED',
  },

  // -- holocaust-denial-distortion ------------------------------------------
  // Summary: "Distinguishes denial of the Nazi genocide of European Jews from
  // minimisation, chronology manipulation, selective comparison, or inversion."
  {
    cardSlug: 'holocaust-denial-distortion',
    slug: 'nazi-genocide-of-european-jews-occurred',
    statement: 'The Nazi genocide of European Jews occurred.',
    claimType: 'HISTORICAL',
    status: 'ESTABLISHED',
  },
  {
    cardSlug: 'holocaust-denial-distortion',
    slug: 'holocaust-distortion-forms-are-distinct',
    statement:
      'Denial, minimisation, chronology manipulation, selective comparison, and inversion are distinct ways of distorting the historical record of that genocide.',
    claimType: 'DESCRIPTIVE',
    status: 'ESTABLISHED',
  },

  // -- israel-apartheid-severance -------------------------------------------
  // Summary: "Examines the change over time in Israel's relationship with apartheid South
  // Africa, including the 1987 severance of remaining military ties."
  {
    cardSlug: 'israel-apartheid-severance',
    slug: 'israel-apartheid-military-ties-severed-1987',
    statement:
      'Israel severed its remaining military ties with apartheid South Africa in 1987.',
    claimType: 'HISTORICAL',
    status: 'ESTABLISHED',
  },
]
