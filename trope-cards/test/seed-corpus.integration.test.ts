import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { sql } from 'drizzle-orm'

import { claimRelations } from '../src/db/seed/claimRelations'
import { cardCorpus } from '../src/db/seed/corpus'
import { identityRetrospectionClaims } from '../src/db/seed/identityRetrospection'
import { newIdentityClaims } from '../src/db/seed/newIdentityClaims'
import { referenceClaims } from '../src/db/seed/referenceClaims'
import { corpusClaimSources, corpusSources } from '../src/db/seed/sourceLayer'

/**
 * Read-side guarantees that the v0.11 corpus increment reaches storage intact.
 *
 * Read-only, and skipped unless `TROPE_GRAPH_DATABASE_URL` is set, so the suite still runs
 * without a database. `pnpm run trope-graph:verify` is the authoritative write-path check: it
 * seeds twice, asserts idempotency, and checks counts and invariants. This suite covers what
 * counts cannot — that each persisted row carries the identity the seed authored.
 *
 * Losing one relation out of five leaves the total short by one, indistinguishable from an
 * unrelated row going missing. So each relation is matched on its source statement, relation
 * type, and target statement rather than by count, and each attribution on its claim
 * statement and source title. Claims are additionally matched to their owning card, since a
 * claim landing on the wrong card would leave every count and statement-level check intact.
 */

/** True when a database is configured, so these tests have something to read. */
const hasDatabase = Boolean(process.env.TROPE_GRAPH_DATABASE_URL)

/** Every slugged seed claim, across all three claim files. */
const allClaims: Array<{ slug: string; cardSlug: string; statement: string }> = [
  ...newIdentityClaims,
  ...identityRetrospectionClaims,
  ...referenceClaims,
]

/**
 * Seed claim slug -> statement, and slug -> owning card.
 *
 * Relations and attributions are keyed by claim slug in the seed files but only by statement
 * in the database, so every comparison goes through these maps. Built from the seed modules
 * rather than hardcoded, so they track the corpus.
 */
const statementsBySlug = new Map(allClaims.map((c) => [c.slug, c.statement]))
const cardByClaimSlug = new Map(allClaims.map((c) => [c.slug, c.cardSlug]))

/** A persisted claim relation, joined to both endpoint claims and their cards. */
type PersistedRelation = {
  relation_type: string
  source_statement: string
  source_card: string
  target_statement: string
  target_card: string
}

/** A persisted claim/source attribution, joined to the claim and the source. */
type PersistedAttribution = {
  claim_statement: string
  source_title: string
  relationship: string
  quote_or_excerpt: string | null
  page_reference: string | null
}

/** A persisted claim, with its owning card. */
type PersistedClaim = {
  statement: string
  claim_type: string
  epistemic_status: string
  card_slug: string
}

/** The seeded relation set, expressed through claim statements for comparison. */
function seededRelationKeys(): Set<string> {
  return new Set(
    claimRelations.map((r) => {
      const source = statementsBySlug.get(r.sourceClaimSlug)
      const target = statementsBySlug.get(r.targetClaimSlug)
      assert.ok(
        source,
        `seeded relation references unknown claim "${r.sourceClaimSlug}"`,
      )
      assert.ok(
        target,
        `seeded relation references unknown claim "${r.targetClaimSlug}"`,
      )
      return [source, r.relationType, target].join(' -> ')
    }),
  )
}

/** The seeded attribution set, in the same shape. */
function seededAttributionKeys(): Set<string> {
  return new Set(
    corpusClaimSources.map((link) => {
      const source = corpusSources.find((s) => s.label === link.sourceLabel)
      assert.ok(
        source,
        `attribution references unknown source "${link.sourceLabel}"`,
      )
      const claim = statementsBySlug.get(link.claimSlug)
      assert.ok(
        claim,
        `attribution references unknown claim "${link.claimSlug}"`,
      )
      return [claim, source.title, link.relationship].join(' | ')
    }),
  )
}

