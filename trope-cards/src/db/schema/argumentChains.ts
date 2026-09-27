import {
  index,
  integer,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { inferenceSteps } from './claimDecomposition'
import { tropeGraph } from './namespace'
import { cards } from './tropeGraph'

export const argumentChainKindEnum = tropeGraph.enum('argument_chain_kind', [
  'PRIMARY_ARGUMENT',
  'COUNTERARGUMENT',
  'ALTERNATIVE_INTERPRETATION',
  'EDITORIAL_RECONSTRUCTION',
])

export const inferenceStepRoleEnum = tropeGraph.enum('inference_step_role', [
  'MAIN',
  'COUNTER',
  'ALTERNATIVE',
  'CONTEXT',
])

export const inferenceStepRelationTypeEnum = tropeGraph.enum(
  'inference_step_relation_type',
  [
    'CHALLENGES',
    'QUALIFIES',
    'ALTERNATIVE_TO',
    'DEPENDS_ON',
    'REFINES',
    'CONTEXTUALISES',
  ],
)

/**
 * A named path through one or more inference steps.
 *
 * The engine records argument structure. It does not assign a winner, a truth score, or
 * a preferred interpretation — see the research principle in docs/ARGUMENT_CHAIN_ENGINE.md.
 *
 * `epistemicStatus` is text, not the `epistemic_status` enum, so that chain status stays
 * independent from card and claim status.
 */
export const argumentChains = tropeGraph.table(
  'argument_chains',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    description: text('description').notNull(),
    kind: argumentChainKindEnum('kind')
      .notNull()
      .default('EDITORIAL_RECONSTRUCTION'),
    epistemicStatus: text('epistemic_status').notNull().default('OPEN'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('argument_chains_card_idx').on(table.cardId)],
)

/**
 * Typed relationships between reasoning steps, including challenges and alternatives.
 */
export const inferenceStepRelations = tropeGraph.table(
  'inference_step_relations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceInferenceStepId: uuid('source_inference_step_id')
      .notNull()
      .references(() => inferenceSteps.id, { onDelete: 'cascade' }),
    targetInferenceStepId: uuid('target_inference_step_id')
      .notNull()
      .references(() => inferenceSteps.id, { onDelete: 'cascade' }),
    relationType: inferenceStepRelationTypeEnum('relation_type').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('inference_step_relations_source_idx').on(
      table.sourceInferenceStepId,
    ),
    index('inference_step_relations_target_idx').on(
      table.targetInferenceStepId,
    ),
    unique('inference_step_relations_unique_idx').on(
      table.sourceInferenceStepId,
      table.targetInferenceStepId,
      table.relationType,
    ),
  ],
)

/**
 * Ordered, typed membership of inference steps within a chain.
 */
export const argumentChainSteps = tropeGraph.table(
  'argument_chain_steps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    argumentChainId: uuid('argument_chain_id')
      .notNull()
      .references(() => argumentChains.id, { onDelete: 'cascade' }),
    inferenceStepId: uuid('inference_step_id')
      .notNull()
      .references(() => inferenceSteps.id, { onDelete: 'cascade' }),
    role: inferenceStepRoleEnum('role').notNull().default('MAIN'),
    ordinal: integer('ordinal').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('argument_chain_steps_chain_idx').on(table.argumentChainId),
    index('argument_chain_steps_inference_idx').on(table.inferenceStepId),
    unique('argument_chain_steps_unique_idx').on(
      table.argumentChainId,
      table.inferenceStepId,
    ),
  ],
)
