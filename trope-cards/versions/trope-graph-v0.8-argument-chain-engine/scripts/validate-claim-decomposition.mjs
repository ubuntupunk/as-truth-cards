#!/usr/bin/env node

/**
 * Structural validator for exported claim-decomposition JSON.
 *
 * Expected shape:
 * {
 *   cards: [{ slug, claims: [{ slug, epistemicStatus }] }],
 *   inferenceSteps: [{ id, cardSlug, epistemicStatus, premises: [claimSlug], conclusions: [claimSlug] }]
 * }
 */

import fs from "node:fs";

const input = process.argv[2] ?? "claim-decomposition.json";
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const errors = [];
const warnings = [];

const claims = new Map();
for (const card of data.cards ?? []) {
  for (const claim of card.claims ?? []) {
    claims.set(claim.slug, { ...claim, cardSlug: card.slug });
  }
}

for (const step of data.inferenceSteps ?? []) {
  if (!step.premises?.length) errors.push(`INFERENCE_NO_PREMISES:${step.id}`);
  if (!step.conclusions?.length) errors.push(`INFERENCE_NO_CONCLUSIONS:${step.id}`);

  for (const slug of [...(step.premises ?? []), ...(step.conclusions ?? [])]) {
    if (!claims.has(slug)) errors.push(`UNKNOWN_CLAIM:${step.id}:${slug}`);
  }

  for (const slug of step.conclusions ?? []) {
    const claim = claims.get(slug);
    if (claim?.epistemicStatus === "ESTABLISHED" && !step.supportingSourceIds?.length && !step.supportingClaimIds?.length) {
      warnings.push(`ESTABLISHED_CLAIM_NO_DECLARED_SUPPORT:${slug}`);
    }
  }
}

const conclusionClaims = new Set((data.inferenceSteps ?? []).flatMap((s) => s.conclusions ?? []));
for (const claim of claims.values()) {
  if (claim.epistemicStatus === "CONTESTED" && conclusionClaims.has(claim.slug)) continue;
  if (claim.requiresInference && !conclusionClaims.has(claim.slug)) {
    warnings.push(`CLAIM_CHAIN_MISSING_INFERENCE:${claim.slug}`);
  }
}

console.log(JSON.stringify({ valid: errors.length === 0, errors, warnings }, null, 2));
process.exitCode = errors.length ? 1 : 0;
