/**
 * v0.7 seed examples.
 *
 * IDs are symbolic slugs here because the existing v0.x seed layer owns UUID
 * resolution. The application seed runner should resolve these to claim IDs.
 */

export const claimDecompositionSeed = {
  inferenceSteps: [
    {
      cardSlug: "jesus-was-a-zionist",
      label: "Retrospective mapping of Zionist identity",
      description:
        "Moves from Jesus's Jewish identity and engagement with Israel/Jerusalem to the modern political category of Zionism.",
      inferenceType: "RETROSPECTIVE_IDENTITY",
      epistemicStatus: "CONTESTED",
      isCanonical: false,
    },
    {
      cardSlug: "canaanite-card",
      label: "Ancient Canaanite continuity to modern Palestinian identity",
      description:
        "Moves from ancient Canaanite-related ancestry and regional continuity to a modern Palestinian identity claim.",
      inferenceType: "RETROSPECTIVE_IDENTITY",
      epistemicStatus: "CONTESTED",
      isCanonical: false,
    },
  ],

  premiseBindings: [
    {
      inferenceLabel: "Retrospective mapping of Zionist identity",
      claimSlugs: [
        "jesus-was-jewish",
        "jesus-engaged-israel-jewish-scripture",
        "modern-zionism-is-a-later-political-category",
      ],
    },
    {
      inferenceLabel: "Ancient Canaanite continuity to modern Palestinian identity",
      claimSlugs: [
        "canaan-was-inhabited-by-diverse-populations",
        "israelite-ethnogenesis-occurred-within-canaanite-context",
        "ancient-levantine-ancestry-persists-in-modern-populations",
      ],
    },
  ],

  conclusions: [
    {
      inferenceLabel: "Retrospective mapping of Zionist identity",
      claimSlug: "jesus-was-a-zionist",
    },
    {
      inferenceLabel: "Ancient Canaanite continuity to modern Palestinian identity",
      claimSlug: "palestinians-are-descended-from-canaanites",
    },
  ],
};
