/**
 * The Drizzle-backed {@link TropeGraphReader}.
 *
 * Every query here is a read. Nothing in this file writes, and nothing reads outside the
 * `trope_graph` schema — `public.cards` is the transitional Prisma deck model and issue #3 Q8
 * forbids the projection from bridging to it or reviving it as canonical. If a future query
 * needs that bridge, it should be the explicit bridge column the note in `schema/namespace.ts`
 * calls for, not a join invented here.
 *
 * The schema declares no Drizzle `relations()`, so every query is an explicit
 * select/join rather than a relational `with: {}` fetch. That is deliberate: a relational fetch
 * would hide which columns the projection actually reads, and "which columns feed the graph" is
 * a question the ontology has to be able to answer.
 *
 * Each reader method covers exactly one breadth-first round and nothing more. A card round does
 * not also fetch the claims' inference steps, because the claim round that follows will
 * discover them — fetching them here would duplicate work and would give the projection two
 * paths to the same rows.
 */

import { and, eq, inArray, or, sql } from 'drizzle-orm'

import { getDb } from '../db/client'
import {
  argumentChainSteps,
  argumentChains,
  inferenceStepRelations,
} from '../db/schema/argumentChains'
import {
  claimRelations,
  inferenceConclusions,
  inferencePremises,
  inferenceSteps,
} from '../db/schema/claimDecomposition'
import {
  cardAxes,
  cardCollections,
  cardConcepts,
  cardLocales,
  cardMechanisms,
  cards,
  claims,
  collections,
  concepts,
  locales,
  mechanisms,
  relationships,
} from '../db/schema/tropeGraph'
import type {
  ArgumentChainMembershipRow,
  ArgumentChainRow,
  CardCollectionRow,
  CardConceptRow,
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
} from './reader'

/** The columns the projection reads from `cards`. */
const cardColumns = {
  id: cards.id,
  slug: cards.slug,
  title: cards.title,
  summary: cards.summary,
  coreQuestion: cards.coreQuestion,
  /**
   * Legacy, write-only content-shape classification. Read only to report it verbatim as
   * `CardNodeMetadata.legacyPrimaryType`; never used for axis (Issue #2, Q3).
   */
  primaryType: cards.primaryType,
  epistemicStatus: cards.epistemicStatus,
}

/** The columns the projection reads from `claims`. */
const claimColumns = {
  id: claims.id,
  cardId: claims.cardId,
  statement: claims.statement,
  claimType: claims.claimType,
  description: claims.description,
  epistemicStatus: claims.epistemicStatus,
}

/** The columns the projection reads from `inference_steps`. */
const stepColumns = {
  id: inferenceSteps.id,
  cardId: inferenceSteps.cardId,
  label: inferenceSteps.label,
  description: inferenceSteps.description,
  inferenceType: inferenceSteps.inferenceType,
  // Free `text` in the schema, projected as an uncontrolled independent status (Q4).
  epistemicStatus: inferenceSteps.epistemicStatus,
  notes: inferenceSteps.notes,
  isCanonical: inferenceSteps.isCanonical,
  argumentChainId: inferenceSteps.argumentChainId,
}

/** The columns the projection reads from `claim_relations`. */
const claimRelationColumns = {
  id: claimRelations.id,
  sourceClaimId: claimRelations.sourceClaimId,
  targetClaimId: claimRelations.targetClaimId,
  relationType: claimRelations.relationType,
  description: claimRelations.description,
}

/** The columns the projection reads from `relationships`. */
const relationshipColumns = {
  id: relationships.id,
  fromEntityType: relationships.fromEntityType,
  fromEntityId: relationships.fromEntityId,
  relationshipType: relationships.relationshipType,
  toEntityType: relationships.toEntityType,
  toEntityId: relationships.toEntityId,
  description: relationships.description,
  status: relationships.status,
}

/** The columns a `card_collections` -> `collections` join projects. */
const cardCollectionColumns = {
  cardId: cardCollections.cardId,
  collectionId: collections.id,
  slug: collections.slug,
  name: collections.name,
  description: collections.description,
}

