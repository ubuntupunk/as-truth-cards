#!/usr/bin/env node
/**
 * Referential-integrity validator for the claim-decomposition seed.
 *
 * The archived version of this script read a `claim-decomposition.json` export that no
 * longer existed, so it threw ENOENT and validated nothing. This version checks the seed
 * sources directly, which is where the data actually lives.
 *
 * The database enforces foreign keys, but only for rows that exist. These checks catch the
 * failures a FK cannot: bindings that name a claim slug nobody defines, inference steps
 * with no premises or no conclusions, and ordinals that do not form a sequence. All of
 * those would seed successfully and leave a reasoning structure that reads as complete
 * while silently missing part of the argument.
 */
import { extractObjects, readSeed, report } from './lib/seed-parse.mjs'

const cardsSource = readSeed('src/db/seed/draftCards.ts')
const retroSource = readSeed('src/db/seed/identityRetrospection.ts')
const newClaimsSource = readSeed('src/db/seed/newIdentityClaims.ts')
const retroClaimsSource = readSeed('src/db/seed/identityRetrospection.ts')
const decompSource = readSeed('src/db/seed/claimDecomposition.ts')
const chainSource = readSeed('src/db/seed/argumentChains.ts')

const errors = []
const warnings = []

// -- Known labels ------------------------------------------------------------

const cardSlugs = new Set([
  ...extractObjects(cardsSource, 'draftCards').map((c) => c.slug),
  ...extractObjects(retroSource, 'identityRetrospectionCards').map(
    (c) => c.slug,
  ),
])

// Only claims carrying a `slug` can be referenced by a premise or conclusion binding.
const claimSlugs = new Set(
  extractObjects(
    retroClaimsSource,
    'identityRetrospectionClaims',
    'cardSlug',
  ).map((c) => c.slug),
)
const newClaimCount = extractObjects(
  newClaimsSource,
  'newIdentityClaims',
  'cardSlug',
).length

const stepLabel = (s) => `${s.cardSlug} :: ${s.label}`
const decompSteps = extractObjects(
  decompSource,
  'claimDecompositionSeed.inferenceSteps',
  'cardSlug',
)
const chainSteps = extractObjects(
  chainSource,
  'argumentChainSeed.inferenceSteps',
  'cardSlug',
)
const stepLabels = new Set([...decompSteps, ...chainSteps].map(stepLabel))

// -- Duplicate detection -----------------------------------------------------

for (const [label, list] of [
  ['v0.7 inference step', decompSteps],
  ['v0.8 inference step', chainSteps],
]) {
  const seen = new Set()
  for (const s of list) {
    const k = stepLabel(s)
    if (seen.has(k)) errors.push(`${label} "${k}" is defined twice.`)
    seen.add(k)
  }
}

// v0.7 and v0.8 must agree wherever they overlap. The seed runner would otherwise let
// the later definition silently replace the earlier one.
const firstByKey = new Map(decompSteps.map((s) => [stepLabel(s), s]))
for (const s of chainSteps) {
  const first = firstByKey.get(stepLabel(s))
  if (!first) continue
  for (const f of ['description', 'inferenceType', 'epistemicStatus']) {
    if (first[f] !== s[f]) {
      errors.push(
        `inference step "${stepLabel(s)}" is defined differently in v0.7 and v0.8 ` +
          `(${f}: "${first[f]}" vs "${s[f]}"). Reconcile before seeding.`,
      )
    }
  }
}

const seenClaims = new Set()
for (const c of extractObjects(
  retroClaimsSource,
  'identityRetrospectionClaims',
  'cardSlug',
)) {
  if (seenClaims.has(c.slug))
    errors.push(`claim slug "${c.slug}" is defined twice.`)
  seenClaims.add(c.slug)
}

// -- Bindings ----------------------------------------------------------------

/** Premise and conclusion bindings appear as arrays of { claimSlug, ordinal }. */
function bindingRefs(field) {
  const refs = []
  for (const m of decompSource.matchAll(
    new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\]`, 'g'),
  )) {
    for (const c of m[1].matchAll(/claimSlug:\s*['"]([^'"]+)['"]/g))
      refs.push(c[1])
  }
  return refs
}

const premiseRefs = bindingRefs('premises')
const conclusionRefs = bindingRefs('conclusions')

if (premiseRefs.length === 0) {
  errors.push(
    'no premise bindings found; the claim-decomposition seed may be empty',
  )
}
if (conclusionRefs.length === 0) {
  errors.push(
    'no conclusion bindings found; the claim-decomposition seed may be empty',
  )
}

for (const ref of new Set([...premiseRefs, ...conclusionRefs])) {
  if (!claimSlugs.has(ref)) {
    errors.push(
      `binding references claim "${ref}", which no seed file defines.`,
    )
  }
}

for (const ref of premiseRefs) {
  if (conclusionRefs.includes(ref)) {
    warnings.push(`claim "${ref}" is used as both a premise and a conclusion.`)
  }
}

// -- Unreferenced claims -----------------------------------------------------

const referenced = new Set([...premiseRefs, ...conclusionRefs])
const unreferenced = [...claimSlugs].filter((s) => !referenced.has(s))
for (const s of unreferenced) {
  warnings.push(`claim "${s}" is defined but never bound to an inference step.`)
}

// -- Card and step references ------------------------------------------------

for (const s of [...decompSteps, ...chainSteps]) {
  if (!cardSlugs.has(s.cardSlug)) {
    errors.push(
      `inference step "${s.label}" references unknown card "${s.cardSlug}".`,
    )
  }
  if (!s.inferenceType)
    errors.push(`inference step "${s.label}" has no inferenceType.`)
  if (!s.epistemicStatus) {
    errors.push(`inference step "${s.label}" has no epistemicStatus.`)
  }
}

// -- Ordinals ----------------------------------------------------------------

for (const [name, pattern] of [
  ['premises', () => /premises:\s*\[([\s\S]*?)\]/g],
  ['conclusions', () => /conclusions:\s*\[([\s\S]*?)\]/g],
  ['steps', () => /steps:\s*\[([\s\S]*?)\n\s*\]/g],
]) {
  for (const src of [decompSource, chainSource]) {
    for (const m of src.matchAll(pattern())) {
      const ordinals = [...m[1].matchAll(/ordinal:\s*(\d+)/g)].map((x) =>
        Number(x[1]),
      )
      if (ordinals.length === 0) continue
      const unique = [...new Set(ordinals)].sort((a, b) => a - b)
      const contiguous = unique.every((v, i) => v === unique[0] + i)
      if (!contiguous) {
        errors.push(`${name} ordinals are not contiguous: ${unique.join(', ')}`)
      }
      if (new Set(ordinals).size !== ordinals.length) {
        errors.push(`${name} has duplicate ordinals: ${ordinals.join(', ')}`)
      }
    }
  }
}

report(
  'validate-claim-decomposition',
  {
    cards: cardSlugs.size,
    claimsWithSlugs: claimSlugs.size,
    claimsWithoutSlugs: newClaimCount,
    inferenceSteps: stepLabels.size,
    premiseBindings: premiseRefs.length,
    conclusionBindings: conclusionRefs.length,
    unreferencedClaims: unreferenced,
  },
  errors,
  warnings,
)
