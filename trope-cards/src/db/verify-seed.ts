import process from 'node:process'

import { sql } from 'drizzle-orm'

import { getDb, getPool } from './client'
import { cardCorpus } from './seed/corpus'
import { seedTropeGraph } from './seed/index'
import { assertLocalHostFromEnv } from './url'

/**
 * Post-seed verification for the Trope Graph.
 *
 * This exists because of a specific bug. `claims` and `relationships` originally had no
 * uniqueness constraint, so `onConflictDoNothing` was a silent no-op and re-running the
 * seed doubled every row. Nothing failed; the second run simply reported bigger numbers.
 * The static validators cannot catch that, because the seed files are unchanged either way.
 *
 * So the seed is run twice and the row counts compared. Any growth on the second run means
 * a table is missing a uniqueness constraint or the runner is not idempotent.
 */

/** Row counts that must hold after a clean seed of the current corpus. */
const EXPECTED = {
  collections: 5,
  mechanisms: 14,
  concepts: 6,
  cards: 47,
  // 47 cards, 56 authored axis values: 38 single-axis cards and 9 two-axis cards.
  // Recomputed from the corpus rather than trusted, by the axis-preservation check below.
  cardAxes: 56,
  claims: 19,
  relationships: 11,
  inferenceSteps: 4,
  inferencePremises: 9,
  inferenceConclusions: 4,
  argumentChains: 2,
  argumentChainSteps: 4,
  inferenceStepRelations: 2,
} as const

/**
 * Read the current row counts for every seeded table.
 *
 * @returns {Promise<Record<keyof typeof EXPECTED, number>>}
 */
async function snapshot(): Promise<Record<keyof typeof EXPECTED, number>> {
  const db = getDb()

  const {
    rows: [row],
  } = await db.execute<Record<keyof typeof EXPECTED, number>>(sql`
    SELECT
      (SELECT count(*)::int FROM trope_graph.collections)                      AS collections,
      (SELECT count(*)::int FROM trope_graph.mechanisms)                      AS mechanisms,
      (SELECT count(*)::int FROM trope_graph.concepts)                        AS concepts,
      (SELECT count(*)::int FROM trope_graph.cards)                           AS cards,
      (SELECT count(*)::int FROM trope_graph.card_axes)                       AS "cardAxes",
      (SELECT count(*)::int FROM trope_graph.claims)                          AS claims,
      (SELECT count(*)::int FROM trope_graph.relationships)                   AS relationships,
      (SELECT count(*)::int FROM trope_graph.inference_steps)                 AS "inferenceSteps",
      (SELECT count(*)::int FROM trope_graph.inference_premises)              AS "inferencePremises",
      (SELECT count(*)::int FROM trope_graph.inference_conclusions)           AS "inferenceConclusions",
      (SELECT count(*)::int FROM trope_graph.argument_chains)                 AS "argumentChains",
      (SELECT count(*)::int FROM trope_graph.argument_chain_steps)            AS "argumentChainSteps",
      (SELECT count(*)::int FROM trope_graph.inference_step_relations)        AS "inferenceStepRelations"
  `)
  if (!row) throw new Error('Snapshot query returned no row.')
  return row
}

/**
 * Checks that the database satisfies but the seed files do not express.
 *
 * @returns {Promise<{ errors: string[]; warnings: string[] }>}
 */