/** The columns a `card_mechanisms` -> `mechanisms` join projects. */
const cardMechanismColumns = {
  cardId: cardMechanisms.cardId,
  mechanismId: mechanisms.id,
  slug: mechanisms.slug,
  name: mechanisms.name,
  description: mechanisms.description,
}

/**
 * The columns a `card_concepts` -> `concepts` join projects.
 *
 * `relationship` comes from the join table, not from `concepts`, and is passed through as-is.
 */
const cardConceptColumns = {
  cardId: cardConcepts.cardId,
  conceptId: concepts.id,
  slug: concepts.slug,
  name: concepts.name,
  definition: concepts.definition,
  relationship: cardConcepts.relationship,
}

/** The columns a `card_locales` -> `locales` join projects. */
const cardLocaleColumns = {
  cardId: cardLocales.cardId,
  localeId: locales.id,
  slug: locales.slug,
  name: locales.name,
  description: locales.description,
}

/** The columns an `argument_chain_steps` -> `argument_chains` join projects. */
const chainMembershipColumns = {
  chainId: argumentChains.id,
  inferenceStepId: argumentChainSteps.inferenceStepId,
  role: argumentChainSteps.role,
  ordinal: argumentChainSteps.ordinal,
  label: argumentChains.label,
  description: argumentChains.description,
  kind: argumentChains.kind,
}

/** The columns the projection reads from `argument_chains`. */
const chainColumns = {
  id: argumentChains.id,
  cardId: argumentChains.cardId,
  label: argumentChains.label,
  description: argumentChains.description,
  kind: argumentChains.kind,
  // Free `text`, independent of claim status (Q4).
  epistemicStatus: argumentChains.epistemicStatus,
}

/** The columns the projection reads from `inference_premises`. */
const premiseColumns = {
  inferenceStepId: inferencePremises.inferenceStepId,
  claimId: inferencePremises.claimId,
  role: inferencePremises.role,
  ordinal: inferencePremises.ordinal,
}

/** The columns the projection reads from `inference_conclusions`. */
const conclusionColumns = {
  inferenceStepId: inferenceConclusions.inferenceStepId,
  claimId: inferenceConclusions.claimId,
  ordinal: inferenceConclusions.ordinal,
}

/** The columns the projection reads from `inference_step_relations`. */
const stepRelationColumns = {
  sourceInferenceStepId: inferenceStepRelations.sourceInferenceStepId,
  targetInferenceStepId: inferenceStepRelations.targetInferenceStepId,
  relationType: inferenceStepRelations.relationType,
  description: inferenceStepRelations.description,
}

/** Whether a focus reference is a uuid rather than a slug (Q7). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A Drizzle reader over `trope_graph`.
 *
 * Takes the shared client from `db/client.ts` by default so the Express host and the
 * integration test share one pool. The client may be narrowed by a caller, but it must be a
 * read path: this class never calls an insert, update, or delete.
 */
export class DrizzleGraphReader implements TropeGraphReader {
  /**
   * @param client Drizzle client. Resolved from `db/client.ts` on first use, so importing this
   * module never requires a configured connection string.
   */
  constructor(private readonly client: ReturnType<typeof getDb> = getDb()) {}

  /**
   * Resolve a card by slug or uuid (Q7).
   *
   * Both are accepted because a slug is a human-facing alias and a uuid is canonical identity,
   * neither derived from the other. The uuid branch is tried first and the slug branch is a
   * fallback, so a stored slug that happens to be uuid-shaped cannot shadow a real uuid.
   *
   * @param ref A card slug or uuid.
   * @returns The card row, or `undefined` when nothing matches.
   * @example
   * ```ts
   * const bySlug = await reader.findCardByRef("jesus-was-a-zionist");
   * const byUuid = await reader.findCardByRef(bySlug!.id);
   * bySlug!.id === byUuid!.id; // true
   * ```
   */
  async findCardByRef(ref: string): Promise<CardRow | undefined> {
    const value = ref.trim()
    if (value.length === 0) return undefined
    const rows = await this.client
      .select(cardColumns)
      .from(cards)
      .where(
        UUID_PATTERN.test(value) ? eq(cards.id, value) : eq(cards.slug, value),
      )
      .limit(1)
    return rows[0]
  }