describe(
  'persisted v0.11 corpus increment',
  { skip: hasDatabase ? false : 'no TROPE_GRAPH_DATABASE_URL set' },
  () => {
    let pool: { end: () => Promise<void> } | undefined
    let relations: PersistedRelation[] = []
    let attributions: PersistedAttribution[] = []
    let claims: PersistedClaim[] = []
    let counts: Record<string, number> = {}

    before(async () => {
      // Imported here rather than at module scope: `client.ts` resolves a connection string and
      // constructs a pool as an import side effect, which would throw before the skip above
      // could be evaluated.
      const { getDb, getPool } = await import('../src/db/client')
      const { assertLocalHostFromEnv } = await import('../src/db/url')
      assertLocalHostFromEnv()
      const db = getDb()
      pool = getPool()

      // Sanity: every comparison below is set-based, so an empty authored list would make it
      // vacuously pass.
      assert.ok(claimRelations.length > 0, 'sanity: claim relations are authored')
      assert.ok(corpusClaimSources.length > 0, 'sanity: attributions are authored')
      assert.ok(referenceClaims.length > 0, 'sanity: reference claims are authored')

      relations = (
        await db.execute<PersistedRelation>(sql`
          SELECT cr.relation_type::text AS relation_type,
                 src.statement AS source_statement,
                 src_card.slug AS source_card,
                 tgt.statement AS target_statement,
                 tgt_card.slug AS target_card
          FROM trope_graph.claim_relations cr
          JOIN trope_graph.claims src ON src.id = cr.source_claim_id
          JOIN trope_graph.cards src_card ON src_card.id = src.card_id
          JOIN trope_graph.claims tgt ON tgt.id = cr.target_claim_id
          JOIN trope_graph.cards tgt_card ON tgt_card.id = tgt.card_id
          ORDER BY src.statement, cr.relation_type, tgt.statement
        `)
      ).rows

      attributions = (
        await db.execute<PersistedAttribution>(sql`
          SELECT cl.statement AS claim_statement,
                 s.title AS source_title,
                 cs.relationship,
                 cs.quote_or_excerpt,
                 cs.page_reference
          FROM trope_graph.claim_sources cs
          JOIN trope_graph.claims cl ON cl.id = cs.claim_id
          JOIN trope_graph.sources s ON s.id = cs.source_id
          ORDER BY cl.statement, s.title
        `)
      ).rows

      claims = (
        await db.execute<PersistedClaim>(sql`
          SELECT cl.statement,
                 cl.claim_type::text AS claim_type,
                 cl.epistemic_status::text AS epistemic_status,
                 c.slug AS card_slug
          FROM trope_graph.claims cl
          JOIN trope_graph.cards c ON c.id = cl.card_id
        `)
      ).rows

      const { rows: [snapshot] } = await db.execute<Record<string, number>>(sql`
        SELECT (SELECT count(*)::int FROM trope_graph.cards)                          AS cards,
               (SELECT count(*)::int FROM trope_graph.claims)                         AS claims,
               (SELECT count(*)::int FROM trope_graph.claim_relations)                AS "claimRelations",
               (SELECT count(*)::int FROM trope_graph.sources)                        AS sources,
               (SELECT count(*)::int FROM trope_graph.claim_sources)                  AS "claimSources",
               (SELECT count(*)::int FROM trope_graph.evidence_items)                 AS "evidenceItems",
               (SELECT count(*)::int FROM trope_graph.claim_relations
                WHERE source_claim_id = target_claim_id)                             AS "selfRelations",
               (SELECT count(*)::int FROM trope_graph.claim_sources
                WHERE quote_or_excerpt IS NOT NULL OR page_reference IS NOT NULL)    AS "quotedSources",
               (SELECT count(*)::int FROM trope_graph.sources s
                WHERE NOT EXISTS (
                  SELECT 1 FROM trope_graph.claim_sources cs WHERE cs.source_id = s.id
                ))                                                                 AS "unattachedSources"
      `)
      counts = snapshot ?? {}
    })

    after(async () => {
      await pool?.end()
    })

    it('persists exactly the claim relations the seed authored', () => {
      const expected = seededRelationKeys()
      const actual = new Set(
        relations.map((r) =>
          [r.source_statement, r.relation_type, r.target_statement].join(' -> '),
        ),
      )
      assert.deepEqual(
        [...expected].filter((k) => !actual.has(k)),
        [],
        'seeded claim relation did not reach the database',
      )
      assert.deepEqual(
        [...actual].filter((k) => !expected.has(k)),
        [],
        'database holds a claim relation the seed did not author',
      )
    })

    it('never relates a claim to itself', () => {
      assert.equal(counts.selfRelations, 0)
    })

    it('keeps every relation within a single card', () => {
      // Not a schema rule, but a property of the relations authored so far: each is a
      // statement about two propositions on the same card. A cross-card relation needs a
      // deliberate decision that this suite is not yet asserting.
      assert.deepEqual(
        relations
          .filter((r) => r.source_card !== r.target_card)
          .map((r) => `${r.source_card} -> ${r.target_card}`),
        [],
      )
    })

    it('persists exactly the source attributions the seed authored', () => {
      const expected = seededAttributionKeys()
      const actual = new Set(
        attributions.map((r) =>
          [r.claim_statement, r.source_title, r.relationship].join(' | '),
        ),
      )
      assert.deepEqual(
        [...expected].filter((k) => !actual.has(k)),
        [],
        'seeded attribution did not reach the database',
      )
      assert.deepEqual(
        [...actual].filter((k) => !expected.has(k)),
        [],
        'database holds an attribution the seed did not author',
      )
    })

    it('stores no quotation or locator on any attribution', () => {
      // Asserted on the database rather than only on the seed files, so a manual insert
      // cannot introduce an unverifiable excerpt either. See seed/sourceLayer.ts.
      assert.equal(counts.quotedSources, 0)
      assert.ok(
        attributions.every(
          (r) => r.quote_or_excerpt === null && r.page_reference === null,
        ),
      )
    })

    it('records no evidence items', () => {
      // An evidence item requires a located passage with verifiable wording. Its absence is a
      // decision, not an omission. See docs/CORPUS_GAP_ANALYSIS.md section 4.
      assert.equal(counts.evidenceItems, 0)
    })

    it('leaves every source attached to at least one claim', () => {
      assert.equal(
        counts.unattachedSources,
        0,
        'a source no claim rests on is dead weight in the bibliography',
      )
    })

    it('gave every reference claim the type, status, and card the seed authored', () => {
      const persisted = new Map(
        claims.map((r) => [`${r.card_slug}::${r.statement}`, r]),
      )
      for (const claim of referenceClaims) {
        const row = persisted.get(`${claim.cardSlug}::${claim.statement}`)
        assert.ok(row, `claim "${claim.slug}" is missing from the database`)
        assert.equal(row.claim_type, claim.claimType, `claim "${claim.slug}" claim_type`)
        assert.equal(
          row.epistemic_status,
          claim.status,
          `claim "${claim.slug}" epistemic_status`,
        )
      }
    })

    it('attached every slugged claim to the card the seed named', () => {
      // A claim resolving to the right statement on the wrong card would leave every count and
      // every statement-level check above intact, so this is asserted from the seed's own
      // `cardSlug` rather than inferred from the statement text.
      const holders = new Map<string, Set<string>>()
      for (const row of claims) {
        const set = holders.get(row.statement)
        if (set) set.add(row.card_slug)
        else holders.set(row.statement, new Set([row.card_slug]))
      }
      const misplaced = allClaims
        .filter((claim) => {
          const cards = holders.get(claim.statement)
          return !cards || !cards.has(cardByClaimSlug.get(claim.slug) ?? '')
        })
        .map((claim) => claim.slug)
      assert.deepEqual(
        misplaced,
        [],
        'claim is attached to a card the seed did not name',
      )
    })

    it('covered every targeted card with at least one claim', () => {
      const targeted = new Set(referenceClaims.map((c) => c.cardSlug))
      const covered = new Set(claims.map((r) => r.card_slug))
      assert.deepEqual(
        [...targeted].filter((slug) => !covered.has(slug)),
        [],
        'a card targeted by the increment has no claim',
      )
    })

    it('added no cards, leaving the corpus at its authored size', () => {
      assert.equal(counts.cards, cardCorpus.length)
      assert.equal(counts.claims, allClaims.length)
    })
  },
)
