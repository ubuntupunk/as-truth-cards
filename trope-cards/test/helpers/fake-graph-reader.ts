import type {
  ArgumentChainExpansion,
  ArgumentChainMembershipRow,
  ArgumentChainRow,
  CardCollectionRow,
  CardExpansion,
  CardLocaleRow,
  CardConceptRow,
  CardMechanismRow,
  CardRow,
  CardSearchResult,
  ClaimExpansion,
  ClaimRelationRow,
  ClaimRow,
  ClaimSourceRow,
  EvidenceClaimRow,
  EvidenceInferenceRow,
  EvidenceItemExpansion,
  EvidenceItemRow,
  EvidenceSourceRow,
  InferenceConclusionRow,
  InferencePremiseRow,
  InferenceStepExpansion,
  InferenceStepRelationRow,
  InferenceStepRow,
  NodeHydration,
  NodeRefSet,
  RelationshipRow,
  SourceExpansion,
  SourceRow,
  TropeGraphReader,
  ViewPopulation,
} from '../../src/graph/reader'

/**
 * An in-memory {@link TropeGraphReader} for projection tests.
 *
 * The projection is where the six normalisation invariants live, and those invariants are
 * properties of the *shape* of a projection, not of any particular corpus. Asserting them
 * against seeded data would let them pass by luck: the corpus has only 5 `claim_relations`
 * rows and 12 card_concepts links, so a rule about authored claim relations or Concept edges would only
 * ever be exercised on a handful of cases and never on the cases that must be *rejected*.
 *
 * This fake holds a hand-built corpus that contains every case the invariants exist for —
 * including the rows that must be *rejected* — so each invariant is proved against both the
 * accepting and the refusing case. The v0.11 corpus increment added claim relations and
 * sources to the real database, but it did not make the seeded corpus a substitute for this.
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
  over: { cardId: string; slug: string; name?: string; id?: string },
): CardCollectionRow & CardMechanismRow {
  return {
    cardId: over.cardId,
    collectionId: over.id ?? over.slug,
    mechanismId: over.id ?? over.slug,
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
  over: {
    cardId: string
    slug: string
    name?: string
    description?: string | null
    /**
     * Taxonomy id, defaulting to the slug. Passed explicitly when a test needs the same slug
     * to resolve to different ids in different taxonomies, which is what the real seeded
     * corpus does for `south-africa`.
     */
    id?: string
  },
): CardLocaleRow {
  return {
    cardId: over.cardId,
    localeId: over.id ?? over.slug,
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

/** A `sources` bibliography row. */
export function source(over: Partial<SourceRow> & { id: string }): SourceRow {
  return {
    title: `Source ${over.id}`,
    author: null,
    publisher: null,
    citation: null,
    url: null,
    sourceType: 'BOOK',
    ...over,
  }
}

/** A `claim_sources` attribution row: the claim is attributed to the source. */
export function claimSource(
  over: Partial<ClaimSourceRow> & { claimId: string; sourceId: string },
): ClaimSourceRow {
  return {
    relationship: 'ATTRIBUTED_TO',
    quoteOrExcerpt: null,
    pageReference: null,
    notes: null,
    ...over,
  }
}

/** An `evidence_items` row: a located, inspectable portion of a source. */
export function evidenceItem(
  over: Partial<EvidenceItemRow> & { id: string },
): EvidenceItemRow {
  return {
    type: 'QUOTATION',
    title: `Evidence ${over.id}`,
    content: `Evidence ${over.id} content`,
    locator: null,
    evidenceStatus: 'PRIMARY',
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
  cardConcepts: CardConceptRow[]
  cardLocales: CardLocaleRow[]
  argumentChains: ArgumentChainRow[]
  chainMemberships: ArgumentChainMembershipRow[]
  claimRelations: ClaimRelationRow[]
  premises: InferencePremiseRow[]
  conclusions: InferenceConclusionRow[]
  stepRelations: InferenceStepRelationRow[]
  sources: SourceRow[]
  claimSources: ClaimSourceRow[]
  evidenceItems: EvidenceItemRow[]
  evidenceClaims: EvidenceClaimRow[]
  evidenceSources: EvidenceSourceRow[]
  evidenceInferences: EvidenceInferenceRow[]
  population?: Partial<ViewPopulation>
}

/**
 * A `card_concepts` link row.
 *
 * Distinct from `link()` because `CardConceptRow` carries `definition` and the authored
 * `relationship` text that `card_mechanisms` has no column for.
 */
export function conceptLink(
  over: {
    cardId: string
    slug: string
    name?: string
    definition?: string | null
    relationship?: string | null
    id?: string
  },
): CardConceptRow {
  return {
    cardId: over.cardId,
    conceptId: over.id ?? over.slug,
    slug: over.slug,
    name: over.name ?? over.slug,
    definition: over.definition ?? null,
    relationship: over.relationship === undefined ? null : over.relationship,
  }
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
    cardConcepts: [],
    cardLocales: [],
    argumentChains: [],
    chainMemberships: [],
    claimRelations: [],
    premises: [],
    conclusions: [],
    stepRelations: [],
    sources: [],
    claimSources: [],
    evidenceItems: [],
    evidenceClaims: [],
    evidenceSources: [],
    evidenceInferences: [],
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
    cardMechanisms: [
      link({ cardId: 'card-1', slug: 'name-slur', name: 'Name slur' }),
      // Same slug *and* same name as the `zionism` Concept below, in a different table with its
      // own id. The sharpest form of the inference decoy: if Concept membership were ever derived
      // from a Mechanism's subject, card-2 would gain a Concept node it has no authored row for.
      link({ cardId: 'card-2', id: 'mechanism-zionism', slug: 'zionism', name: 'Zionism' }),
    ],
    // Concept decoys, all deliberate:
    //  - `zionism` here is a CONCEPT row sharing a slug with the SUIT in cardCollections. Real
    //    taxonomies are separate tables with independently generated uuids, so the concept gets
    //    its own `id`. Same slug, different node: the point is that the Concept edge comes from
    //    the `card_concepts` row and never from the Suit, and that identical slugs across two
    //    taxonomies stay distinct nodes.
    //  - `anti-zionism` is linked to card-3, whose only claim-free distinction is that no other
    //    card references it, so it must still be reachable while never appearing as a node for a
    //    card with no authored row.
    cardConcepts: [
      conceptLink({
        cardId: 'card-1',
        id: 'concept-zionism',
        slug: 'zionism',
        name: 'Zionism',
        definition: 'The Jewish settlement movement in Palestine.',
        relationship: 'The card is about the movement itself.',
      }),
      conceptLink({
        cardId: 'card-3',
        id: 'concept-anti-zionism',
        slug: 'anti-zionism',
        name: 'Anti-Zionism',
      }),
    ],
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
    // A bibliography row with no attribution join rows: the sources table has rows, so a view
    // declaring `source` reports no population gap, but nothing reaches this source in a
    // projection until a `claim_sources` row points at it. Dedicated source tests build their
    // own corpus rather than perturbing the node and edge counts every other test asserts.
    sources: [source({ id: 'source-1' })],
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

  async findClaimByRef(ref: string): Promise<ClaimRow | undefined> {
    // Claims carry no slug — in the corpus or the schema — so uuid is the only identity.
    return this.corpus.claims.find((c) => c.id === ref)
  }

  async findArgumentChainByRef(ref: string): Promise<ArgumentChainRow | undefined> {
    // Like claims: uuid-only, and a non-matching reference short-circuits to undefined.
    return this.corpus.argumentChains.find((c) => c.id === ref)
  }

  async findSourceByRef(ref: string): Promise<SourceRow | undefined> {
    // Sources carry no slug — uuid is the only identity.
    return this.corpus.sources.find((s) => s.id === ref)
  }

  async findEvidenceItemByRef(ref: string): Promise<EvidenceItemRow | undefined> {
    // Like sources: uuid-only.
    return this.corpus.evidenceItems.find((e) => e.id === ref)
  }

  async searchCards(query: string, limit: number): Promise<CardSearchResult[]> {
    const term = query.trim().toLowerCase()
    if (term.length === 0) return []
    // A stand-in for the real reader's ranked FTS + trigram: title/slug are the strongest
    // signal, summary next, core question weakest. Rank is the highest matching tier, so a
    // title hit always sorts above a summary-only hit.
    return this.corpus.cards
      .map((card) => {
        const fields = [
          [card.title, 3],
          [card.slug, 3],
          [card.summary ?? '', 2],
          [card.coreQuestion ?? '', 1],
        ] as const
        let rank = 0
        for (const [value, weight] of fields) {
          if (value.toLowerCase().includes(term)) rank = Math.max(rank, weight)
        }
        return {
          id: card.id,
          slug: card.slug,
          title: card.title,
          summary: card.summary,
          rank,
        }
      })
      .filter((result) => result.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
      .slice(0, limit)
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
      cardConcepts: this.corpus.cardConcepts.filter((c) => ids.has(c.cardId)),
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
      claimSources: this.corpus.claimSources.filter((cs) => ids.has(cs.claimId)),
      evidenceClaims: this.corpus.evidenceClaims.filter((ec) =>
        ids.has(ec.claimId),
      ),
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
      premises: this.corpus.premises.filter((p) =>
        ids.has(p.inferenceStepId),
      ),
      conclusions: this.corpus.conclusions.filter((c) =>
        ids.has(c.inferenceStepId),
      ),
      chainMemberships: this.corpus.chainMemberships.filter((m) =>
        ids.has(m.inferenceStepId),
      ),
      declaredChainLinks: this.corpus.inferenceSteps
        .filter((s) => ids.has(s.id) && s.argumentChainId)
        .map((s) => ({ stepId: s.id, chainId: s.argumentChainId as string })),
      evidenceInferences: this.corpus.evidenceInferences.filter((ei) =>
        ids.has(ei.inferenceId),
      ),
    }
  }

  async expandChains(
    chainIds: readonly string[],
  ): Promise<ArgumentChainExpansion> {
    this.calls.push(...chainIds)
    const ids = new Set(chainIds)
    return {
      chainMemberships: this.corpus.chainMemberships.filter((m) =>
        ids.has(m.chainId),
      ),
    }
  }

  async expandSources(sourceIds: readonly string[]): Promise<SourceExpansion> {
    this.calls.push(...sourceIds)
    const ids = new Set(sourceIds)
    return {
      claimSources: this.corpus.claimSources.filter((cs) =>
        ids.has(cs.sourceId),
      ),
      evidenceSources: this.corpus.evidenceSources.filter((es) =>
        ids.has(es.sourceId),
      ),
    }
  }

  async expandEvidenceItems(
    evidenceIds: readonly string[],
  ): Promise<EvidenceItemExpansion> {
    this.calls.push(...evidenceIds)
    const ids = new Set(evidenceIds)
    return {
      evidenceClaims: this.corpus.evidenceClaims.filter((ec) =>
        ids.has(ec.evidenceId),
      ),
      evidenceSources: this.corpus.evidenceSources.filter((es) =>
        ids.has(es.evidenceId),
      ),
      evidenceInferences: this.corpus.evidenceInferences.filter((ei) =>
        ids.has(ei.evidenceId),
      ),
    }
  }

  async hydrate(refs: NodeRefSet): Promise<NodeHydration> {
    const cardIds = new Set(refs.cardIds)
    const claimIds = new Set(refs.claimIds)
    const stepIds = new Set(refs.inferenceStepIds)
    const collectionIds = new Set(refs.collectionIds)
    const mechanismIds = new Set(refs.mechanismIds)
    const conceptIds = new Set(refs.conceptIds)
    // Chains can now be discovered nodes in their own right (a chain-led focus, or a chain
    // reached over a MEMBER_OF edge), and the same two attachment paths the Drizzle reader
    // reads still apply as fallbacks for chains reached only through a step.
    const refChainIds = new Set(refs.chainIds)
    const chainIds = new Set([
      ...refChainIds,
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
      cardConcepts: this.corpus.cardConcepts.filter((c) =>
        conceptIds.has(c.conceptId),
      ),
      cardLocales: this.corpus.cardLocales.filter((l) => cardIds.has(l.cardId)),
      claims: this.corpus.claims.filter((c) => claimIds.has(c.id)),
      inferenceSteps: this.corpus.inferenceSteps.filter((s) => stepIds.has(s.id)),
      chains: this.corpus.argumentChains.filter((c) => chainIds.has(c.id)),
      chainMemberships: this.corpus.chainMemberships.filter(
        (m) => stepIds.has(m.inferenceStepId) || refChainIds.has(m.chainId),
      ),
      premises: this.corpus.premises.filter((p) => stepIds.has(p.inferenceStepId)),
      conclusions: this.corpus.conclusions.filter((c) =>
        stepIds.has(c.inferenceStepId),
      ),
      sources: this.corpus.sources.filter((s) =>
        new Set(refs.sourceIds).has(s.id),
      ),
      evidenceItems: this.corpus.evidenceItems.filter((e) =>
        new Set(refs.evidenceIds).has(e.id),
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
      sources: this.corpus.sources.length,
      evidenceItems: this.corpus.evidenceItems.length,
      cases: 0,
      interpretations: 0,
      questions: 0,
      argumentChains: this.corpus.argumentChains.length,
      claimRelations: this.corpus.claimRelations.length,
      claimSources: this.corpus.claimSources.length,
      ...over,
    }
  }

  async listCards(params: {
    localeSlug?: string
    limit?: number
    offset?: number
  } = {}): Promise<{ items: readonly CardRow[]; total: number }> {
    let items = this.corpus.cards.slice()
    if (params.localeSlug) {
      const cardIdsInLocale = new Set(
        this.corpus.cardLocales
          .filter((l) => l.slug === params.localeSlug)
          .map((l) => l.cardId),
      )
      items = items.filter((c) => cardIdsInLocale.has(c.id))
    }
    // Sorted by title so paging is order-stable, matching the Drizzle reader's `ORDER BY title`.
    items = items.sort((a, b) => a.title.localeCompare(b.title))
    const total = items.length
    const offset = params.offset ?? 0
    const limit = params.limit ?? 50
    const sliced = items.slice(offset, offset + limit)
    return { items: sliced, total }
  }

  async listSources(params: {
    limit?: number
    offset?: number
  } = {}): Promise<{
    items: readonly (SourceRow & { claimSourceCount: number })[]
    total: number
  }> {
    const claimSourceCounts = new Map<string, number>()
    for (const cs of this.corpus.claimSources) {
      claimSourceCounts.set(cs.sourceId, (claimSourceCounts.get(cs.sourceId) ?? 0) + 1)
    }
    const items = this.corpus.sources
      .map((s) => ({
        ...s,
        claimSourceCount: claimSourceCounts.get(s.id) ?? 0,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
    const total = items.length
    const offset = params.offset ?? 0
    const limit = params.limit ?? 50
    const sliced = items.slice(offset, offset + limit)
    return { items: sliced, total }
  }
}