  /**
   * Discover everything one round of card ids touches.
   *
   * @param cardIds Cards on the current frontier.
   * @returns The claims they assert, the steps they own, their relationships, classification
   * links, chains and chain memberships.
   */
  async expandCards(cardIds: readonly string[]): Promise<CardExpansion> {
    if (cardIds.length === 0) return emptyCardExpansion()
    const ids = [...cardIds]

    const [
      claimRows,
      stepRows,
      relationshipRows,
      collectionRows,
      mechanismRows,
      conceptRows,
      cardLocaleRows,
      chainRows,
    ] = await Promise.all([
      this.client
        .select(claimColumns)
        .from(claims)
        .where(inArray(claims.cardId, ids)),
      this.client
        .select(stepColumns)
        .from(inferenceSteps)
        .where(inArray(inferenceSteps.cardId, ids)),
      this.client
        .select(relationshipColumns)
        .from(relationships)
        .where(
          or(
            and(
              eq(relationships.fromEntityType, CARD_ENTITY_TYPE),
              inArray(relationships.fromEntityId, ids),
            ),
            and(
              eq(relationships.toEntityType, CARD_ENTITY_TYPE),
              inArray(relationships.toEntityId, ids),
            ),
          ),
        ),
      this.client
        .select(cardCollectionColumns)
        .from(cardCollections)
        .innerJoin(
          collections,
          eq(cardCollections.collectionId, collections.id),
        )
        .where(inArray(cardCollections.cardId, ids)),
      this.client
        .select(cardMechanismColumns)
        .from(cardMechanisms)
        .innerJoin(mechanisms, eq(cardMechanisms.mechanismId, mechanisms.id))
        .where(inArray(cardMechanisms.cardId, ids)),
      this.client
        .select(cardConceptColumns)
        .from(cardConcepts)
        .innerJoin(concepts, eq(cardConcepts.conceptId, concepts.id))
        .where(inArray(cardConcepts.cardId, ids)),
      this.client
        .select(cardLocaleColumns)
        .from(cardLocales)
        .innerJoin(locales, eq(cardLocales.localeId, locales.id))
        .where(inArray(cardLocales.cardId, ids)),
      this.client
        .select(chainColumns)
        .from(argumentChains)
        .where(inArray(argumentChains.cardId, ids)),
    ])

    const stepIds = stepRows.map((step) => step.id)
    const membershipRows =
      stepIds.length === 0
        ? []
        : await this.client
            .select(chainMembershipColumns)
            .from(argumentChainSteps)
            .innerJoin(
              argumentChains,
              eq(argumentChainSteps.argumentChainId, argumentChains.id),
            )
            .where(inArray(argumentChainSteps.inferenceStepId, stepIds))

    return {
      claims: claimRows,
      inferenceSteps: stepRows,
      cardRelationships: relationshipRows,
      cardCollections: collectionRows,
      cardMechanisms: mechanismRows,
      cardConcepts: conceptRows,
      cardLocales: cardLocaleRows,
      argumentChains: chainRows,
      chainMemberships: membershipRows,
    }
  }

