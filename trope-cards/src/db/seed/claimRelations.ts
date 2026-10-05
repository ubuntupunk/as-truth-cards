import type { ClaimRelationType } from './types'

/**
 * Direct relations between claims — the v0.11 corpus increment.
 *
 * `trope_graph.claim_relations` shipped in v0.7 with an 11-value enum and stayed empty.
 * It is not the same thing as `inference_premises`: a claim relation says two propositions
 * stand in a stated relationship, while an inference step says one follows from others by
 * a named inferential form. Mixing them flattens the argumentative structure the
 * decomposition engine exists to preserve.
 *
 * THE RULE APPLIED
 * ----------------
 * Encode a relation only where a claim's OWN PROSE asserts it. Not where it follows from
 * editorial judgment, and never where the same pair is already wired as an inference
 * premise/conclusion binding.
 *
 * Consequences of that rule, recorded because they look like omissions:
 *
 *   - `modern-zionism-later-political-category` -> `jesus-zionist-interpretive-inference`
 *     is NOT encoded. It is already the PRIMARY premise of the "Historical-category
 *     distinction" step. Writing it in both tables would create two homes for one
 *     editorial decision.
 *   - `ancient-levantine-ancestry-shared` -> `canaanite-ancestry-modern-palestinian-narrative`
 *     is NOT encoded. Shared ancestry plausibly undercuts an exclusive-descent reading, but
 *     that undercutting is an inference this project can argue explicitly — it is not
 *     asserted by either claim's text, so encoding it would smuggle the argument in.
 *   - `merneptah-israel-attestation` -> `israelite-ethnogenesis-canaanite-context`
 *     is NOT encoded. The stele attests a name; the target claim is about ethnogenesis.
 *     The two are adjacent without one claim naming the other.
 *
 * Direction is source -> target: `sourceClaimSlug` <relationType> `targetClaimSlug`, read
 * as "the source claim stands to the target claim in this relation".
 */
export type ClaimRelationSeed = {
  sourceClaimSlug: string
  relationType: ClaimRelationType
  targetClaimSlug: string
  description?: string
}

/** Both endpoints must resolve to a slug defined in some claim seed file. */
export const claimRelations: ClaimRelationSeed[] = [
  {
    // Target prose: "places early Israelite ethnogenesis within the broader Canaanite
    // cultural and population context" — names the source claim's content as its context.
    sourceClaimSlug: 'canaanite-world-diverse-populations',
    relationType: 'CONTEXTUALISES',
    targetClaimSlug: 'israelite-ethnogenesis-canaanite-context',
    description:
      'The diverse-population character of Canaan is the context within which Israelite ethnogenesis is placed.',
  },
  {
    // Source prose: "Evidence of ancestry or continuity does not by itself establish..."
    // — an explicit rebuttal of the target's continuity-and-autochthony inference.
    sourceClaimSlug: 'canaanite-palestinian-not-equivalence',
    relationType: 'CHALLENGES',
    targetClaimSlug: 'canaanite-ancestry-modern-palestinian-narrative',
    description:
      'Ancestry or continuity evidence does not by itself establish identity, which is what the narrative relies on.',
  },
  {
    // Source prose: "The claim that Palestinians predated Hebrews must be decomposed..."
    // — names the target claim as its explicit subject.
    sourceClaimSlug: 'palestinians-predated-hebrews-decompose',
    relationType: 'QUALIFIES',
    targetClaimSlug: 'canaanite-ancestry-modern-palestinian-narrative',
    description:
      'The narrative’s descent claim must be decomposed by period, because Canaanite, Israelite/Hebrew, and Palestinian are categories from different periods.',
  },
  {
    // Target prose: "Modern political Zionism is a later historical movement..." — "later"
    // is only meaningful against a first-century date, which the source claim supplies.
    // This pair is NOT an inference binding, so the duplication rule does not apply.
    sourceClaimSlug: 'jesus-jewish-first-century',
    relationType: 'CONTEXTUALISES',
    targetClaimSlug: 'modern-zionism-later-political-category',
    description:
      'The first-century date is the temporal frame against which modern Zionism is a later movement.',
  },
  {
    // Card summary: "Distinguishes the Pan-Arab genealogy of the flag design from its
    // later Palestinian national meaning" — the summary itself asserts the distinction.
    sourceClaimSlug: 'palestinian-flag-design-genealogy-pan-arab',
    relationType: 'QUALIFIES',
    targetClaimSlug: 'palestinian-flag-carries-national-meaning',
    description:
      'The flag’s design genealogy is what the later national meaning must be read against, not collapsed into.',
  },
]
