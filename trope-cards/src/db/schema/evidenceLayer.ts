import { index, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { inferenceSteps } from './claimDecomposition'
import { tropeGraph } from './namespace'
import { claims, interpretations, sources } from './tropeGraph'

/**
 * A located, inspectable portion or observation derived from a source.
 *
 * A source is a bibliographic object. An evidence item is the specific passage, data
 * point, or documentary feature that a claim actually rests on. Evidence is not
 * equivalent to truth: it records what a source contains and the relationship asserted
 * between that material and a proposition.
 *
 * `type` vocabulary (docs/EVIDENCE_LAYER.md):
 *   QUOTATION, PARAPHRASE, DATA_POINT, DOCUMENT_FEATURE, IMAGE_FEATURE, TESTIMONY,
 *   SECONDARY_ASSESSMENT
 *
 * `evidenceStatus` describes this evidence item only. It is deliberately a separate
 * field from `claims.epistemicStatus` and from `inferenceSteps.epistemicStatus`; the
 * three are never collapsed into one.
 */
export const evidenceItems = tropeGraph.table(
  'evidence_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    locator: text('locator'),
    locatorType: text('locator_type'),
    evidenceStatus: text('evidence_status').notNull().default('PRIMARY'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('evidence_items_type_idx').on(table.type),
    index('evidence_items_status_idx').on(table.evidenceStatus),
  ],
)

export const evidenceSources = tropeGraph.table(
  'evidence_sources',
  {
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidenceItems.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull().default('DERIVED_FROM'),
  },
  (table) => [primaryKey({ columns: [table.evidenceId, table.sourceId] })],
)

/**
 * The evidential relation asserted between an evidence item and a claim.
 *
 * `relation` vocabulary: SUPPORTS, CHALLENGES, QUALIFIES, CONTEXTUALISES, ILLUSTRATES,
 * REPORTS, ATTRIBUTES. These describe the relation the editor asserts. They do not by
 * themselves determine whether the claim is true.
 */
export const evidenceClaims = tropeGraph.table(
  'evidence_claims',
  {
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidenceItems.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull(),
    strength: text('strength').notNull().default('UNSPECIFIED'),
    notes: text('notes'),
  },
  (table) => [
    primaryKey({ columns: [table.evidenceId, table.claimId] }),
    index('evidence_claims_claim_idx').on(table.claimId),
  ],
)

export const evidenceInterpretations = tropeGraph.table(
  'evidence_interpretations',
  {
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidenceItems.id, { onDelete: 'cascade' }),
    interpretationId: uuid('interpretation_id')
      .notNull()
      .references(() => interpretations.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.evidenceId, table.interpretationId] }),
  ],
)

/**
 * Records that an inference step cites an evidence item. Citing evidence does not
 * promote the inference's conclusion to ESTABLISHED.
 */
export const evidenceInferences = tropeGraph.table(
  'evidence_inferences',
  {
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidenceItems.id, { onDelete: 'cascade' }),
    inferenceId: uuid('inference_id')
      .notNull()
      .references(() => inferenceSteps.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull().default('USED_BY'),
  },
  (table) => [
    primaryKey({ columns: [table.evidenceId, table.inferenceId] }),
    index('evidence_inferences_inference_idx').on(table.inferenceId),
  ],
)