  /**
   * Discover everything one round of claim ids touches.
   *
   * `claim_relations` is read here and only here, and never derived from the premises and
   * conclusions read alongside it. A claim whose step concludes another claim produces a
   * `CONCLUDES` edge and no `SUPPORTS` edge unless someone authored the relation (Q1).
   *
   * @param claimIds Claims on the current frontier.
   */
  async expandClaims(claimIds: readonly string[]): Promise<ClaimExpansion> {
    if (claimIds.length === 0) {
      return {
        claimRelations: [],
        inferenceSteps: [],
        premises: [],
        conclusions: [],
      }
    }
    const ids = [...claimIds]

    const [relationRows, premiseRows, conclusionRows] = await Promise.all([
      this.client
        .select(claimRelationColumns)
        .from(claimRelations)
        .where(
          or(
            inArray(claimRelations.sourceClaimId, ids),
            inArray(claimRelations.targetClaimId, ids),
          ),
        ),
      this.client
        .select(premiseColumns)
        .from(inferencePremises)
        .where(inArray(inferencePremises.claimId, ids)),
      this.client
        .select(conclusionColumns)
        .from(inferenceConclusions)
        .where(inArray(inferenceConclusions.claimId, ids)),
    ])

    const stepIds = dedupe([
      ...premiseRows.map((row) => row.inferenceStepId),
      ...conclusionRows.map((row) => row.inferenceStepId),
    ])
    const stepRows =
      stepIds.length === 0
        ? []
        : await this.client
            .select(stepColumns)
            .from(inferenceSteps)
            .where(inArray(inferenceSteps.id, stepIds))

    return {
      claimRelations: relationRows,
      inferenceSteps: stepRows,
      premises: premiseRows,
      conclusions: conclusionRows,
    }
  }

  /**
   * Discover the step-to-step relations leaving a round of inference steps.
   *
   * @param inferenceStepIds Steps on the current frontier.
   */
  async expandInferenceSteps(
    inferenceStepIds: readonly string[],
  ): Promise<InferenceStepExpansion> {
    if (inferenceStepIds.length === 0) return { stepRelations: [] }
    const ids = [...inferenceStepIds]
    const stepRelations = await this.client
      .select(stepRelationColumns)
      .from(inferenceStepRelations)
      .where(
        or(
          inArray(inferenceStepRelations.sourceInferenceStepId, ids),
          inArray(inferenceStepRelations.targetInferenceStepId, ids),
        ),
      )
    return { stepRelations }
  }

