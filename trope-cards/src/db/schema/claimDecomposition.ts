import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  index,
  integer,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { argumentChains } from './argumentChains'
import { tropeGraph } from './namespace'
import { cards, claims } from './tropeGraph'

export const claimRelationTypeEnum = tropeGraph.enum('claim_relation_type', [
  'SUPPORTS',
  'CHALLENGES',
  'QUALIFIES',
  'CONTRADICTS',
  'CONTEXTUALISES',
  'EXEMPLIFIES',
  'REQUIRES',
  'GENERALISES',
  'EQUATES',
  'ANACHRONISTICALLY_MAPS',
  'RETROSPECTIVELY_IDENTIFIES',
])

export const inferenceTypeEnum = tropeGraph.enum('inference_type', [
  'DEDUCTIVE',
  'INDUCTIVE',
  'ABDUCTIVE',
  'ANALOGICAL',
  'HISTORICAL_CONTINUITY',
  'RETROSPECTIVE_IDENTITY',
  'ANACHRONISTIC_MAPPING',
  'GENERALISATION',
  'EQUIVALENCE',
  'CAUSAL',
  'NORMATIVE',
  'UNSPECIFIED',
])

export const inferencePremiseRoleEnum = tropeGraph.enum(
  'inference_premise_role',
  ['PRIMARY', 'CONTEXT', 'BRIDGE', 'COUNTERPREMISE'],
)

/**
 * An explicit reasoning bridge connecting premise claims to conclusion claims.
 *
 * `epistemicStatus` is typed as text rather than as the `epistemic_status` enum on
 * purpose. The status of a reasoning step is independent of the status of any claim it
 * consumes and of the status of the evidence behind it. See the "epistemic separation"
 * section of docs/CLAIM_DECOMPOSITION_ENGINE.md.
 *
 * `argumentChainId` is introduced by migration 0003 and is declared here because
 * Drizzle requires a column to be part of its table's own declaration. The explicit
 * `AnyPgColumn` return type breaks the import cycle between this module and
 * schema/argumentChains.ts, which also references inferenceSteps.
 */
export const inferenceSteps = tropeGraph.table(
  'inference_steps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    argumentChainId: uuid('argument_chain_id').references(
      (): AnyPgColumn => argumentChains.id,
      { onDelete: 'set null' },
    ),
    label: text('label').notNull(),
    description: text('description').notNull(),
    inferenceType: inferenceTypeEnum('inference_type')
      .notNull()
      .default('UNSPECIFIED'),
    epistemicStatus: text('epistemic_status').notNull().default('OPEN'),
    notes: text('notes'),
    isCanonical: boolean('is_canonical').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('inference_steps_card_idx').on(table.cardId),
    index('inference_steps_argument_chain_idx').on(table.argumentChainId),
  ],
)

export const inferencePremises = tropeGraph.table(
  'inference_premises',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inferenceStepId: uuid('inference_step_id')
      .notNull()
      .references(() => inferenceSteps.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    role: inferencePremiseRoleEnum('role').notNull().default('PRIMARY'),
    ordinal: integer('ordinal').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('inference_premises_inference_idx').on(table.inferenceStepId),
    index('inference_premises_claim_idx').on(table.claimId),
    unique('inference_premises_unique_idx').on(
      table.inferenceStepId,
      table.claimId,
    ),
  ],
)

export const inferenceConclusions = tropeGraph.table(
  'inference_conclusions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inferenceStepId: uuid('inference_step_id')
      .notNull()
      .references(() => inferenceSteps.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('inference_conclusions_inference_idx').on(table.inferenceStepId),
    index('inference_conclusions_claim_idx').on(table.claimId),
    unique('inference_conclusions_unique_idx').on(
      table.inferenceStepId,
      table.claimId,
    ),
  ],
)

export const claimRelations = tropeGraph.table(
  'claim_relations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceClaimId: uuid('source_claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    targetClaimId: uuid('target_claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    relationType: claimRelationTypeEnum('relation_type').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('claim_relations_source_idx').on(table.sourceClaimId),
    index('claim_relations_target_idx').on(table.targetClaimId),
    index('claim_relations_type_idx').on(table.relationType),
    unique('claim_relations_unique_idx').on(
      table.sourceClaimId,
      table.targetClaimId,
      table.relationType,
    ),
  ],
)
