import process from 'node:process'

import { sql } from 'drizzle-orm'

import { getDb, getPool } from './client'
import { claimRelations as claimRelationsSeed } from './seed/claimRelations'
import { cardCorpus } from './seed/corpus'
import { identityRetrospectionClaims } from './seed/identityRetrospection'
import { seedTropeGraph } from './seed/index'
import { newIdentityClaims } from './seed/newIdentityClaims'
import { referenceClaims } from './seed/referenceClaims'
import { corpusClaimSources, corpusSources } from './seed/sourceLayer'
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
  // Q2 resolved the mechanism/concept slug collision by removing the two concepts that restated
  // an existing mechanism, leaving 3 subjects and 1 analytical frame.
  concepts: 4,
  cards: 47,
  // 47 cards, 56 authored axis values: 38 single-axis cards and 9 two-axis cards.
  // Recomputed from the corpus rather than trusted, by the axis-preservation check below.
  cardAxes: 56,
  // The regional taxonomy and its links. The link total is recomputed from the corpus by the
  // locale-preservation check below, since a hand-maintained constant here would drift the
  // same way `cardAxes` did.
  locales: 1,
  cardLocales: 7,
  // Recomputed from cardConceptLinksSeed by the concept-preservation check below.
  cardConcepts: 12,
  // Recomputed from the three claim seed files by the claim-preservation check below.
  claims: 33,
  // The v0.11 increment: 5 direct claim relations, 3 bibliographic sources, 6 attributions.
  claimRelations: 5,
  sources: 3,
  claimSources: 6,
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
      (SELECT count(*)::int FROM trope_graph.card_concepts)                  AS "cardConcepts",
      (SELECT count(*)::int FROM trope_graph.cards)                           AS cards,
      (SELECT count(*)::int FROM trope_graph.card_axes)                       AS "cardAxes",
      (SELECT count(*)::int FROM trope_graph.locales)                         AS locales,
      (SELECT count(*)::int FROM trope_graph.card_locales)                    AS "cardLocales",
      (SELECT count(*)::int FROM trope_graph.claims)                          AS claims,
      (SELECT count(*)::int FROM trope_graph.claim_relations)                 AS "claimRelations",
      (SELECT count(*)::int FROM trope_graph.sources)                         AS sources,
      (SELECT count(*)::int FROM trope_graph.claim_sources)                   AS "claimSources",
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

  // Locale has the same per-card-loss blind spot as axis, and one more hazard: a locale is a
  // statement about the card's setting, so an untagged card that acquires one is as wrong as
  // a tagged card that loses it. Both directions are checked against the corpus.
  const authoredLocaleTotal = cardCorpus.reduce(
    (n, c) => n + (c.locales?.length ?? 0),
    0,
  )
  if (authoredLocaleTotal !== EXPECTED.cardLocales) {
    errors.push(
      `EXPECTED.cardLocales is ${EXPECTED.cardLocales} but the corpus authors ` +
        `${authoredLocaleTotal} locale links across ${cardCorpus.length} cards; ` +
        'update EXPECTED when the corpus changes',
    )
  }

  const { rows: persistedLocales } = await db.execute<{
    slug: string
    locale_slug: string
  }>(sql`
    SELECT c.slug, l.slug AS locale_slug
    FROM trope_graph.card_locales cl
    JOIN trope_graph.cards c ON c.id = cl.card_id
    JOIN trope_graph.locales l ON l.id = cl.locale_id
    ORDER BY c.slug, l.slug
  `)
  const persistedByCard = new Map<string, string[]>()
  for (const row of persistedLocales) {
    const list = persistedByCard.get(row.slug)
    if (list) list.push(row.locale_slug)
    else persistedByCard.set(row.slug, [row.locale_slug])
  }
  for (const card of cardCorpus) {
    const authored = [...(card.locales ?? [])].sort()
    const stored = (persistedByCard.get(card.slug) ?? []).slice().sort()
    if (stored.join(',') !== authored.join(',')) {
      errors.push(
        `card "${card.slug}": authored locale [${authored.join(', ') || 'none'}] but ` +
          `persisted [${stored.join(', ') || 'none'}]`,
      )
    }
  }

  // A locale nobody uses is dead weight in the taxonomy, and a locale used by nobody means a
  // curator selecting it gets an empty suite.
  const {
    rows: [deadLocale],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.locales l
    WHERE NOT EXISTS (SELECT 1 FROM trope_graph.card_locales cl WHERE cl.locale_id = l.id)
  `)
  if (!deadLocale) throw new Error('Dead-locale query returned no row.')
  if (deadLocale.n > 0) {
    errors.push(
      `${deadLocale.n} locale(s) have no cards, so selecting one yields an empty suite`,
    )
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
      `${unboundClaims.n} claim(s) are not bound to any inference step. Expected: the ` +
        'v0.4 corpus is deferred, the v0.5 identity claims were never decomposed, and the ' +
        'v0.11 reference claims restate a card summary rather than an argument.',
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
      `${claimlessCards.n} of ${EXPECTED.cards} card(s) have no claims. Down from 41 before ` +
        'the v0.11 increment. Expected while the 152-claim v0.4 corpus is held back pending ' +
        'source verification, and for the tactic cards, whose summaries describe an ' +
        'operation rather than assert a proposition.',
    )
  }

  // -- v0.11 claim, relation, and source checks ------------------------------
  // EXPECTED.claims is a hand-maintained constant and three separate files now feed it, so
  // it is recomputed here. A file gaining or losing a claim fails loudly instead of quietly
  // invalidating the assertion below.
  const authoredClaims = [
    ...newIdentityClaims,
    ...identityRetrospectionClaims,
    ...referenceClaims,
  ]
  if (authoredClaims.length !== EXPECTED.claims) {
    errors.push(
      `EXPECTED.claims is ${EXPECTED.claims} but the claim seed files author ` +
        `${authoredClaims.length} claims ` +
        `(${newIdentityClaims.length} + ${identityRetrospectionClaims.length} + ` +
        `${referenceClaims.length}); update EXPECTED when the corpus changes`,
    )
  }

  // Claim slugs key every premise binding, claim relation, and source attribution. Two files
  // using one slug would rewire all three onto a single claim, and nothing in the schema
  // would object.
  const claimSlugCounts = new Map<string, number>()
  for (const claim of authoredClaims) {
    claimSlugCounts.set(claim.slug, (claimSlugCounts.get(claim.slug) ?? 0) + 1)
  }
  for (const [slug, n] of claimSlugCounts) {
    if (n > 1) {
      errors.push(
        `claim slug "${slug}" is defined ${n} times across the seed files`,
      )
    }
  }

  // Same reasoning for the relation, source, and attribution constants.
  if (claimRelationsSeed.length !== EXPECTED.claimRelations) {
    errors.push(
      `EXPECTED.claimRelations is ${EXPECTED.claimRelations} but claimRelations.ts authors ` +
        `${claimRelationsSeed.length}`,
    )
  }
  if (corpusSources.length !== EXPECTED.sources) {
    errors.push(
      `EXPECTED.sources is ${EXPECTED.sources} but sourceLayer.ts authors ` +
        `${corpusSources.length}`,
    )
  }
  if (corpusClaimSources.length !== EXPECTED.claimSources) {
    errors.push(
      `EXPECTED.claimSources is ${EXPECTED.claimSources} but sourceLayer.ts authors ` +
        `${corpusClaimSources.length}`,
    )
  }

  // Every endpoint of a claim relation must be a claim, and the two must differ. Foreign keys
  // cover the first; nothing in the schema forbids the second.
  const {
    rows: [selfRelations],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.claim_relations
    WHERE source_claim_id = target_claim_id
  `)
  if (selfRelations && selfRelations.n > 0) {
    errors.push(`${selfRelations.n} claim relation(s) relate a claim to itself`)
  }

  // `sources` has no unique constraint: the runner achieves idempotency by reading on title
  // before inserting. That works only while titles stay unique, so it is asserted here
  // rather than assumed.
  const {
    rows: [sourceDupes],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (
      SELECT title FROM trope_graph.sources GROUP BY title HAVING count(*) > 1
    ) d
  `)
  if (sourceDupes && sourceDupes.n > 0) {
    errors.push(
      `${sourceDupes.n} duplicate source title(s); the runner deduplicates on title, so a ` +
        'repeated title silently merges two source records',
    )
  }

  // Issue #3 Q2 required resolving the mechanism/concept slug collision. Both tables have
  // independent `slug` columns with no cross-table constraint, so a shared slug is invisible
  // to the schema and to the seed: a reader given "collectivisation" cannot tell whether it
  // names a move the text performs or a subject it is about. That is not a hypothetical — the
  // vocabulary shipped two such collisions until this increment removed them.
  const {
    rows: [slugCollision],
  } = await db.execute<{ slugs: string[] }>(sql`
    SELECT coalesce(array_agg(m.slug), '{}') AS slugs FROM (
      SELECT slug FROM trope_graph.mechanisms
      INTERSECT
      SELECT slug FROM trope_graph.concepts
    ) m
  `)
  if (slugCollision && slugCollision.slugs.length > 0) {
    errors.push(
      `mechanism/concept slug collision on ${slugCollision.slugs.join(', ')}; a bare slug ` +
        'would be ambiguous across the two tables, so these names must not be reused',
    )
  }

  // Every concept must be reachable, and every card_concepts row must name a real card and a
  // real concept. The second half is FK-guaranteed; the first is not, and an orphaned concept
  // is a subject the project has vocabulary for but no card discusses.
  const {
    rows: [orphanConcepts],
  } = await db.execute<{ slugs: string[] }>(sql`
    SELECT coalesce(array_agg(c.slug), '{}') AS slugs
    FROM trope_graph.concepts c
    WHERE NOT EXISTS (SELECT 1 FROM trope_graph.card_concepts cc WHERE cc.concept_id = c.id)
  `)
  // `anti-zionism` is a known orphan and that is the honest state of the corpus: no card
  // discusses opposition to Zionism as a subject, and inventing a link to make the table look
  // complete is exactly what Q2 forbids. It is named here so the check stays strict — a new
  // orphan fails, and this one is a recorded gap rather than a tolerated silence.
  const KNOWN_ORPHAN_CONCEPTS: ReadonlySet<string> = new Set(['anti-zionism'])
  const unexpectedOrphans = (orphanConcepts?.slugs ?? []).filter(
    (slug) => !KNOWN_ORPHAN_CONCEPTS.has(slug),
  )
  if (unexpectedOrphans.length > 0) {
    errors.push(
      `orphaned concept(s) with no card link: ${unexpectedOrphans.join(', ')}; either link ` +
        'a card whose text supports it, or record it as a known corpus gap',
    )
  }

  // The central constraint of the v0.11 increment, enforced on the database rather than
  // trusted to reviewer discipline: no attribution asserts a quotation or a locator.
  //
  // A claim naming the document it rests on is a bibliographic statement. A quotation is an
  // assertion about wording, and nothing in the corpus verifies wording. Once one quotation
  // exists among the rest, it reads as checked work, which is the appearance this increment
  // refuses to create. Lifting this requires a real evidence_items row with a verified
  // locator, not an edit here.
  const {
    rows: [quotedAttributions],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.claim_sources
    WHERE quote_or_excerpt IS NOT NULL OR page_reference IS NOT NULL
  `)
  if (quotedAttributions && quotedAttributions.n > 0) {
    errors.push(
      `${quotedAttributions.n} claim_source row(s) assert a quote or page reference. The ` +
        'v0.11 increment records bibliographic attribution only; excerpts belong in ' +
        'evidence_items with a verified locator. See seed/sourceLayer.ts.',
    )
  }

  // `evidence_items` is absent from EXPECTED because it must stay empty for now. It is
  // asserted explicitly so that the table cannot quietly acquire a row without this
  // decision being revisited.
  const {
    rows: [evidence],
  } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM trope_graph.evidence_items
  `)
  if (evidence && evidence.n > 0) {
    errors.push(
      `${evidence.n} evidence item(s) exist. Recording one requires a located passage with ` +
        'verifiable wording; see docs/CORPUS_GAP_ANALYSIS.md section 4.',
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