  /**
   * Hydrate every discovered node reference with its typed metadata rows.
   *
   * Classification joins are re-read here rather than cached from the round that discovered the
   * ids, so a node that entered the projection as an id always arrives with the same rows a
   * card-focused request would see. The projection is computed per request and never cached
   * (Q10), so there is nothing to reuse anyway.
   *
   * @param refs Typed id lists collected by the BFS.
   */
  async hydrate(refs: NodeRefSet): Promise<NodeHydration> {
    const cardIds = refs.cardIds
    const claimIds = refs.claimIds
    const stepIds = refs.inferenceStepIds

    const [cardRows, axisRows, localeRows, claimRows, stepRows] =
      await Promise.all([
        emptyIfNo(cardIds, () =>
          this.client
            .select(cardColumns)
            .from(cards)
            .where(inArray(cards.id, cardIds)),
        ),
        emptyIfNo(cardIds, () =>
          this.client
            .select({
              cardId: cardAxes.cardId,
              axis: cardAxes.axis,
              ordinal: cardAxes.ordinal,
            })
            .from(cardAxes)
            .where(inArray(cardAxes.cardId, cardIds)),
        ),
        // Locale is a card dimension, not a discovered node, so it is reached through the cards
        // the projection already asked about rather than through `NodeRefSet`.
        emptyIfNo(cardIds, () =>
          this.client
            .select(cardLocaleColumns)
            .from(cardLocales)
            .innerJoin(locales, eq(cardLocales.localeId, locales.id))
            .where(inArray(cardLocales.cardId, cardIds)),
        ),
        emptyIfNo(claimIds, () =>
          this.client
            .select(claimColumns)
            .from(claims)
            .where(inArray(claims.id, claimIds)),
        ),
        emptyIfNo(stepIds, () =>
          this.client
            .select(stepColumns)
            .from(inferenceSteps)
            .where(inArray(inferenceSteps.id, stepIds)),
        ),
      ])

    const [
      collectionRows,
      mechanismRows,
      conceptRows,
      membershipRows,
      premiseRows,
      conclusionRows,
    ] = await Promise.all([
      emptyIfNo(refs.collectionIds, () =>
        this.client
          .select(cardCollectionColumns)
          .from(cardCollections)
          .innerJoin(
            collections,
            eq(cardCollections.collectionId, collections.id),
          )
          .where(inArray(collections.id, refs.collectionIds)),
      ),
      emptyIfNo(refs.mechanismIds, () =>
        this.client
          .select(cardMechanismColumns)
          .from(cardMechanisms)
          .innerJoin(mechanisms, eq(cardMechanisms.mechanismId, mechanisms.id))
          .where(inArray(mechanisms.id, refs.mechanismIds)),
      ),
      // Hydrated by concept id, so the projection can resolve a Card -> Concept edge's endpoint
      // without a second lookup. A concept referenced by no card never reaches `conceptIds` and
      // is never hydrated, which is how the `anti-zionism` orphan stays absent rather than
      // becoming a node with no edges.
      emptyIfNo(refs.conceptIds, () =>
        this.client
          .select(cardConceptColumns)
          .from(cardConcepts)
          .innerJoin(concepts, eq(cardConcepts.conceptId, concepts.id))
          .where(inArray(concepts.id, refs.conceptIds)),
      ),
      emptyIfNo(stepIds, () =>
        this.client
          .select(chainMembershipColumns)
          .from(argumentChainSteps)
          .innerJoin(
            argumentChains,
            eq(argumentChainSteps.argumentChainId, argumentChains.id),
          )
          .where(inArray(argumentChainSteps.inferenceStepId, stepIds)),
      ),
      emptyIfNo(stepIds, () =>
        this.client
          .select(premiseColumns)
          .from(inferencePremises)
          .where(inArray(inferencePremises.inferenceStepId, stepIds)),
      ),
      emptyIfNo(stepIds, () =>
        this.client
          .select(conclusionColumns)
          .from(inferenceConclusions)
          .where(inArray(inferenceConclusions.inferenceStepId, stepIds)),
      ),
    ])

    const directChainIds = dedupe(
      stepRows
        .map((step) => step.argumentChainId)
        .filter((id): id is string => id !== null),
    )
    const membershipChainIds = dedupe(membershipRows.map((row) => row.chainId))
    const allChainIds = dedupe([...directChainIds, ...membershipChainIds])
    const chainRows = await emptyIfNo<ArgumentChainRow>(allChainIds, () =>
      this.client
        .select(chainColumns)
        .from(argumentChains)
        .where(inArray(argumentChains.id, allChainIds)),
    )

    return {
      cards: cardRows,
      cardAxes: axisRows,
      cardCollections: collectionRows,
      cardMechanisms: mechanismRows,
      cardConcepts: conceptRows,
      cardLocales: localeRows,
      claims: claimRows,
      inferenceSteps: stepRows,
      chains: chainRows,
      chainMemberships: membershipRows,
      premises: premiseRows,
      conclusions: conclusionRows,
    }
  }

  /**
   * Read the row counts behind `/api/graph/views`.
   *
   * One round trip of scalar subqueries rather than sixteen separate counts. Read-only, and
   * only run when a client asks what is populated — which is a request for current corpus
   * state, not a static capability list.
   */
  async readPopulation(): Promise<ViewPopulation> {
    const result = await this.client.execute<PopulationRow>(sql`
      SELECT
        (SELECT count(*) FROM trope_graph.cards)::int           AS cards,
        (SELECT count(*) FROM trope_graph.claims)::int          AS claims,
        (SELECT count(*) FROM trope_graph.inference_steps)::int AS inference_steps,
        (SELECT count(*) FROM trope_graph.relationships)::int   AS relationships,
        (SELECT count(*) FROM trope_graph.collections)::int     AS collections,
        (SELECT count(*) FROM trope_graph.mechanisms)::int      AS mechanisms,
        (SELECT count(*) FROM trope_graph.concepts)::int        AS concepts,
        (SELECT count(*) FROM trope_graph.card_concepts)::int   AS card_concepts,
        (SELECT count(*) FROM trope_graph.sources)::int         AS sources,
        (SELECT count(*) FROM trope_graph.evidence_items)::int  AS evidence_items,
        (SELECT count(*) FROM trope_graph.cases)::int           AS cases,
        (SELECT count(*) FROM trope_graph.interpretations)::int AS interpretations,
        (SELECT count(*) FROM trope_graph.questions)::int       AS questions,
        (SELECT count(*) FROM trope_graph.argument_chains)::int AS argument_chains,
        (SELECT count(*) FROM trope_graph.claim_relations)::int AS claim_relations,
        (SELECT count(*) FROM trope_graph.locales)::int         AS locales,
        (SELECT count(*) FROM trope_graph.card_locales)::int    AS card_locales
    `)
    const row = result.rows[0]
    return {
      cards: num(row?.cards),
      claims: num(row?.claims),
      inferenceSteps: num(row?.inference_steps),
      relationships: num(row?.relationships),
      collections: num(row?.collections),
      mechanisms: num(row?.mechanisms),
      concepts: num(row?.concepts),
      cardConcepts: num(row?.card_concepts),
      sources: num(row?.sources),
      evidenceItems: num(row?.evidence_items),
      cases: num(row?.cases),
      interpretations: num(row?.interpretations),
      questions: num(row?.questions),
      argumentChains: num(row?.argument_chains),
      claimRelations: num(row?.claim_relations),
      locales: num(row?.locales),
      cardLocales: num(row?.card_locales),
    }
  }
}

