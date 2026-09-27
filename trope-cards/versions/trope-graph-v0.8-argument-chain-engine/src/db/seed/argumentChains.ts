/** v0.8 examples. Symbolic slugs are resolved by the application seed runner. */
export const argumentChainSeed = {
  chains: [
    {
      cardSlug: "jesus-was-a-zionist",
      label: "Retrospective Zionist identity argument",
      description: "A reconstructed argument that maps first-century Jewish attachment to Israel and Jerusalem onto the modern political category of Zionism.",
      kind: "EDITORIAL_RECONSTRUCTION",
      epistemicStatus: "CONTESTED",
      steps: [
        { inferenceLabel: "Retrospective mapping of Zionist identity", role: "MAIN", ordinal: 1 },
        { inferenceLabel: "Historical-category distinction", role: "COUNTER", ordinal: 2 },
      ],
    },
    {
      cardSlug: "canaanite-card",
      label: "Canaanite continuity argument and counter-inference",
      description: "A reconstructed argument from ancient Canaanite continuity toward a modern Palestinian ancestry claim, alongside a counter-inference testing whether continuity establishes exclusive descent.",
      kind: "EDITORIAL_RECONSTRUCTION",
      epistemicStatus: "CONTESTED",
      steps: [
        { inferenceLabel: "Ancient Canaanite continuity to modern Palestinian identity", role: "MAIN", ordinal: 1 },
        { inferenceLabel: "Continuity does not establish exclusive modern descent", role: "COUNTER", ordinal: 2 },
      ],
    },
  ],
  inferenceSteps: [
    {
      cardSlug: "jesus-was-a-zionist",
      label: "Historical-category distinction",
      description: "Tests the inference by distinguishing first-century Jewish categories from the later modern political movement called Zionism.",
      inferenceType: "ANACHRONISTIC_MAPPING",
      epistemicStatus: "CONTESTED",
      isCanonical: false,
    },
    {
      cardSlug: "canaanite-card",
      label: "Continuity does not establish exclusive modern descent",
      description: "Tests whether ancient Canaanite-related ancestry can by itself establish exclusive descent or displace other historical and ancestral relationships.",
      inferenceType: "GENERALISATION",
      epistemicStatus: "CONTESTED",
      isCanonical: false,
    },
  ],
  stepRelations: [
    {
      cardSlug: "jesus-was-a-zionist",
      source: "Historical-category distinction",
      target: "Retrospective mapping of Zionist identity",
      relationType: "CHALLENGES",
      description: "The historical-category distinction challenges treating the modern category as straightforwardly identical with a first-century identity.",
    },
    {
      cardSlug: "canaanite-card",
      source: "Continuity does not establish exclusive modern descent",
      target: "Ancient Canaanite continuity to modern Palestinian identity",
      relationType: "QUALIFIES",
      description: "The counter-inference qualifies the move from regional ancestry or continuity to an exclusive modern identity claim.",
    },
  ],
};
