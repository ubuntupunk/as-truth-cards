#!/usr/bin/env node
/**
 * Structural validator for the Trope Graph card corpus.
 *
 * The controlled vocabularies are read from src/db/seed/taxonomy.ts rather than hardcoded.
 * The archived version of this script hardcoded 12 mechanisms and `expected: 41`, so it
 * silently went stale the moment v0.5 added two mechanisms and four cards, and began
 * rejecting a valid corpus. Deriving the vocabularies removes that whole class of drift.
 */
import {
  extractObjects,
  readSeed,
  report,
  tupleSlugs,
} from './lib/seed-parse.mjs'

const taxonomy = readSeed('src/db/seed/taxonomy.ts')
const draftCardsSource = readSeed('src/db/seed/draftCards.ts')
const retroSource = readSeed('src/db/seed/identityRetrospection.ts')

/** Card types come from the `card_type` enum in drizzle/0001. */
const allowedTypes = new Set([
  'TACTIC',
  'FACT',
  'THEOLOGY',
  'CASE',
  'REFERENCE',
])

/** Epistemic statuses come from the `epistemic_status` enum in drizzle/0001. */
const allowedStatuses = new Set([
  'ESTABLISHED',
  'CONTESTED',
  'OPEN',
  'CONTEXT_DEPENDENT',
  'UNSUPPORTED',
  'LIVE',
])

/**
 * Axes come from the `card_axis` enum in drizzle/0008.
 *
 * Four values, not the three in the deck draft. HISTORICAL is authored on
 * `canaanite-card` and describes a continuity argument; the enum carries it so the
 * classification is persisted rather than quietly dropped to fit the original three.
 *
 * These are duplicated from the migration rather than derived, because this script parses
 * seed sources as text and cannot import the TypeScript enum. `test/schema-axis.test.ts`
 * asserts that this list and the `card_axis` enum agree, so the duplication cannot rot.
 */
const allowedAxes = new Set([
  'TACTIC',
  'FACT_REBUTTAL',
  'THEOLOGICAL',
  'HISTORICAL',
])

