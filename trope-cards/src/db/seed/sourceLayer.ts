import type { ClaimSourceSeed, SourceSeed } from './types'

/**
 * The bibliographic source layer — the v0.11 corpus increment.
 *
 * WHY THIS FILE IS SMALL
 * ----------------------
 * `sources` was empty. It could have been filled with the scholarship behind each card, but
 * none of that scholarship is named anywhere in the authored corpus: the seed files cite no
 * authors, no publishers, no years, no editions. Writing them would mean importing outside
 * research and presenting it as corpus metadata.
 *
 * So the only admissible sources are documents the authored material already names by hand.
 * Three qualify:
 *
 *   1. The Qur'an — named in `land-of-the-children-of-israel`'s `editorialNotes` ("Attach the
 *      relevant Qur'anic passages as primary sources with translation/version metadata") and
 *      named outright in the statements of three existing claims.
 *   2. The Protocols of the Elders of Zion — the subject of the `elders-of-zion` card, whose
 *      claim asserts the text's fabricated character. Naming it is the claim's content.
 *   3. The Merneptah Stele — named in the statement of the existing
 *      `merneptah-israel-attestation` claim.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN
 * --------------------------------------------
 * `evidence_items`. Recording an evidence item requires `content` — a located passage — plus
 * `locator` and `locatorType`. The corpus can name the Qur'an; it cannot assert a specific
 * verse number and translation wording that survives verification. Generating a
 * plausible-looking quotation would be worse than leaving the table empty, because a quoted
 * passage reads as checked work while a missing one reads as not-yet-done. The seed runner
 * carries the same refusal:
 *
 *   > There are no located passages to record yet, and inventing them would misrepresent
 *   > evidence that does not exist.
 *
 * The gap between naming a source and citing it is deliberate, and `claim_sources` marks that
 * gap by leaving `quoteOrExcerpt` and `pageReference` null.
 *
 * `claim_sources.relationship` uses one value: `ATTRIBUTED_TO`. It is the verb the claims
 * themselves use — these claims state what a document contains or what a text is, so they
 * attribute themselves to that document. It is not `SUPPORTS` or `CONFIRMS`: attaching a
 * document to a claim says the claim is *about* or *derived from* it, which is a weaker and
 * more honest statement than that the document proves the claim.
 */
export const corpusSources: SourceSeed[] = [
  {
    label: 'quran',
    title: "The Qur'an",
    sourceType: 'PRIMARY_DOCUMENT',
    author: 'Anonymous (compiled and transmitted)',
    description:
      'Islamic scripture, cited as a primary document by claims concerning passages about the Children of Israel and about Jesus. No specific verse references are asserted here; see the note on evidence_items above.',
  },
  {
    label: 'protocols-of-the-elders-of-zion',
    title: 'The Protocols of the Elders of Zion',
    sourceType: 'PRIMARY_DOCUMENT',
    description:
      'Antisemitic conspiracy text, cited as the object of the elders-of-zion claims. Named here as the subject of those claims, not endorsed as a source of historical information.',
  },
  {
    label: 'merneptah-stele',
    title: 'The Merneptah Stele',
    sourceType: 'PRIMARY_DOCUMENT',
    author: 'Commissioned by Pharaoh Merneptah',
    description:
      'Egyptian inscription providing an extrabiblical reference to Israel in the late second millennium BCE. Named in the statement of the merneptah-israel-attestation claim.',
  },
]

/**
 * Claim-to-source attributions.
 *
 * Every entry attaches a claim to a document that the claim's own text already names. Each
 * carries no quote and no locator, because asserting a passage would require a verified verse
 * or page reference this increment does not have. `notes` records that absence rather than
 * leaving it implicit, so a later editor can see the intended next step.
 */
export const corpusClaimSources: ClaimSourceSeed[] = [
  // -- Qur'an ---------------------------------------------------------------
  {
    claimSlug: 'quran-passes-to-children-of-israel-land',
    sourceLabel: 'quran',
    relationship: 'ATTRIBUTED_TO',
    notes:
      'Claim states the Qur’an contains these passages. Quote and verse locator deliberately omitted pending verified translation and edition metadata.',
  },
  {
    claimSlug: 'quran-passages-children-of-israel-relationship-to-land',
    sourceLabel: 'quran',
    relationship: 'ATTRIBUTED_TO',
    notes:
      'Claim states the Qur’an contains these passages. Quote and verse locator deliberately omitted pending verified translation and edition metadata.',
  },
  {
    claimSlug: 'islamic-theology-jesus-prophet-messiah',
    sourceLabel: 'quran',
    relationship: 'ATTRIBUTED_TO',
    notes:
      "Claim describes Islamic theology's presentation of Jesus as prophet and Messiah. Quote omitted; the claim's evidenceRequirement already specifies primary Qur'anic passages plus theological commentary, and the commentary is not yet recorded.",
  },

  // -- Protocols of the Elders of Zion -------------------------------------
  {
    claimSlug: 'elders-of-zion-text-is-fabricated',
    sourceLabel: 'protocols-of-the-elders-of-zion',
    relationship: 'ATTRIBUTED_TO',
    notes:
      'The text is the subject of the claim. Whether any particular passage was written when is a separate question this attribution does not answer.',
  },
  {
    claimSlug: 'elders-of-zion-text-is-influential-forgery',
    sourceLabel: 'protocols-of-the-elders-of-zion',
    relationship: 'ATTRIBUTED_TO',
    notes:
      'The text is the object whose circulation the claim describes. Circulation itself is not documented here; no edition or publication history is asserted.',
  },

  // -- Merneptah Stele ------------------------------------------------------
  {
    claimSlug: 'merneptah-israel-attestation',
    sourceLabel: 'merneptah-stele',
    relationship: 'ATTRIBUTED_TO',
    notes:
      'Claim names the stele as its evidence base. Inscription text and translation are not reproduced here; a located transcription belongs in evidence_items.',
  },
]