async function integrityChecks(): Promise<{
  errors: string[]
  warnings: string[]
}> {
  const db = getDb()
  const errors: string[] = []
  const warnings: string[] = []

  // The expected count is a hand-maintained constant, so it can drift from the corpus it
  // describes. Recomputing it here means a card gaining or losing an axis fails loudly
  // instead of quietly invalidating the assertion further down.
  const authoredAxisTotal = cardCorpus.reduce((n, c) => n + c.axis.length, 0)
  if (authoredAxisTotal !== EXPECTED.cardAxes) {
    errors.push(
      `EXPECTED.cardAxes is ${EXPECTED.cardAxes} but the corpus authors ` +
        `${authoredAxisTotal} axis values across ${cardCorpus.length} cards; ` +
        'update EXPECTED when the corpus changes',
    )
  }

  // Redundant with the unique index, but asserted so that losing the index is caught here
  // with a clear message rather than by a growing row count.
  const {
    rows: [dupes],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (
      SELECT card_id, statement FROM trope_graph.claims
      GROUP BY card_id, statement HAVING count(*) > 1
    ) d
  `)
  if (dupes && dupes.n > 0) {
    errors.push(
      `${dupes.n} card/claim-statement pair(s) are duplicated; ` +
        'claims_card_statement_unique_idx is missing',
    )
  }

  const {
    rows: [edgeDupes],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (
      SELECT from_entity_type, from_entity_id, relationship_type,
             to_entity_type, to_entity_id, status
      FROM trope_graph.relationships
      GROUP BY 1,2,3,4,5,6 HAVING count(*) > 1
    ) d
  `)
  if (edgeDupes && edgeDupes.n > 0) {
    errors.push(
      `${edgeDupes.n} duplicated typed edge(s); relationships_edge_unique_idx is missing`,
    )
  }

  // Referential integrity below is guaranteed by foreign keys. These instead check that
  // the graph is actually wired up rather than merely well-formed.
  const {
    rows: [orphanCards],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.cards c
    WHERE NOT EXISTS (SELECT 1 FROM trope_graph.card_collections cc WHERE cc.card_id = c.id)
  `)
  if (orphanCards && orphanCards.n > 0) {
    errors.push(`${orphanCards.n} card(s) belong to no collection`)
  }

  // A card with no axis has no rhetorical classification, which is the state all 47 cards
  // were in before migration 0008: `axis` was authored on every card and read by nobody.
  // An error rather than a warning, because an unclassified card is a defect, not a stage
  // of the corpus.
  const {
    rows: [axislessCards],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.cards c
    WHERE NOT EXISTS (SELECT 1 FROM trope_graph.card_axes ca WHERE ca.card_id = c.id)
  `)
  if (axislessCards && axislessCards.n > 0) {
    errors.push(`${axislessCards.n} card(s) carry no axis`)
  }

  // Counts cannot catch a per-card loss: dropping one axis from one card leaves the total
  // short by exactly one, which is indistinguishable from an unrelated row going missing.
  // So each card's persisted axes are compared against the authored list, in order, since
  // order carries the primary axis.
  const { rows: persistedAxes } = await db.execute<{
    slug: string
    axis: string
    ordinal: number
  }>(sql`
    SELECT c.slug, ca.axis::text AS axis, ca.ordinal
    FROM trope_graph.card_axes ca
    JOIN trope_graph.cards c ON c.id = ca.card_id
    ORDER BY c.slug, ca.ordinal
  `)

  const byCard = new Map<string, string[]>()
  for (const row of persistedAxes) {
    const list = byCard.get(row.slug)
    if (list) list.push(row.axis)
    else byCard.set(row.slug, [row.axis])
  }

  for (const card of cardCorpus) {
    const authored = [...card.axis]
    // Sort a copy: `.sort` mutates in place, so sorting the array from the map directly
    // would also reorder the sequence the order check below is meant to inspect.
    const stored = byCard.get(card.slug) ?? []
    const sorted = [...stored].sort((a, b) => a.localeCompare(b))
    const sameSet =
      authored.length === sorted.length &&
      authored.every((axis) => sorted.includes(axis))
    if (!sameSet) {
      errors.push(
        `card "${card.slug}": authored axis [${authored.join(', ')}] but persisted ` +
          `[${sorted.join(', ') || 'none'}]`,
      )
      continue
    }
    // Same set, wrong order: the primary axis has silently changed.
    if (stored.join(',') !== authored.join(',')) {
      errors.push(
        `card "${card.slug}": axis order changed; authored (primary first) ` +
          `[${authored.join(', ')}] but persisted [${stored.join(', ')}]`,
      )
    }
  }

  const {
    rows: [unboundClaims],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.claims cl
    WHERE NOT EXISTS (SELECT 1 FROM trope_graph.inference_premises p WHERE p.claim_id = cl.id)
      AND NOT EXISTS (SELECT 1 FROM trope_graph.inference_conclusions k WHERE k.claim_id = cl.id)
  `)
  if (unboundClaims && unboundClaims.n > 0) {
    warnings.push(
      `${unboundClaims.n} claim(s) are not bound to any inference step. Expected while the ` +
        'v0.4 claim corpus is deferred, and for the v0.5 identity claims.',
    )
  }

  const {
    rows: [claimlessCards],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.cards c
    WHERE NOT EXISTS (SELECT 1 FROM trope_graph.claims cl WHERE cl.card_id = c.id)
  `)
  if (claimlessCards && claimlessCards.n > 0) {
    warnings.push(
      `${claimlessCards.n} of ${EXPECTED.cards} card(s) have no claims. Expected while the ` +
        '152-claim v0.4 corpus is held back pending source verification.',
    )
  }

  // The engine's purpose is to expose counter-arguments, so a chain with no COUNTER step
  // would mean the reasoning structure is not doing its job.
  const {
    rows: [chainsWithoutCounter],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.argument_chains ch
    WHERE NOT EXISTS (
      SELECT 1 FROM trope_graph.argument_chain_steps s
      WHERE s.argument_chain_id = ch.id AND s.role = 'COUNTER'
    )
  `)
  if (chainsWithoutCounter && chainsWithoutCounter.n > 0) {
    errors.push(
      `${chainsWithoutCounter.n} argument chain(s) have no COUNTER step`,
    )
  }

  return { errors, warnings }
}

/**
 * Seed twice, assert idempotency, then run integrity checks.
 *
 * @returns Process exit code: 0 when everything passes, 1 otherwise.
 */
export async function main(): Promise<number> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // Both seed runs below write, so the same non-loopback guard the migration runner uses
    // applies. seedTropeGraph checks again internally; failing here keeps the message clear.
    assertLocalHostFromEnv()

    await seedTropeGraph()
    const first = await snapshot()

    await seedTropeGraph()
    const second = await snapshot()

    for (const table of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
      if (second[table] !== first[table]) {
        errors.push(
          `${table} grew from ${first[table]} to ${second[table]} on re-seed; ` +
            'the seed is not idempotent',
        )
      }
    }

    for (const [table, expected] of Object.entries(EXPECTED) as [
      keyof typeof EXPECTED,
      number,
    ][]) {
      if (first[table] !== expected) {
        errors.push(`${table}: expected ${expected}, found ${first[table]}`)
      }
    }

    const integrity = await integrityChecks()
    errors.push(...integrity.errors)
    warnings.push(...integrity.warnings)

    console.log(
      JSON.stringify(
        {
          check: 'verify-seed',
          idempotent: errors.every((e) => !e.includes('not idempotent')),
          counts: first,
          errors,
          warnings,
        },
        null,
        2,
      ),
    )

    for (const w of warnings) console.error(`warn: ${w}`)
    for (const e of errors) console.error(`error: ${e}`)

    return errors.length > 0 ? 1 : 0
  } catch (error) {
    console.error(
      `verify-seed failed: ${error instanceof Error ? error.stack : String(error)}`,
    )
    return 1
  } finally {
    await getPool().end()
  }
}

process.exitCode = await main()
