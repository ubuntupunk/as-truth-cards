#!/usr/bin/env node
/**
 * Structural validator for the argument-chain seed.
 *
 * The project records how an argument runs; it does not adjudicate it. These checks
 * therefore enforce completeness and internal consistency only, never a preferred reading.
 * A chain that lacks a counter-step is a reporting defect, not a wrong answer, so it is
 * flagged as an error here because the engine's purpose is to expose counter-arguments.
 */
import { extractObjects, readSeed, report } from './lib/seed-parse.mjs'

const chainSource = readSeed('src/db/seed/argumentChains.ts')
const decompSource = readSeed('src/db/seed/claimDecomposition.ts')
const cardsSource = readSeed('src/db/seed/draftCards.ts')
const retroSource = readSeed('src/db/seed/identityRetrospection.ts')

/** Roles defined by the `inference_step_role` enum in drizzle/0003. */
const validRoles = new Set(['MAIN', 'COUNTER', 'ALTERNATIVE', 'CONTEXT'])

/** Relations defined by the `inference_step_relation_type` enum in drizzle/0003. */
const validRelationTypes = new Set([
  'CHALLENGES',
  'QUALIFIES',
  'ALTERNATIVE_TO',
  'DEPENDS_ON',
  'REFINES',
  'CONTEXTUALISES',
])

const errors = []
const warnings = []

const cardSlugs = new Set([
  ...extractObjects(cardsSource, 'draftCards').map((c) => c.slug),
  ...extractObjects(retroSource, 'identityRetrospectionCards').map(
    (c) => c.slug,
  ),
])

const stepLabels = new Set([
  ...extractObjects(
    decompSource,
    'claimDecompositionSeed.inferenceSteps',
    'cardSlug',
  ).map((s) => s.label),
  ...extractObjects(
    chainSource,
    'argumentChainSeed.inferenceSteps',
    'cardSlug',
  ).map((s) => s.label),
])

const chains = extractObjects(
  chainSource,
  'argumentChainSeed.chains',
  'cardSlug',
)

const relations = extractObjects(
  chainSource,
  'argumentChainSeed.stepRelations',
  'cardSlug',
)

if (chains.length === 0) errors.push('no argument chains defined')
if (relations.length === 0) errors.push('no step relations defined')

// -- Chains ------------------------------------------------------------------

const chainLabels = new Set()

for (const chain of chains) {
  const label = chain.label ?? '(unlabelled)'
  if (chainLabels.has(label)) errors.push(`chain "${label}" is defined twice.`)
  chainLabels.add(label)

  if (!chain.description) errors.push(`chain "${label}" has no description.`)
  if (!chain.epistemicStatus) {
    errors.push(
      `chain "${label}" has no epistemicStatus; chain status must be recorded.`,
    )
  }
  if (!cardSlugs.has(chain.cardSlug)) {
    errors.push(`chain "${label}" references unknown card "${chain.cardSlug}".`)
  }

  const steps = chain.steps ?? []
  if (steps.length === 0) {
    errors.push(`chain "${label}" has no steps.`)
    continue
  }

  const roles = new Set()
  for (const step of steps) {
    if (!stepLabels.has(step.inferenceLabel)) {
      errors.push(
        `chain "${label}" references undefined inference step "${step.inferenceLabel}".`,
      )
    }
    if (!validRoles.has(step.role)) {
      errors.push(`chain "${label}" has invalid step role "${step.role}".`)
    }
    roles.add(step.role)
  }

  // A chain with no MAIN step has no proposition, and one with no counter-step presents an
  // argument as if it were settled. Both defeat the engine's stated purpose.
  if (!roles.has('MAIN')) {
    errors.push(`chain "${label}" has no MAIN step.`)
  }
  if (!roles.has('COUNTER')) {
    errors.push(
      `chain "${label}" has no COUNTER step; the engine must surface counter-arguments.`,
    )
  }
  if (steps.length > 1 && roles.size === 1) {
    warnings.push(
      `chain "${label}" gives every step the same role "${[...roles][0]}".`,
    )
  }
}

// -- Step relations ----------------------------------------------------------

for (const rel of relations) {
  const name = `${rel.source} -> ${rel.target}`
  if (!stepLabels.has(rel.source)) {
    errors.push(`relation "${name}" has an undefined source step.`)
  }
  if (!stepLabels.has(rel.target)) {
    errors.push(`relation "${name}" has an undefined target step.`)
  }
  if (rel.source === rel.target) {
    errors.push(`relation "${name}" links a step to itself.`)
  }
  if (!validRelationTypes.has(rel.relationType)) {
    errors.push(`relation "${name}" has invalid type "${rel.relationType}".`)
  }
  if (!rel.description) {
    errors.push(`relation "${name}" has no description.`)
  }
  if (!cardSlugs.has(rel.cardSlug)) {
    errors.push(`relation "${name}" references unknown card "${rel.cardSlug}".`)
  }
}

// Relations must be reachable from a chain, or they are orphaned commentary.
const chainedSteps = new Set(
  chains.flatMap((c) => (c.steps ?? []).map((s) => s.inferenceLabel)),
)
const orphaned = relations.filter(
  (r) => !chainedSteps.has(r.source) || !chainedSteps.has(r.target),
)
for (const r of orphaned) {
  warnings.push(
    `relation "${r.source} -> ${r.target}" connects steps that are not both part of a chain.`,
  )
}

report(
  'validate-argument-chains',
  {
    chains: chains.length,
    stepsInChains: chains.reduce((n, c) => n + (c.steps ?? []).length, 0),
    stepRelations: relations.length,
    relationTypes: [...new Set(relations.map((r) => r.relationType))].sort(),
    inferenceStepsAvailable: stepLabels.size,
  },
  errors,
  warnings,
)
