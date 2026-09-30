import { and, eq, notInArray, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

import { db, pool } from '../client'
import {
  argumentChainSteps,
  argumentChains,
  inferenceStepRelations,
} from '../schema/argumentChains'
import {
  inferenceConclusions,
  inferencePremises,
  inferenceSteps,
} from '../schema/claimDecomposition'
import {
  cardAxes,
  cardCollections,
  cardMechanisms,
  cards,
  claims,
  collections,
  concepts,
  mechanisms,
  relationships,
} from '../schema/tropeGraph'
import { assertLocalHostFromEnv } from '../url'
import { argumentChainSeed } from './argumentChains'
import { claimDecompositionSeed } from './claimDecomposition'
import { cardCorpus } from './corpus'
import {
  identityRetrospectionClaims,
  identityRetrospectionRelationships,
} from './identityRetrospection'
import { newIdentityClaims } from './newIdentityClaims'
import { collectionsSeed, conceptsSeed, mechanismsSeed } from './taxonomy'
import type { CardAxis, CardSeed } from './types'

/**
 * The full card corpus: the 45-card v0.5 draft plus the two Identity Retrospection
 * cards added in v0.6. Both are already typed as `CardSeed[]`, so no widening is needed.
 */
const allCards: CardSeed[] = [...cardCorpus]

/**
 * The transaction type `db.transaction` hands its callback, derived rather than restated so
 * it tracks the client. `PgTransaction` would need three generic parameters spelled out by
 * hand, and the schema is a set of individually imported tables rather than one object.
 */
type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Makes `card_axes` for one card match its authored axis list exactly.
 *
 * Three phases, in this order, and the order is load-bearing. `card_axes_card_ordinal_unique_idx`
 * allows only one axis per position, so a reorder cannot be applied by writing final
 * ordinals directly — the intermediate state would briefly hold two rows at the same
 * ordinal. Moving existing rows out of the non-negative range first, then back, sidesteps
 * that: negatives are unique among themselves, and 0..n-1 are free by the time the final
 * values are written.
 *
 * Row ids are preserved for axes the seed still claims, so anything that later references
 * `card_axes.id` is not invalidated by a re-seed.
 *
 * @param tx Seed transaction.
 * @param cardId Card whose axis rows are being reconciled.
 * @param authoredAxes Authored axes, primary first. Ordinal 0 is the primary axis.
 * @returns Counts of rows removed and added, for reporting.
 * @throws {Error} If an authored axis is absent from the `card_axis` enum. Unreachable via
 * the `CardSeed['axis']` type, which is derived from that enum; asserted because this is
 * the same "throws rather than silently drops" rule the caller relies on.
 */
async function reconcileCardAxes(
  tx: SeedTransaction,
  cardId: string,
  authoredAxes: readonly CardAxis[],
): Promise<{ removed: number; added: number }> {
  // Phase 1: vacate every non-negative ordinal this card holds.
  await tx
    .update(cardAxes)
    .set({ ordinal: sql`${cardAxes.ordinal} - 1000` })
    .where(eq(cardAxes.cardId, cardId))

  // Phase 2: drop axes the seed no longer claims.
  const stale = authoredAxes.length
    ? await tx
        .delete(cardAxes)
        .where(
          and(
            eq(cardAxes.cardId, cardId),
            notInArray(cardAxes.axis, [...authoredAxes]),
          ),
        )
        .returning({ id: cardAxes.id })
    : []

  // Phase 3: insert what is missing, then put every row at its authored position.
  const missing = authoredAxes.length
    ? await tx
        .insert(cardAxes)
        .values(
          authoredAxes.map((axis, ordinal) => ({ cardId, axis, ordinal })),
        )
        .onConflictDoNothing()
        .returning({ id: cardAxes.id })
    : []

  for (const [ordinal, axis] of authoredAxes.entries()) {
    await tx
      .update(cardAxes)
      .set({ ordinal })
      .where(and(eq(cardAxes.cardId, cardId), eq(cardAxes.axis, axis)))
  }

  return { removed: stale.length, added: missing.length }
}

/**
 * Seed the Trope Graph from the consolidated v0.1-v0.9 seed corpus.
 *
 * Runs as a single transaction in dependency order: taxonomy, then cards, then claims,
 * then graph edges, then reasoning structure, then argument chains. Symbolic slugs used
 * by the seed files are resolved to UUIDs in memory, because the seed layer is written
 * against stable editorial labels rather than generated ids.
 *
 * Intentionally NOT seeded:
 *   - The v0.4 152-claim corpus (`data/claims.json`). It is keyed by card name rather
 *     than slug, 39 of its statements still carry a `SOURCE_REQUIRED` marker, and its
 *     own v0.4 README calls it "a migration artifact, not yet the canonical seed". It is
 *     held back until claims are normalised and sourced, per Gate 3 of
 *     docs/TROPE_GRAPH_MIGRATION.md.
 *   - Evidence items. `seed/evidenceLayer.ts` supplies only the controlled vocabulary for
 *     evidence type, relation, strength, and locator type. There are no located passages
 *     to record yet, and inventing them would misrepresent evidence that does not exist.
 *
 * Every reference is validated before insert. An unresolvable slug throws rather than
 * producing a dangling row.
 *
 * @returns Counts of the rows written, for reporting.
 * @throws {Error} If a seed slug cannot be resolved to a real row.
 * @example
 * ```sh
 * TROPE_GRAPH_DATABASE_URL=postgresql://localhost:5432/trope_cards_dev \
 *   npx tsx trope-cards/src/db/seed/run.ts
 * ```
 */
export async function seedTropeGraph(): Promise<Record<string, number>> {
  // Refuse a non-loopback host unless explicitly opted in. The repository `.env` points
  // DATABASE_URL at a live Neon instance and the graph client falls back to it, so an
  // unset TROPE_GRAPH_DATABASE_URL would otherwise write 47 cards to production.
  assertLocalHostFromEnv()

  const counts = await db.transaction(async (tx) => {
    // -- Taxonomy ----------------------------------------------------------
    await tx
      .insert(collections)
      .values(collectionsSeed.map((c) => ({ ...c })))
      .onConflictDoUpdate({
        target: collections.slug,
        set: { name: collections.name, description: collections.description },
      })

    await tx
      .insert(mechanisms)
      .values(
        mechanismsSeed.map(([slug, name, description]) => ({
          slug,
          name,
          description,
        })),
      )
      .onConflictDoUpdate({
        target: mechanisms.slug,
        set: { name: mechanisms.name, description: mechanisms.description },
      })

    await tx
      .insert(concepts)
      .values(
        conceptsSeed.map(([slug, name, definition]) => ({
          slug,
          name,
          definition,
        })),
      )
      .onConflictDoUpdate({
        target: concepts.slug,
        set: { name: concepts.name, definition: concepts.definition },
      })

    const collectionIds = new Map(
      (
        await tx
          .select({ id: collections.id, slug: collections.slug })
          .from(collections)
      ).map((r) => [r.slug, r.id]),
    )
    const mechanismIds = new Map(
      (
        await tx
          .select({ id: mechanisms.id, slug: mechanisms.slug })
          .from(mechanisms)
      ).map((r) => [r.slug, r.id]),
    )

    // -- Cards -------------------------------------------------------------
    const cardIds = new Map<string, string>()
    for (const seed of allCards) {
      const [card] = await tx
        .insert(cards)
        .values({
          slug: seed.slug,
          title: seed.title,
          summary: seed.summary ?? null,
          coreQuestion: seed.coreQuestion ?? null,
          primaryType: seed.primaryType,
          epistemicStatus: seed.status,
          editorialNotes: seed.editorialNotes ?? null,
        })
        .onConflictDoUpdate({
          target: cards.slug,
          set: {
            title: seed.title,
            summary: seed.summary ?? null,
            coreQuestion: seed.coreQuestion ?? null,
            primaryType: seed.primaryType,
            epistemicStatus: seed.status,
            editorialNotes: seed.editorialNotes ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: cards.id })
      if (!card) {
        throw new Error(`Insert of card "${seed.slug}" returned no row.`)
      }
      cardIds.set(seed.slug, card.id)

      const collectionLinks = seed.collection
        .map((slug) => collectionIds.get(slug))
        .filter((id): id is string => Boolean(id))
        .map((collectionId) => ({ cardId: card.id, collectionId }))
      if (collectionLinks.length) {
        await tx
          .insert(cardCollections)
          .values(collectionLinks)
          .onConflictDoNothing()
      }

      const mechanismLinks = (seed.mechanisms ?? [])
        .map((slug) => mechanismIds.get(slug))
        .filter((id): id is string => Boolean(id))
        .map((mechanismId) => ({ cardId: card.id, mechanismId }))
      if (mechanismLinks.length) {
        await tx
          .insert(cardMechanisms)
          .values(mechanismLinks)
          .onConflictDoNothing()
      }

      // Axes are reconciled rather than accumulated. `onConflictDoNothing`, as used for
      // collections and mechanisms above, would leave a stale row behind whenever an editor
      // removed or reordered an authored axis, so the database would keep asserting a
      // classification the seed no longer claims — the same quiet divergence this field
      // was recovered from. Existing rows keep their ids; only their ordinals move.
      await reconcileCardAxes(tx, card.id, seed.axis)
    }

    // Referential integrity is checked strictly: a slug in a card's collection or mechanism
    // list that does not exist in taxonomy.ts is an error, not a row to skip. Skipping
    // would leave a card that silently lost a classification, which is the kind of quiet
    // data loss this graph is meant to make impossible.
    for (const seed of allCards) {
      for (const slug of seed.collection) {
        if (!collectionIds.has(slug)) {
          throw new Error(
            `Card "${seed.slug}" references collection "${slug}", which taxonomy.ts does not define.`,
          )
        }
      }
      for (const slug of seed.mechanisms ?? []) {
        if (!mechanismIds.has(slug)) {
          throw new Error(
            `Card "${seed.slug}" references mechanism "${slug}", which taxonomy.ts does not define.`,
          )
        }
      }
      // A card with no axis has no rhetorical classification at all, which is the state
      // every card was in before migration 0008. It is rejected rather than tolerated.
      if (seed.axis.length === 0) {
        throw new Error(
          `Card "${seed.slug}" has no axis. A card must be classified along at least one ` +
            'axis; an unclassified card is the exact condition this guard exists to prevent.',
        )
      }
      if (new Set(seed.axis).size !== seed.axis.length) {
        throw new Error(
          `Card "${seed.slug}" repeats an axis (${seed.axis.join(', ')}). ` +
            'The card_axes unique index on (card_id, axis) would reject this on insert.',
        )
      }
    }

    const requireCard = (slug: string): string => {
      const id = cardIds.get(slug)
      if (!id) {
        throw new Error(
          `Seed references card "${slug}", which no seed file defines. ` +
            `Known cards: ${[...cardIds.keys()].sort().join(', ')}`,
        )
      }
      return id
    }

    // -- Claims ------------------------------------------------------------
    // Only identityRetrospectionClaims carry a `slug`; newIdentityClaims are referenced
    // by nothing, so they need no label. Both are inserted, and the slug map is built
    // from whichever rows have one.
    for (const claim of newIdentityClaims) {
      await tx
        .insert(claims)
        .values({
          cardId: requireCard(claim.cardSlug),
          statement: claim.statement,
          claimType: claim.claimType,
          description: `Evidence required: ${claim.evidenceRequirement}`,
          epistemicStatus: claim.status,
        })
        .onConflictDoNothing()
    }

    const claimIds = new Map<string, string>()
    for (const claim of identityRetrospectionClaims) {
      const cardId = requireCard(claim.cardSlug)
      const [row] = await tx
        .insert(claims)
        .values({
          cardId,
          statement: claim.statement,
          claimType: claim.claimType,
          epistemicStatus: claim.status,
        })
        .onConflictDoNothing()
        .returning({ id: claims.id })

      let claimId = row?.id
      if (row === undefined) {
        // Expected only on a re-run, where the claim already exists.
      }
      if (!claimId) {
        // Already seeded: re-read by statement, since claims have no unique slug column.
        const [existing] = await tx
          .select({ id: claims.id })
          .from(claims)
          .where(
            and(
              eq(claims.cardId, cardId),
              eq(claims.statement, claim.statement),
            ),
          )
        claimId = existing?.id
      }
      if (!claimId) {
        throw new Error(`Unable to resolve claim "${claim.slug}" to an id.`)
      }
      claimIds.set(claim.slug, claimId)
    }

    const requireClaim = (slug: string): string => {
      const id = claimIds.get(slug)
      if (!id) {
        throw new Error(
          `Seed references claim "${slug}", which identityRetrospection.ts does not define. ` +
            `Known claims: ${[...claimIds.keys()].sort().join(', ')}`,
        )
      }
      return id
    }

    // -- Typed graph edges -------------------------------------------------
    for (const edge of identityRetrospectionRelationships) {
      await tx
        .insert(relationships)
        .values({
          fromEntityType: 'CARD',
          fromEntityId: requireCard(edge.fromCardSlug),
          relationshipType: edge.relationshipType,
          toEntityType: 'CARD',
          toEntityId: requireCard(edge.toCardSlug),
          description: edge.description,
          // Falls back to the column default of CANONICAL when the seed omits it.
          ...(edge.status ? { status: edge.status } : {}),
        })
        .onConflictDoNothing()
    }

    // -- Reasoning structure ------------------------------------------------
    // v0.7 and v0.8 both contribute inference steps. inference_steps has no unique
    // natural key in the schema, so each is looked up by (card_id, label) before insert.
    const stepIds = new Map<string, string>()
    const allStepSeeds = [
      ...claimDecompositionSeed.inferenceSteps,
      ...argumentChainSeed.inferenceSteps,
    ]

    // v0.8 restates some v0.7 steps. Merging by (card, label) means the later definition
    // would silently replace the earlier one, so disagreements are surfaced instead of
    // resolved by write order. The step sets are currently disjoint, so this never fires;
    // it exists so that a future overlapping edit fails loudly rather than quietly
    // discarding an editorial decision.
    const firstDefinition = new Map<string, (typeof allStepSeeds)[number]>()
    const stepConflicts: string[] = []
    for (const step of allStepSeeds) {
      const key = `${step.cardSlug} :: ${step.label}`
      const first = firstDefinition.get(key)
      if (!first) {
        firstDefinition.set(key, step)
        continue
      }
      const fields = [
        'description',
        'inferenceType',
        'epistemicStatus',
        'isCanonical',
      ] as const
      const differing = fields.filter((f) => first[f] !== step[f])
      if (differing.length > 0) {
        stepConflicts.push(
          `${key} (${differing.join(', ')}: ` +
            `${differing.map((f) => `${f} "${String(first[f])}" vs "${String(step[f])}"`).join('; ')})`,
        )
      }
    }
    if (stepConflicts.length > 0) {
      throw new Error(
        'v0.7 and v0.8 define the same inference step differently:\n  ' +
          stepConflicts.join('\n  ') +
          '\nReconcile the two files before seeding; the merge is ambiguous.',
      )
    }

    for (const step of allStepSeeds) {
      const cardId = requireCard(step.cardSlug)
      const [existing] = await tx
        .select({ id: inferenceSteps.id })
        .from(inferenceSteps)
        .where(
          and(
            eq(inferenceSteps.cardId, cardId),
            eq(inferenceSteps.label, step.label),
          ),
        )

      let stepId = existing?.id
      if (stepId) {
        await tx
          .update(inferenceSteps)
          .set({
            description: step.description,
            inferenceType: step.inferenceType,
            epistemicStatus: step.epistemicStatus,
            isCanonical: step.isCanonical,
            updatedAt: new Date(),
          })
          .where(eq(inferenceSteps.id, stepId))
      } else {
        const [row] = await tx
          .insert(inferenceSteps)
          .values({
            cardId,
            label: step.label,
            description: step.description,
            inferenceType: step.inferenceType,
            epistemicStatus: step.epistemicStatus,
            isCanonical: step.isCanonical,
          })
          .returning({ id: inferenceSteps.id })
        if (!row) {
          throw new Error(
            `Insert of inference step "${step.label}" returned no row.`,
          )
        }
        stepId = row.id
      }
      stepIds.set(step.label, stepId)
    }

    const requireStep = (label: string): string => {
      const id = stepIds.get(label)
      if (!id) {
        throw new Error(
          `Seed references inference step "${label}", which no seed file defines.`,
        )
      }
      return id
    }

    for (const binding of claimDecompositionSeed.premiseBindings) {
      const inferenceStepId = requireStep(binding.inferenceLabel)
      await tx
        .insert(inferencePremises)
        .values(
          binding.premises.map((premise) => ({
            inferenceStepId,
            claimId: requireClaim(premise.claimSlug),
            role: premise.role,
            ordinal: premise.ordinal,
          })),
        )
        .onConflictDoNothing()
    }

    for (const binding of claimDecompositionSeed.conclusionBindings) {
      const inferenceStepId = requireStep(binding.inferenceLabel)
      await tx
        .insert(inferenceConclusions)
        .values(
          binding.conclusions.map((conclusion) => ({
            inferenceStepId,
            claimId: requireClaim(conclusion.claimSlug),
            ordinal: conclusion.ordinal,
          })),
        )
        .onConflictDoNothing()
    }

    // -- Argument chains ----------------------------------------------------
    const chainIds = new Map<string, string>()
    for (const chain of argumentChainSeed.chains) {
      const cardId = requireCard(chain.cardSlug)
      const [existing] = await tx
        .select({ id: argumentChains.id })
        .from(argumentChains)
        .where(
          and(
            eq(argumentChains.cardId, cardId),
            eq(argumentChains.label, chain.label),
          ),
        )

      let chainId = existing?.id
      if (chainId) {
        await tx
          .update(argumentChains)
          .set({
            description: chain.description,
            kind: chain.kind,
            epistemicStatus: chain.epistemicStatus,
            updatedAt: new Date(),
          })
          .where(eq(argumentChains.id, chainId))
      } else {
        const [row] = await tx
          .insert(argumentChains)
          .values({
            cardId,
            label: chain.label,
            description: chain.description,
            kind: chain.kind,
            epistemicStatus: chain.epistemicStatus,
          })
          .returning({ id: argumentChains.id })
        if (!row) {
          throw new Error(
            `Insert of argument chain "${chain.label}" returned no row.`,
          )
        }
        chainId = row.id
      }
      chainIds.set(chain.label, chainId)

      for (const step of chain.steps) {
        const inferenceStepId = requireStep(step.inferenceLabel)
        await tx
          .update(inferenceSteps)
          .set({ argumentChainId: chainId })
          .where(eq(inferenceSteps.id, inferenceStepId))
        await tx
          .insert(argumentChainSteps)
          .values({
            argumentChainId: chainId,
            inferenceStepId,
            role: step.role,
            ordinal: step.ordinal,
          })
          .onConflictDoNothing()
      }
    }

    for (const relation of argumentChainSeed.stepRelations) {
      const sourceCardId = requireCard(relation.cardSlug)
      // A relation is documented under a specific card, so both endpoints must belong to
      // that card. Catching this here prevents a CHALLENGES edge from silently joining
      // steps belonging to two different cards.
      for (const label of [relation.source, relation.target]) {
        const [owner] = await tx
          .select({ cardId: inferenceSteps.cardId })
          .from(inferenceSteps)
          .where(eq(inferenceSteps.id, requireStep(label)))
        if (owner?.cardId !== sourceCardId) {
          throw new Error(
            `Step relation ${relation.source} -> ${relation.target} is declared under card ` +
              `"${relation.cardSlug}", but step "${label}" belongs to a different card.`,
          )
        }
      }
      await tx
        .insert(inferenceStepRelations)
        .values({
          sourceInferenceStepId: requireStep(relation.source),
          targetInferenceStepId: requireStep(relation.target),
          relationType: relation.relationType,
          description: relation.description,
        })
        .onConflictDoNothing()
    }

    const count = async (table: PgTable) => {
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(table)
      if (!row) {
        throw new Error('Aggregate count returned no row.')
      }
      return row.n
    }

    return {
      collections: await count(collections),
      mechanisms: await count(mechanisms),
      concepts: await count(concepts),
      cards: await count(cards),
      cardAxes: await count(cardAxes),
      claims: await count(claims),
      relationships: await count(relationships),
      inferenceSteps: await count(inferenceSteps),
      inferencePremises: await count(inferencePremises),
      inferenceConclusions: await count(inferenceConclusions),
      argumentChains: await count(argumentChains),
      argumentChainSteps: await count(argumentChainSteps),
      inferenceStepRelations: await count(inferenceStepRelations),
    }
  })

  return counts
}

/**
 * Entry point for `npm run trope-graph:seed`.
 *
 * Seeds, reports, and closes the pool so the process can exit.
 *
 * @returns Process exit code: 0 on success, 1 on failure.
 */
export async function main(): Promise<number> {
  try {
    const counts = await seedTropeGraph()
    console.log('Trope Graph seeded:')
    for (const [key, value] of Object.entries(counts)) {
      console.log(`  ${key.padEnd(22)} ${value}`)
    }
    console.log('\nNot seeded (intentionally):')
    console.log('  evidence items        0  no located passages recorded yet')
    console.log(
      '  v0.4 claim corpus     0  held back pending source verification',
    )
    return 0
  } catch (error) {
    console.error('Seed failed:', error)
    return 1
  } finally {
    await pool.end()
  }
}
