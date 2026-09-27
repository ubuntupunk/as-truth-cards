export type ClaimPilotSeed = {
  cardSlug: string;
  claims: Array<{
    slug: string;
    statement: string;
    claimType:
      | "DESCRIPTIVE"
      | "HISTORICAL"
      | "EMPIRICAL"
      | "LEGAL"
      | "THEOLOGICAL"
      | "INTERPRETIVE"
      | "RHETORICAL";
    epistemicStatus:
      | "ESTABLISHED"
      | "CONTESTED"
      | "OPEN"
      | "CONTEXT_DEPENDENT"
      | "UNSUPPORTED"
      | "LIVE";
    sourceRequirement: string;
  }>;
};

export const claimPilot: ClaimPilotSeed[] = [
  {
    cardSlug: "dual-loyalty",
    claims: [
      {
        slug: "dual-loyalty-identity-as-disloyalty",
        statement:
          "The dual-loyalty trope can treat Jewish identity or a connection to Israel as evidence that a person cannot be a fully loyal citizen.",
        claimType: "RHETORICAL",
        epistemicStatus: "CONTEXT_DEPENDENT",
        sourceRequirement: "Primary examples of the accusation; historical scholarship on the trope.",
      },
      {
        slug: "dual-loyalty-individual-to-collective",
        statement:
          "The rhetorical move changes an individual's political preference or religious connection into evidence of collective disloyalty.",
        claimType: "INTERPRETIVE",
        epistemicStatus: "CONTEXT_DEPENDENT",
        sourceRequirement: "Examples showing the inferential move; scholarly analysis.",
      },
      {
        slug: "dual-loyalty-conflict-of-interest-distinction",
        statement:
          "Criticism of an individual's actual conflict of interest is analytically distinct from a blanket presumption that Jewish identity creates divided citizenship.",
        claimType: "INTERPRETIVE",
        epistemicStatus: "ESTABLISHED",
        sourceRequirement: "Comparative examples and definitional sources.",
      },
    ],
  },
  {
    cardSlug: "jerusalem-sovereignty",
    claims: [
      {
        slug: "jerusalem-distinguish-control-and-sovereignty",
        statement:
          "Claims about Jerusalem should distinguish historical administration, present control, sovereignty claims, and international legal status.",
        claimType: "LEGAL",
        epistemicStatus: "ESTABLISHED",
        sourceRequirement: "Primary legal/institutional documents and historical records.",
      },
      {
        slug: "jerusalem-jordan-1948-1967",
        statement: "Jordan controlled East Jerusalem from 1948 until 1967.",
        claimType: "HISTORICAL",
        epistemicStatus: "ESTABLISHED",
        sourceRequirement: "Contemporary and authoritative historical records.",
      },
      {
        slug: "jerusalem-israeli-control-since-1967",
        statement: "Israel has exercised control over East Jerusalem since 1967.",
        claimType: "HISTORICAL",
        epistemicStatus: "ESTABLISHED",
        sourceRequirement: "Primary or authoritative historical and legal records.",
      },
      {
        slug: "jerusalem-control-not-automatically-sovereignty",
        statement:
          "Historical administration or present control should not automatically be treated as equivalent to a conclusion about present sovereignty.",
        claimType: "LEGAL",
        epistemicStatus: "CONTEXT_DEPENDENT",
        sourceRequirement: "Relevant legal instruments and competing legal positions.",
      },
    ],
  },
  {
    cardSlug: "replacement-theology",
    claims: [
      {
        slug: "replacement-theology-definition",
        statement:
          "Replacement theology, or supersessionism, refers to theological positions in which the Church is understood to supersede or fulfil Israel's covenantal role.",
        claimType: "THEOLOGICAL",
        epistemicStatus: "ESTABLISHED",
        sourceRequirement: "Primary theological texts plus academic theological scholarship.",
      },
      {
        slug: "replacement-theology-varies-by-tradition",
        statement:
          "Different Christian traditions formulate replacement or supersessionist positions differently.",
        claimType: "THEOLOGICAL",
        epistemicStatus: "ESTABLISHED",
        sourceRequirement: "Comparative theological scholarship and primary doctrinal sources.",
      },
      {
        slug: "replacement-theology-political-consequences",
        statement:
          "Applying a replacement-theology framework to Jewish claims about land, identity, or covenant can have political consequences.",
        claimType: "INTERPRETIVE",
        epistemicStatus: "CONTESTED",
        sourceRequirement: "Specific examples and scholarship connecting doctrine to political claims.",
      },
      {
        slug: "theological-disagreement-vs-antisemitic-claim",
        statement:
          "A theological disagreement is analytically distinct from an antisemitic claim about Jews.",
        claimType: "INTERPRETIVE",
        epistemicStatus: "ESTABLISHED",
        sourceRequirement: "Comparative examples and explicit definitions of antisemitism.",
      },
      {
        slug: "islamic-replacement-not-single-doctrine",
        statement:
          "The draft does not support treating ‘Islamic replacement’ as a single established doctrine.",
        claimType: "THEOLOGICAL",
        epistemicStatus: "OPEN",
        sourceRequirement: "Comparative Islamic theological sources are required before making a stronger proposition.",
      },
    ],
  },
];
