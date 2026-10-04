import type {
  ArgumentChainMembershipRow,
  ArgumentChainRow,
  CardCollectionRow,
  CardExpansion,
  CardLocaleRow,
  CardMechanismRow,
  CardRow,
  ClaimExpansion,
  ClaimRelationRow,
  ClaimRow,
  InferenceConclusionRow,
  InferencePremiseRow,
  InferenceStepExpansion,
  InferenceStepRelationRow,
  InferenceStepRow,
  NodeHydration,
  NodeRefSet,
  RelationshipRow,
  TropeGraphReader,
  ViewPopulation,
} from '../../src/graph/reader'

/**
 * An in-memory {@link TropeGraphReader} for projection tests.
 *
 * The projection is where the six normalisation invariants live, and those invariants are
 * properties of the *shape* of a projection, not of any particular corpus. Asserting them
 * against seeded data would let them pass by luck: the corpus has 0 `claim_relations` rows and
 * 6 concepts, so a rule about authored claim relations would never be exercised.
 *
 * This fake holds a hand-built corpus that contains every case the invariants exist for —
 * including the rows that must be *rejected* — so each invariant is proved against both the
 * accepting and the refusing case.
 */

/** A card row, with only the fields the projection reads. */
export function card(over: Partial<CardRow> & { id: string }): CardRow {
  return {
    slug: over.id,
    title: `Card ${over.id}`,
    summary: null,
    coreQuestion: null,
    primaryType: 'CASE',
    epistemicStatus: 'ESTABLISHED',
    ...over,
  }
}

/** A claim row. */
export function claim(over: Partial<ClaimRow> & { id: string }): ClaimRow {
  return {
    cardId: 'card-1',
    statement: `Claim ${over.id}`,
    claimType: 'DESCRIPTIVE',
    description: null,
    epistemicStatus: 'ESTABLISHED',
    ...over,
  }
}

/** An inference step row. */
export function step(over: Partial<InferenceStepRow> & { id: string }): InferenceStepRow {
  return {
    cardId: 'card-1',
    label: `Step ${over.id}`,
    description: `Step ${over.id} described`,
    inferenceType: 'ABDUCTIVE',
    epistemicStatus: '',
    notes: null,
    isCanonical: true,
    argumentChainId: null,
    ...over,
  }
}

/** A classification link row, for either collections or mechanisms. */
export function link(
  over: { cardId: string; slug: string; name?: string },
): CardCollectionRow & CardMechanismRow {
  return {
    cardId: over.cardId,
    collectionId: over.slug,
    mechanismId: over.slug,
    slug: over.slug,
    name: over.name ?? over.slug,
    description: null,
  }
}

/**
 * A `card_locales` link row.
 *
 * Locale is a separate taxonomy from collections and mechanisms, so it gets its own helper
 * rather than reusing {@link link}: the link row spells its taxonomy id `localeId`, and a card
 * may carry several locales while the other dimensions are single-valued.
 */
export function localeLink(
  over: { cardId: string; slug: string; name?: string; description?: string | null },
): CardLocaleRow {
  return {
    cardId: over.cardId,
    localeId: over.slug,
    slug: over.slug,
    name: over.name ?? over.slug,
    description: over.description ?? null,
  }
}

/** An argument chain row. */
export function chain(
  over: Partial<ArgumentChainRow> & { id: string },
): ArgumentChainRow {
  return {
    cardId: 'card-1',
    label: `Chain ${over.id}`,
    description: `Chain ${over.id} described`,
    kind: 'PRIMARY_ARGUMENT',
    epistemicStatus: '',
    ...over,
  }
}

/** A chain membership row. */
export function membership(
  over: Partial<ArgumentChainMembershipRow> & { inferenceStepId: string },
): ArgumentChainMembershipRow {
  return {
    chainId: 'chain-1',
    role: 'MAIN',
    ordinal: 0,
    label: 'Chain 1',
    description: 'Chain 1 described',
    kind: 'PRIMARY_ARGUMENT',
    ...over,
  }
}

/** A `relationships` row. */
export function relationship(
  over: Partial<RelationshipRow> & { id: string },
): RelationshipRow {
  return {
    fromEntityType: 'CARD',
    fromEntityId: 'card-1',
    relationshipType: 'RELATED',
    toEntityType: 'CARD',
    toEntityId: 'card-2',
    description: null,
    status: 'CANONICAL',
    ...over,
  }
}

/** An authored `claim_relations` row. */
export function claimRelation(
  over: Partial<ClaimRelationRow> & { id: string },
): ClaimRelationRow {
  return {
    sourceClaimId: 'claim-1',
    targetClaimId: 'claim-2',
    relationType: 'SUPPORTS',
    description: null,
    ...over,
  }
}

