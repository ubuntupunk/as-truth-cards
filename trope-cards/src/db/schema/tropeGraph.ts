import { sql } from 'drizzle-orm'
import {
  customType,
  date,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { tropeGraph } from './namespace'

/**
 * A PostgreSQL `tsvector` column for full-text search.
 *
 * `drizzle-orm` has no first-class `tsvector` type, so this maps the column to the
 * database's `tsvector` type. The value is never read into or written from JavaScript
 * directly — the search query runs through raw SQL — so the `data`/`driverData` strings
 * exist only to satisfy the column's runtime shape.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector'
  },
})

export const cardType = tropeGraph.enum('card_type', [
  'TACTIC',
  'FACT',
  'THEOLOGY',
  'CASE',
  'REFERENCE',
])

/**
 * The rhetorical/argumentative axis of a card: what work the card does in an argument.
 *
 * Deliberately NOT the same vocabulary as {@link cardType}. A card's axis answers "how
 * is this card arguing?", while `cardType` answers "what shape is this content?". The
 * two overlap by accident, not by construction: `holocaust-denial-distortion` is
 * `cardType` FACT on axis FACT_REBUTTAL, `canaanite-card` is `cardType` REFERENCE on two
 * axes, and 18 of 47 cards carry axis TACTIC against 13 of `cardType` TACTIC. Treating
 * one as a projection of the other loses the distinction, so both are persisted.
 *
 * A fixed `pgEnum`, not a taxonomy table like `mechanisms` or `collections`. The axis
 * drives fixed-vocabulary presentation (each value has one icon), so the set is closed;
 * an open table would let the vocabulary drift without a migration and would create a
 * second place to keep the labels in sync.
 *
 * HISTORICAL is a fourth axis alongside the deck's original three
 * (Tactic-Naming / Fact-Rebuttal / Theological-Dispute). It is authored on
 * `canaanite-card` in seed/identityRetrospection.ts and is what that card is: a
 * continuity argument. Dropping it to fit the original three would discard an editorial
 * classification. It is not a `claim_type` member despite sharing a name with one.
 *
 * Axis is never derived from, or allowed to imply, epistemic status or suit. 21 of the
 * 47 seeded cards are `CONTESTED` across all four axes.
 */
export const cardAxis = tropeGraph.enum('card_axis', [
  'TACTIC',
  'FACT_REBUTTAL',
  'THEOLOGICAL',
  'HISTORICAL',
])

export const epistemicStatus = tropeGraph.enum('epistemic_status', [
  'ESTABLISHED',
  'CONTESTED',
  'OPEN',
  'CONTEXT_DEPENDENT',
  'UNSUPPORTED',
  'LIVE',
])

export const claimType = tropeGraph.enum('claim_type', [
  'DESCRIPTIVE',
  'HISTORICAL',
  'EMPIRICAL',
  'LEGAL',
  'THEOLOGICAL',
  'INTERPRETIVE',
  'RHETORICAL',
])

export const sourceType = tropeGraph.enum('source_type', [
  'PRIMARY_DOCUMENT',
  'JUDGMENT',
  'PLEADING',
  'LEGISLATION',
  'INSTITUTIONAL',
  'ACADEMIC',
  'BOOK',
  'JOURNALISM',
  'ARCHIVE',
  'OTHER',
])

export const caseStatus = tropeGraph.enum('case_status', [
  'HISTORICAL',
  'ACTIVE',
  'RESOLVED',
  'APPEAL_PENDING',
  'UPDATE_REQUIRED',
])

export const questionStatus = tropeGraph.enum('question_status', [
  'OPEN',
  'ANSWERED',
  'PARTIALLY_ANSWERED',
  'SUPERSEDED',
])

export const contributionStatus = tropeGraph.enum('contribution_status', [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'SUPERSEDED',
])

export const contributionType = tropeGraph.enum('contribution_type', [
  'SOURCE',
  'CASE',
  'QUESTION',
  'RELATIONSHIP',
  'CORRECTION',
  'INTERPRETATION',
  'NOTE',
])

export const researchEventType = tropeGraph.enum('research_event_type', [
  'CARD_VIEWED',
  'CLAIM_OPENED',
  'SOURCE_OPENED',
  'CASE_OPENED',
  'QUESTION_VIEWED',
  'BRANCH_FOLLOWED',
  'SOURCE_SUBMITTED',
  'CASE_SUBMITTED',
  'QUESTION_SUBMITTED',
  'RELATIONSHIP_PROPOSED',
  'CORRECTION_SUBMITTED',
  'NOTE_ADDED',
])

export const relationshipType = tropeGraph.enum('relationship_type', [
  'PREDECESSOR',
  'RELATED',
  'SIMILAR_MECHANISM',
  'SUPPORTS',
  'CHALLENGES',
  'COMPETING_INTERPRETATION',
  'CONTEXTUALISES',
  'EXAMPLE_OF',
  'DERIVED_FROM',
  'CONTRADICTS',
])

export const relationshipStatus = tropeGraph.enum('relationship_status', [
  'CANONICAL',
  'PROPOSED',
  'REJECTED',
  'SUPERSEDED',
])

/**
 * A research card: the editorial entry point into the graph.
 *
 * `primaryType` is LEGACY content-shape classification, not rhetorical function and not a
 * projection of {@link cardAxes}. It predates the axis dimension, it overlaps it only by
 * accident (see {@link cardAxis}), and as of this migration nothing reads it: the graph
 * is not served by an API or the frontend bundle, so it is write-only. It is retained
 * because dropping a populated authored column would be the same silent data loss this
 * schema exists to prevent, and because `validate-draft.mjs` and the seeder still
 * validate it. It is explicitly NOT the source for a primary axis — that is
 * `card_axes.ordinal = 0`. Do not derive axis from this field, and do not expect the two
 * to agree.
 */
export const cards = tropeGraph.table(
  'cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    summary: text('summary'),
    primaryType: cardType('primary_type').notNull(),
    epistemicStatus: epistemicStatus('epistemic_status').notNull(),
    trigger: text('trigger'),
    coreQuestion: text('core_question'),
    mechanismSummary: text('mechanism_summary'),
    counterTest: text('counter_test'),
    editorialNotes: text('editorial_notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', replace(coalesce(slug, ''), '-', ' ')), 'B') || setweight(to_tsvector('english', coalesce(core_question, '') || ' ' || coalesce(summary, '')), 'C') || setweight(to_tsvector('english', coalesce(mechanism_summary, '')), 'D')`,
    ),
  },
  (table) => [
    index('cards_search_vector_gin_idx').using('gin', table.searchVector),
    index('cards_title_trgm_idx').using(
      'gin',
      sql`${table.title} gin_trgm_ops`,
    ),
    index('cards_slug_trgm_idx').using('gin', sql`${table.slug} gin_trgm_ops`),
  ],
)

export const collections = tropeGraph.table('collections', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
})

export const cardCollections = tropeGraph.table(
  'card_collections',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.collectionId] })],
)

export const mechanisms = tropeGraph.table('mechanisms', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
})

export const cardMechanisms = tropeGraph.table(
  'card_mechanisms',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    mechanismId: uuid('mechanism_id')
      .notNull()
      .references(() => mechanisms.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.mechanismId] })],
)

export const locales = tropeGraph.table('locales', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
})

export const cardLocales = tropeGraph.table(
  'card_locales',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    localeId: uuid('locale_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.localeId] })],
)

/**
 * The rhetorical axes a card is argued along, in authored order.
 *
 * A card carries at least one axis and may carry several. Multi-axis is the point rather
 * than a modelling inconvenience: a card can be both a rhetorical tactic and a
 * theological dispute, and a single-valued column could not represent that.
 *
 * `ordinal` preserves the order the axes were authored in, and ordinal 0 is by
 * construction the card's primary axis. This is the designated-primary mechanism the
 * migration required, and it is independent of {@link cards.primaryType} — the unique
 * index on (card_id, ordinal) is what makes "exactly one primary axis" a schema
 * invariant rather than an editorial convention nobody checks. Note that it is a
 * constraint on uniqueness, not completeness: the schema permits a card to have no
 * `card_axes` row at all, which is why the seeder and the validators reject that case
 * rather than relying on the database.
 *
 * `unique (card_id, axis)` and `unique (card_id, ordinal)` are both needed, and each covers
 * a hole the other leaves. `unique (card_id, axis)` alone permits two different axes to sit
 * at the same ordinal, so the primary axis would be ambiguous. `unique (card_id, ordinal)`
 * alone permits the same axis twice on one card at different ordinals, so a duplicated
 * classification would pass unnoticed.
 */
export const cardAxes = tropeGraph.table(
  'card_axes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    axis: cardAxis('axis').notNull(),
    /** 0 is the primary axis. See the note on designated primary above. */
    ordinal: integer('ordinal').notNull().default(0),
  },
  (table) => [
    index('card_axes_card_idx').on(table.cardId),
    unique('card_axes_card_axis_unique_idx').on(table.cardId, table.axis),
    unique('card_axes_card_ordinal_unique_idx').on(table.cardId, table.ordinal),
  ],
)

export const claims = tropeGraph.table(
  'claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    statement: text('statement').notNull(),
    claimType: claimType('claim_type').notNull(),
    description: text('description'),
    epistemicStatus: epistemicStatus('epistemic_status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('claims_card_idx').on(table.cardId),
    // A card cannot carry the same claim statement twice. See
    // drizzle/0007_claim_and_relationship_uniqueness.sql.
    unique('claims_card_statement_unique_idx').on(
      table.cardId,
      table.statement,
    ),
  ],
)

export const sources = tropeGraph.table(
  'sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    author: text('author'),
    publisher: text('publisher'),
    publicationDate: date('publication_date'),
    sourceType: sourceType('source_type').notNull(),
    url: text('url'),
    archiveUrl: text('archive_url'),
    citation: text('citation'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('sources_title_idx').on(table.title)],
)

export const claimSources = tropeGraph.table(
  'claim_sources',
  {
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    relationship: text('relationship').notNull(),
    quoteOrExcerpt: text('quote_or_excerpt'),
    pageReference: text('page_reference'),
    notes: text('notes'),
  },
  (table) => [primaryKey({ columns: [table.claimId, table.sourceId] })],
)

export const cases = tropeGraph.table(
  'cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    dateStart: date('date_start'),
    dateEnd: date('date_end'),
    location: text('location'),
    description: text('description'),
    status: caseStatus('status').notNull(),
  },
  (table) => [index('cases_title_idx').on(table.title)],
)

export const caseLegalMetadata = tropeGraph.table('case_legal_metadata', {
  caseId: uuid('case_id')
    .primaryKey()
    .references(() => cases.id, { onDelete: 'cascade' }),
  court: text('court'),
  caseNumber: text('case_number'),
  judgmentDate: date('judgment_date'),
  proceduralPosture: text('procedural_posture'),
  currentStatus: text('current_status'),
})

export const cardCases = tropeGraph.table(
  'card_cases',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.caseId] })],
)

export const concepts = tropeGraph.table('concepts', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  definition: text('definition'),
})

export const cardConcepts = tropeGraph.table(
  'card_concepts',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    relationship: text('relationship'),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.conceptId] })],
)

export const interpretations = tropeGraph.table('interpretations', {
  id: uuid('id').defaultRandom().primaryKey(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: epistemicStatus('status').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/**
 * Attaches an interpretation to one specific claim rather than only to its card.
 *
 * Specified in v0.3, referenced by v0.6/v0.7/v0.8 as an existing structure, but
 * absent from every migration until 0005. See drizzle/0005_claim_interpretations.sql.
 */
export const claimInterpretations = tropeGraph.table(
  'claim_interpretations',
  {
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    interpretationId: uuid('interpretation_id')
      .notNull()
      .references(() => interpretations.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.claimId, table.interpretationId] }),
    index('claim_interpretations_claim_idx').on(table.claimId),
    index('claim_interpretations_interpretation_idx').on(
      table.interpretationId,
    ),
  ],
)

export const interpretationSources = tropeGraph.table(
  'interpretation_sources',
  {
    interpretationId: uuid('interpretation_id')
      .notNull()
      .references(() => interpretations.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    relationship: text('relationship'),
    notes: text('notes'),
  },
  (table) => [
    primaryKey({ columns: [table.interpretationId, table.sourceId] }),
  ],
)

export const questions = tropeGraph.table('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  question: text('question').notNull(),
  description: text('description'),
  status: questionStatus('status').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const questionCards = tropeGraph.table(
  'question_cards',
  {
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.cardId] })],
)

export const questionClaims = tropeGraph.table(
  'question_claims',
  {
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.claimId] })],
)

export const questionSources = tropeGraph.table(
  'question_sources',
  {
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.sourceId] })],
)

export const relationships = tropeGraph.table(
  'relationships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fromEntityType: text('from_entity_type').notNull(),
    fromEntityId: uuid('from_entity_id').notNull(),
    relationshipType: relationshipType('relationship_type').notNull(),
    toEntityType: text('to_entity_type').notNull(),
    toEntityId: uuid('to_entity_id').notNull(),
    description: text('description'),
    status: relationshipStatus('status').notNull().default('CANONICAL'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('relationships_from_idx').on(
      table.fromEntityType,
      table.fromEntityId,
    ),
    index('relationships_to_idx').on(table.toEntityType, table.toEntityId),
    // Identical typed edges are duplicates. `status` is part of the key so a PROPOSED
    // edge and its CANONICAL replacement can coexist.
    // See drizzle/0007_claim_and_relationship_uniqueness.sql.
    unique('relationships_edge_unique_idx').on(
      table.fromEntityType,
      table.fromEntityId,
      table.relationshipType,
      table.toEntityType,
      table.toEntityId,
      table.status,
    ),
  ],
)

export const researchEvents = tropeGraph.table(
  'research_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    eventType: researchEventType('event_type').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('research_events_user_created_idx').on(table.userId, table.createdAt),
  ],
)

export const contributions = tropeGraph.table(
  'contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    contributionType: contributionType('contribution_type').notNull(),
    content: jsonb('content').notNull(),
    status: contributionStatus('status').notNull().default('PENDING'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('contributions_status_idx').on(table.status)],
)

export const cardVersions = tropeGraph.table(
  'card_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    content: jsonb('content').notNull(),
    changedBy: text('changed_by'),
    changeReason: text('change_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('card_versions_card_version_uq').on(
      table.cardId,
      table.versionNumber,
    ),
  ],
)