const knownMechanisms = new Set(tupleSlugs(taxonomy, 'mechanismsSeed'))
const knownConcepts = new Set(tupleSlugs(taxonomy, 'conceptsSeed'))
const knownCollections = new Set(
  [...taxonomy.matchAll(/\{\s*slug:\s*['"]([^'"]+)['"],\s*name:/g)].map(
    (m) => m[1],
  ),
)

const draftCards = extractObjects(draftCardsSource, 'draftCards')
const retroCards = extractObjects(retroSource, 'identityRetrospectionCards')
const rows = [...draftCards, ...retroCards]

const errors = []
const warnings = []
const seen = new Set()

for (const row of rows) {
  const { slug } = row
  if (seen.has(slug)) errors.push(`${slug}: duplicate slug`)
  seen.add(slug)

  if (!row.title) errors.push(`${slug}: missing title`)
  if (!allowedTypes.has(row.primaryType)) {
    errors.push(`${slug}: invalid primaryType ${row.primaryType ?? '(absent)'}`)
  }
  if (!allowedStatuses.has(row.status)) {
    errors.push(`${slug}: invalid status ${row.status ?? '(absent)'}`)
  }

  const collections = row.collection ?? []
  if (collections.length === 0) errors.push(`${slug}: no collection`)
  for (const c of collections) {
    if (!knownCollections.has(c))
      errors.push(`${slug}: unknown collection ${c}`)
  }

  for (const m of row.mechanisms ?? []) {
    if (!knownMechanisms.has(m)) errors.push(`${slug}: unknown mechanism ${m}`)
  }

  // Axis was authored on every card and read by nobody until migration 0008, so it is
  // checked as strictly as collection and mechanism: a missing, empty, misspelled, or
  // duplicated axis is an error, because each of those means a card reaches the database
  // without the rhetorical classification the editor gave it.
  const axes = row.axis ?? []
  if (axes.length === 0) {
    errors.push(
      `${slug}: no axis; a card must be classified along at least one axis`,
    )
  }
  for (const a of axes) {
    if (!allowedAxes.has(a)) errors.push(`${slug}: unknown axis ${a}`)
  }
  if (new Set(axes).size !== axes.length) {
    errors.push(`${slug}: repeated axis in [${axes.join(', ')}]`)
  }

  if (row.primaryType === 'CASE' && !collections.includes('south-africa')) {
    warnings.push(
      `${slug}: CASE outside south-africa collection; verify intentional.`,
    )
  }
  if (row.status === 'LIVE' && row.primaryType !== 'CASE') {
    warnings.push(
      `${slug}: LIVE status on non-CASE object; verify update lifecycle.`,
    )
  }
  if (
    row.primaryType === 'THEOLOGY' &&
    !(row.axis ?? []).includes('THEOLOGICAL')
  ) {
    warnings.push(`${slug}: THEOLOGY should normally carry THEOLOGICAL axis.`)
  }
  if (row.primaryType === 'TACTIC' && !(row.axis ?? []).includes('TACTIC')) {
    warnings.push(`${slug}: TACTIC should normally carry TACTIC axis.`)
  }
}

// The v0.6 cards must use the canonical kebab-case mechanism slugs. The archived v0.6 file
// used SCREAMING_SNAKE_CASE that duplicated existing taxonomy rows; consolidation merged
// them. Guard against reintroduction.
for (const row of retroCards) {
  for (const m of row.mechanisms ?? []) {
    if (m !== m.toLowerCase()) {
      errors.push(
        `${row.slug}: mechanism "${m}" is not a canonical taxonomy slug; v0.6 duplicates ` +
          `were merged into the v0.5 kebab-case set`,
      )
    }
  }
}

// A taxonomy entry nothing uses is dead weight and usually a sign of a merge that lost
// its references.
const usedMechanisms = new Set(rows.flatMap((r) => r.mechanisms ?? []))
const unusedMechanisms = [...knownMechanisms].filter(
  (m) => !usedMechanisms.has(m),
)
for (const m of unusedMechanisms) {
  warnings.push(
    `mechanism "${m}" is defined in taxonomy.ts but used by no card.`,
  )
}

const tally = (key) =>
  Object.fromEntries(
    [
      ...rows.reduce(
        (m, r) => m.set(r[key], (m.get(r[key]) ?? 0) + 1),
        new Map(),
      ),
    ].sort((a, b) => b[1] - a[1]),
  )

const mechanismUse = {}
for (const r of rows) {
  for (const m of r.mechanisms ?? [])
    mechanismUse[m] = (mechanismUse[m] ?? 0) + 1
}

report(
  'validate-draft',
  {
    corpus: {
      parsed: rows.length,
      draftCards: draftCards.length,
      identityRetrospection: retroCards.length,
    },
    vocabulary: {
      mechanisms: knownMechanisms.size,
      collections: knownCollections.size,
      concepts: knownConcepts.size,
      axes: allowedAxes.size,
    },
    types: tally('primaryType'),
    statuses: tally('status'),
    // Axis is reported separately from `types` because it is a different dimension, not a
    // refinement of it. A card may appear under several axes and one primaryType, so this
    // counts values, not cards: the two totals differ by the number of multi-axis cards.
    axes: {
      values: Object.fromEntries(
        [
          ...rows
            .flatMap((r) => r.axis ?? [])
            .reduce((m, a) => m.set(a, (m.get(a) ?? 0) + 1), new Map()),
        ].sort((a, b) => b[1] - a[1]),
      ),
      cards: rows.length,
      authored: rows.reduce((n, r) => n + (r.axis ?? []).length, 0),
      multiAxis: rows.filter((r) => (r.axis ?? []).length > 1).length,
    },
    collections: Object.fromEntries(
      [
        ...rows
          .flatMap((r) => r.collection ?? [])
          .reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map()),
      ].sort((a, b) => b[1] - a[1]),
    ),
    mechanismUse,
    unusedMechanisms,
  },
  errors,
  warnings,
)