/** The corpus a fake reader serves. */
export type FakeCorpus = {
  cards: CardRow[]
  claims: ClaimRow[]
  inferenceSteps: InferenceStepRow[]
  cardRelationships: RelationshipRow[]
  cardCollections: CardCollectionRow[]
  cardMechanisms: CardMechanismRow[]
  cardLocales: CardLocaleRow[]
  argumentChains: ArgumentChainRow[]
  chainMemberships: ArgumentChainMembershipRow[]
  claimRelations: ClaimRelationRow[]
  premises: InferencePremiseRow[]
  conclusions: InferenceConclusionRow[]
  stepRelations: InferenceStepRelationRow[]
  population?: Partial<ViewPopulation>
}

/** A corpus with nothing in it, so each test states only the rows it cares about. */
export function emptyCorpus(): FakeCorpus {
  return {
    cards: [],
    claims: [],
    inferenceSteps: [],
    cardRelationships: [],
    cardCollections: [],
    cardMechanisms: [],
    cardLocales: [],
    argumentChains: [],
    chainMemberships: [],
    claimRelations: [],
    premises: [],
    conclusions: [],
    stepRelations: [],
  }
}

/** A three-card corpus exercising claims, inference, classification, chains and card links. */
export function richCorpus(): FakeCorpus {
  return {
    ...emptyCorpus(),
    cards: [
      card({ id: 'card-1', slug: 'jesus-was-a-zionist' }),
      card({ id: 'card-2', slug: 'zionism-as-political-project' }),
      card({ id: 'card-3', slug: 'unrelated-card' }),
    ],
    claims: [
      claim({ id: 'claim-1', cardId: 'card-1', statement: 'Jesus was a Zionist' }),
      claim({
        id: 'claim-2',
        cardId: 'card-1',
        statement: 'The movement existed',
        claimType: 'HISTORICAL',
        epistemicStatus: 'CONTESTED',
      }),
      claim({ id: 'claim-3', cardId: 'card-1', statement: 'A consequence' }),
    ],
    inferenceSteps: [
      step({ id: 'step-1', cardId: 'card-1', label: 'From movement to teacher' }),
      step({ id: 'step-2', cardId: 'card-1', label: 'Hence Zionist' }),
      step({ id: 'step-9', cardId: 'card-2', label: 'Belongs to another card' }),
    ],
    cardRelationships: [
      relationship({ id: 'rel-1' }),
      // A `PROPOSED` row and its `CANONICAL` replacement share a typed pair, so the two must
      // not collapse onto one edge id.
      relationship({ id: 'rel-2', status: 'PROPOSED', description: 'unconfirmed' }),
    ],
    cardCollections: [link({ cardId: 'card-1', slug: 'zionism', name: 'Zionism' })],
    cardMechanisms: [link({ cardId: 'card-1', slug: 'name-slur', name: 'Name slur' })],
    // Two locales on one card, and a third card with a locale but no collection. Locale must
    // survive independently of the other dimensions in both directions.
    cardLocales: [
      localeLink({ cardId: 'card-1', slug: 'south-africa', name: 'South Africa' }),
      localeLink({ cardId: 'card-1', slug: 'israel', name: 'Israel' }),
      localeLink({ cardId: 'card-3', slug: 'south-africa', name: 'South Africa' }),
    ],
    argumentChains: [chain({ id: 'chain-1', label: 'Primary case' })],
    chainMemberships: [
      membership({ inferenceStepId: 'step-1', ordinal: 0, role: 'MAIN' }),
      membership({ inferenceStepId: 'step-2', ordinal: 1, role: 'ALTERNATIVE' }),
    ],
    // Authored, not derived: `step-2` concludes `claim-2` even though no premise row pairs
    // them. A projection that inferred SUPPORTS here would be wrong.
    conclusions: [
      { inferenceStepId: 'step-1', claimId: 'claim-1', ordinal: 0 },
      { inferenceStepId: 'step-2', claimId: 'claim-2', ordinal: 0 },
      { inferenceStepId: 'step-2', claimId: 'claim-3', ordinal: 0 },
    ],
    premises: [{ inferenceStepId: 'step-1', claimId: 'claim-1', role: 'PRIMARY', ordinal: 0 }],
    claimRelations: [
      claimRelation({ id: 'cr-1', sourceClaimId: 'claim-1', targetClaimId: 'claim-2' }),
    ],
  }
}

/**
 * A reader over a fixed corpus.
 *
 * Rows are filtered by the ids the BFS asks about, so the fake behaves like the real reader
 * from the projection's point of view: the projection cannot reach a row it did not query for.
 */
export class FakeGraphReader implements TropeGraphReader {
  constructor(private readonly corpus: FakeCorpus = emptyCorpus()) {}

  /** Ids the BFS asked about, in order, so tests can assert what was expanded. */
  readonly calls: string[] = []

  async findCardByRef(ref: string): Promise<CardRow | undefined> {
    return this.corpus.cards.find((c) => c.id === ref || c.slug === ref)
  }

