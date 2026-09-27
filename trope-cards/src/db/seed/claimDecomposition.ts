import type { ClaimDecompositionPayload } from './types'

/**
 * v0.7 seed examples — Claim Decomposition Engine.
 *
 * CONSOLIDATION NOTES
 * -------------------
 * The archived v0.7 file bound premises and conclusions to claim slugs that do not exist
 * in any seed. Six of the eight references were naming variants of claims that DO exist
 * in v0.6, one pointed at a *card* slug rather than a claim, and one named a claim that
 * was never written. Left as-is, every binding would have dangled.
 *
 * The bindings below are repaired to reference real claims:
 *
 *   jesus-was-jewish                              -> jesus-jewish-first-century
 *   modern-zionism-is-a-later-political-category  -> modern-zionism-later-political-category
 *   canaan-was-inhabited-by-diverse-populations   -> canaanite-world-diverse-populations
 *   israelite-ethnogenesis-occurred-within-canaanite-context
 *                                                 -> israelite-ethnogenesis-canaanite-context
 *   ancient-levantine-ancestry-persists-in-modern-populations
 *                                                 -> ancient-levantine-ancestry-shared
 *   jesus-was-a-zionist   (was a CARD slug)       -> jesus-zionist-interpretive-inference
 *   palestinians-are-descended-from-canaanites    -> canaanite-ancestry-modern-palestinian-narrative
 *
 * DROPPED, NOT INVENTED: the archived binding "jesus-engaged-israel-jewish-scripture"
 * asserts that Jesus engaged with Israel or Jewish scripture. No claim in any version
 * makes that assertion, so it was removed rather than fabricated. If it is wanted, the
 * claim needs to be written and sourced first. Tracked as follow-up work.
 *
 * The v0.8 counter-steps (see seed/argumentChains.ts) arrived with no premises or
 * conclusions at all. They are bound here to the claims that actually support them, with
 * explicit ordinals, so the counterargument side of each chain is populated.
 */

export const claimDecompositionSeed: ClaimDecompositionPayload = {
  inferenceSteps: [
    {
      cardSlug: 'jesus-was-a-zionist',
      label: 'Retrospective mapping of Zionist identity',
      description:
        "Moves from Jesus's Jewish identity and engagement with Israel/Jerusalem to the modern political category of Zionism.",
      inferenceType: 'RETROSPECTIVE_IDENTITY',
      epistemicStatus: 'CONTESTED',
      isCanonical: false,
    },
    {
      cardSlug: 'canaanite-card',
      label: 'Ancient Canaanite continuity to modern Palestinian identity',
      description:
        'Moves from ancient Canaanite-related ancestry and regional continuity to a modern Palestinian identity claim.',
      inferenceType: 'RETROSPECTIVE_IDENTITY',
      epistemicStatus: 'CONTESTED',
      isCanonical: false,
    },
  ],

  premiseBindings: [
    {
      inferenceLabel: 'Retrospective mapping of Zionist identity',
      premises: [
        {
          claimSlug: 'jesus-jewish-first-century',
          role: 'PRIMARY',
          ordinal: 0,
        },
        {
          claimSlug: 'modern-zionism-later-political-category',
          role: 'PRIMARY',
          ordinal: 1,
        },
      ],
    },
    {
      inferenceLabel:
        'Ancient Canaanite continuity to modern Palestinian identity',
      premises: [
        {
          claimSlug: 'canaanite-world-diverse-populations',
          role: 'PRIMARY',
          ordinal: 0,
        },
        {
          claimSlug: 'israelite-ethnogenesis-canaanite-context',
          role: 'PRIMARY',
          ordinal: 1,
        },
        {
          claimSlug: 'ancient-levantine-ancestry-shared',
          role: 'PRIMARY',
          ordinal: 2,
        },
      ],
    },
    {
      inferenceLabel: 'Historical-category distinction',
      premises: [
        {
          claimSlug: 'modern-zionism-later-political-category',
          role: 'PRIMARY',
          ordinal: 0,
        },
      ],
    },
    {
      inferenceLabel: 'Continuity does not establish exclusive modern descent',
      premises: [
        {
          claimSlug: 'ancient-levantine-ancestry-shared',
          role: 'PRIMARY',
          ordinal: 0,
        },
        {
          claimSlug: 'merneptah-israel-attestation',
          role: 'CONTEXT',
          ordinal: 1,
        },
        {
          claimSlug: 'palestinians-predated-hebrews-decompose',
          role: 'COUNTERPREMISE',
          ordinal: 2,
        },
      ],
    },
  ],

  conclusionBindings: [
    {
      inferenceLabel: 'Retrospective mapping of Zionist identity',
      conclusions: [
        { claimSlug: 'jesus-zionist-interpretive-inference', ordinal: 0 },
      ],
    },
    {
      inferenceLabel:
        'Ancient Canaanite continuity to modern Palestinian identity',
      conclusions: [
        {
          claimSlug: 'canaanite-ancestry-modern-palestinian-narrative',
          ordinal: 0,
        },
      ],
    },
    {
      inferenceLabel: 'Historical-category distinction',
      conclusions: [
        { claimSlug: 'jesus-zionist-interpretive-inference', ordinal: 0 },
      ],
    },
    {
      inferenceLabel: 'Continuity does not establish exclusive modern descent',
      conclusions: [
        { claimSlug: 'canaanite-palestinian-not-equivalence', ordinal: 0 },
      ],
    },
  ],
}