/** The single `*_entity_type` discriminator this reader follows. The projection whitelists again. */
const CARD_ENTITY_TYPE = 'CARD'

/** Raw shape of the population query, with Postgres `::int` casts already applied. */
type PopulationRow = {
  cards: number
  claims: number
  inference_steps: number
  relationships: number
  collections: number
  mechanisms: number
  concepts: number
  card_concepts: number
  sources: number
  evidence_items: number
  cases: number
  interpretations: number
  questions: number
  argument_chains: number
  claim_relations: number
  locales: number
  card_locales: number
}

/**
 * Run a query only when its id list is non-empty.
 *
 * `IN ()` is a syntax error in Postgres, and an empty projection must not become a query
 * failure.
 */
async function emptyIfNo<T>(
  ids: readonly string[],
  run: () => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) return []
  return run()
}

/** Coerce a driver value to a count. */
function num(value: number | undefined): number {
  return Number(value ?? 0)
}

/** Deduplicate while preserving first-seen order. */
function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)]
}

/** The empty expansion returned for a round with no card ids. */
function emptyCardExpansion(): CardExpansion {
  return {
    claims: [],
    inferenceSteps: [],
    cardRelationships: [],
    cardCollections: [],
    cardMechanisms: [],
    cardConcepts: [],
    cardLocales: [],
    argumentChains: [],
    chainMemberships: [],
  }
}

/**
 * Compile-time checks that the columns selected above match the port's row types.
 *
 * These do not exist at runtime. They fail to compile if a query and the port drift apart,
 * which is the failure mode that would otherwise surface as `undefined` deep inside the
 * projection rather than at the query.
 */
export type SelectedRowChecks = [
  Awaited<
    ReturnType<DrizzleGraphReader['hydrate']>
  >['cards'][number] extends CardRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['claims'][number] extends ClaimRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['inferenceSteps'][number] extends InferenceStepRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['cardRelationships'][number] extends RelationshipRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['cardCollections'][number] extends CardCollectionRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['cardMechanisms'][number] extends CardMechanismRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['cardConcepts'][number] extends CardConceptRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['cardLocales'][number] extends CardLocaleRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['hydrate']>
  >['cardLocales'][number] extends CardLocaleRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['argumentChains'][number] extends ArgumentChainRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandCards']>
  >['chainMemberships'][number] extends ArgumentChainMembershipRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandClaims']>
  >['claimRelations'][number] extends ClaimRelationRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandClaims']>
  >['premises'][number] extends InferencePremiseRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandClaims']>
  >['conclusions'][number] extends InferenceConclusionRow
    ? true
    : never,
  Awaited<
    ReturnType<DrizzleGraphReader['expandInferenceSteps']>
  >['stepRelations'][number] extends InferenceStepRelationRow
    ? true
    : never,
]