  async expandCards(cardIds: readonly string[]): Promise<CardExpansion> {
    this.calls.push(...cardIds)
    const ids = new Set(cardIds)
    const stepRows = this.corpus.inferenceSteps.filter((s) => ids.has(s.cardId))
    const stepIds = new Set(stepRows.map((s) => s.id))
    return {
      claims: this.corpus.claims.filter((c) => ids.has(c.cardId)),
      inferenceSteps: stepRows,
      cardRelationships: this.corpus.cardRelationships.filter(
        (r) =>
          (r.fromEntityType === 'CARD' && ids.has(r.fromEntityId)) ||
          (r.toEntityType === 'CARD' && ids.has(r.toEntityId)),
      ),
      cardCollections: this.corpus.cardCollections.filter((c) => ids.has(c.cardId)),
      cardMechanisms: this.corpus.cardMechanisms.filter((c) => ids.has(c.cardId)),
      cardLocales: this.corpus.cardLocales.filter((l) => ids.has(l.cardId)),
      argumentChains: this.corpus.argumentChains.filter((c) => ids.has(c.cardId)),
      chainMemberships: this.corpus.chainMemberships.filter((m) =>
        stepIds.has(m.inferenceStepId),
      ),
    }
  }

  async expandClaims(claimIds: readonly string[]): Promise<ClaimExpansion> {
    this.calls.push(...claimIds)
    const ids = new Set(claimIds)
    const premises = this.corpus.premises.filter((p) => ids.has(p.claimId))
    const conclusions = this.corpus.conclusions.filter((c) => ids.has(c.claimId))
    const stepIds = new Set([
      ...premises.map((p) => p.inferenceStepId),
      ...conclusions.map((c) => c.inferenceStepId),
    ])
    return {
      claimRelations: this.corpus.claimRelations.filter(
        (r) => ids.has(r.sourceClaimId) || ids.has(r.targetClaimId),
      ),
      inferenceSteps: this.corpus.inferenceSteps.filter((s) => stepIds.has(s.id)),
      premises,
      conclusions,
    }
  }

  async expandInferenceSteps(
    inferenceStepIds: readonly string[],
  ): Promise<InferenceStepExpansion> {
    this.calls.push(...inferenceStepIds)
    const ids = new Set(inferenceStepIds)
    return {
      stepRelations: this.corpus.stepRelations.filter(
        (r) =>
          ids.has(r.sourceInferenceStepId) || ids.has(r.targetInferenceStepId),
      ),
    }
  }

  async hydrate(refs: NodeRefSet): Promise<NodeHydration> {
    const cardIds = new Set(refs.cardIds)
    const claimIds = new Set(refs.claimIds)
    const stepIds = new Set(refs.inferenceStepIds)
    const collectionIds = new Set(refs.collectionIds)
    const mechanismIds = new Set(refs.mechanismIds)
    // Chains are reached through membership on a discovered step, or through a step's own
    // `argument_chain_id`. `NodeRefSet` carries no chain ids, so the fake resolves them here
    // the same way the Drizzle reader does.
    const chainIds = new Set([
      ...this.corpus.chainMemberships
        .filter((m) => stepIds.has(m.inferenceStepId))
        .map((m) => m.chainId),
      ...this.corpus.inferenceSteps
        .filter((s) => stepIds.has(s.id) && s.argumentChainId)
        .map((s) => s.argumentChainId as string),
    ])
    return {
      cards: this.corpus.cards.filter((c) => cardIds.has(c.id)),
      cardAxes: [],
      cardCollections: this.corpus.cardCollections.filter((c) =>
        collectionIds.has(c.collectionId),
      ),
      cardMechanisms: this.corpus.cardMechanisms.filter((m) =>
        mechanismIds.has(m.mechanismId),
      ),
      cardLocales: this.corpus.cardLocales.filter((l) => cardIds.has(l.cardId)),
      claims: this.corpus.claims.filter((c) => claimIds.has(c.id)),
      inferenceSteps: this.corpus.inferenceSteps.filter((s) => stepIds.has(s.id)),
      chains: this.corpus.argumentChains.filter((c) => chainIds.has(c.id)),
      chainMemberships: this.corpus.chainMemberships.filter((m) =>
        stepIds.has(m.inferenceStepId),
      ),
      premises: this.corpus.premises.filter((p) => stepIds.has(p.inferenceStepId)),
      conclusions: this.corpus.conclusions.filter((c) =>
        stepIds.has(c.inferenceStepId),
      ),
    }
  }

  async readPopulation(): Promise<ViewPopulation> {
    const over = this.corpus.population ?? {}
    return {
      cards: this.corpus.cards.length,
      claims: this.corpus.claims.length,
      inferenceSteps: this.corpus.inferenceSteps.length,
      relationships: this.corpus.cardRelationships.length,
      collections: new Set(
        this.corpus.cardCollections.map((c) => c.collectionId),
      ).size,
      mechanisms: new Set(this.corpus.cardMechanisms.map((m) => m.mechanismId)).size,
      locales: new Set(this.corpus.cardLocales.map((l) => l.localeId)).size,
      cardLocales: this.corpus.cardLocales.length,
      concepts: 0,
      cardConcepts: 0,
      sources: 0,
      evidenceItems: 0,
      cases: 0,
      interpretations: 0,
      questions: 0,
      argumentChains: this.corpus.argumentChains.length,
      claimRelations: this.corpus.claimRelations.length,
      ...over,
    }
  }
}
