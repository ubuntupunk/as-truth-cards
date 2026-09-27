import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const cardType = pgEnum("card_type", [
  "TACTIC",
  "FACT",
  "THEOLOGY",
  "CASE",
  "REFERENCE",
]);

export const epistemicStatus = pgEnum("epistemic_status", [
  "ESTABLISHED",
  "CONTESTED",
  "OPEN",
  "CONTEXT_DEPENDENT",
  "UNSUPPORTED",
  "LIVE",
]);

export const claimType = pgEnum("claim_type", [
  "DESCRIPTIVE",
  "HISTORICAL",
  "EMPIRICAL",
  "LEGAL",
  "THEOLOGICAL",
  "INTERPRETIVE",
  "RHETORICAL",
]);

export const sourceType = pgEnum("source_type", [
  "PRIMARY_DOCUMENT",
  "JUDGMENT",
  "PLEADING",
  "LEGISLATION",
  "INSTITUTIONAL",
  "ACADEMIC",
  "BOOK",
  "JOURNALISM",
  "ARCHIVE",
  "OTHER",
]);

export const caseStatus = pgEnum("case_status", [
  "HISTORICAL",
  "ACTIVE",
  "RESOLVED",
  "APPEAL_PENDING",
  "UPDATE_REQUIRED",
]);

export const questionStatus = pgEnum("question_status", [
  "OPEN",
  "ANSWERED",
  "PARTIALLY_ANSWERED",
  "SUPERSEDED",
]);

export const contributionStatus = pgEnum("contribution_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
]);

export const contributionType = pgEnum("contribution_type", [
  "SOURCE",
  "CASE",
  "QUESTION",
  "RELATIONSHIP",
  "CORRECTION",
  "INTERPRETATION",
  "NOTE",
]);

export const researchEventType = pgEnum("research_event_type", [
  "CARD_VIEWED",
  "CLAIM_OPENED",
  "SOURCE_OPENED",
  "CASE_OPENED",
  "QUESTION_VIEWED",
  "BRANCH_FOLLOWED",
  "SOURCE_SUBMITTED",
  "CASE_SUBMITTED",
  "QUESTION_SUBMITTED",
  "RELATIONSHIP_PROPOSED",
  "CORRECTION_SUBMITTED",
  "NOTE_ADDED",
]);

export const relationshipType = pgEnum("relationship_type", [
  "PREDECESSOR",
  "RELATED",
  "SIMILAR_MECHANISM",
  "SUPPORTS",
  "CHALLENGES",
  "COMPETING_INTERPRETATION",
  "CONTEXTUALISES",
  "EXAMPLE_OF",
  "DERIVED_FROM",
  "CONTRADICTS",
]);

export const relationshipStatus = pgEnum("relationship_status", [
  "CANONICAL",
  "PROPOSED",
  "REJECTED",
  "SUPERSEDED",
]);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    primaryType: cardType("primary_type").notNull(),
    epistemicStatus: epistemicStatus("epistemic_status").notNull(),
    trigger: text("trigger"),
    mechanismSummary: text("mechanism_summary"),
    counterTest: text("counter_test"),
    editorialNotes: text("editorial_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("cards_slug_uq").on(table.slug)],
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (table) => [uniqueIndex("collections_slug_uq").on(table.slug)],
);

export const cardCollections = pgTable(
  "card_collections",
  {
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.collectionId] })],
);

export const mechanisms = pgTable(
  "mechanisms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (table) => [uniqueIndex("mechanisms_slug_uq").on(table.slug)],
);

export const cardMechanisms = pgTable(
  "card_mechanisms",
  {
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    mechanismId: uuid("mechanism_id").notNull().references(() => mechanisms.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.mechanismId] })],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    claimType: claimType("claim_type").notNull(),
    description: text("description"),
    epistemicStatus: epistemicStatus("epistemic_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("claims_card_idx").on(table.cardId)],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    author: text("author"),
    publisher: text("publisher"),
    publicationDate: date("publication_date"),
    sourceType: sourceType("source_type").notNull(),
    url: text("url"),
    archiveUrl: text("archive_url"),
    citation: text("citation"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("sources_title_idx").on(table.title)],
);

export const claimSources = pgTable(
  "claim_sources",
  {
    claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(),
    quoteOrExcerpt: text("quote_or_excerpt"),
    pageReference: text("page_reference"),
    notes: text("notes"),
  },
  (table) => [primaryKey({ columns: [table.claimId, table.sourceId] })],
);

export const cases = pgTable(
  "cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    dateStart: date("date_start"),
    dateEnd: date("date_end"),
    location: text("location"),
    description: text("description"),
    status: caseStatus("status").notNull(),
  },
  (table) => [index("cases_title_idx").on(table.title)],
);

export const caseLegalMetadata = pgTable(
  "case_legal_metadata",
  {
    caseId: uuid("case_id").primaryKey().references(() => cases.id, { onDelete: "cascade" }),
    court: text("court"),
    caseNumber: text("case_number"),
    judgmentDate: date("judgment_date"),
    proceduralPosture: text("procedural_posture"),
    currentStatus: text("current_status"),
  },
);

export const cardCases = pgTable(
  "card_cases",
  {
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.caseId] })],
);

export const concepts = pgTable(
  "concepts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    definition: text("definition"),
  },
  (table) => [uniqueIndex("concepts_slug_uq").on(table.slug)],
);

export const cardConcepts = pgTable(
  "card_concepts",
  {
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id").notNull().references(() => concepts.id, { onDelete: "cascade" }),
    relationship: text("relationship"),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.conceptId] })],
);

export const interpretations = pgTable("interpretations", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: epistemicStatus("status").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const interpretationSources = pgTable(
  "interpretation_sources",
  {
    interpretationId: uuid("interpretation_id").notNull().references(() => interpretations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    relationship: text("relationship"),
    notes: text("notes"),
  },
  (table) => [primaryKey({ columns: [table.interpretationId, table.sourceId] })],
);

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  question: text("question").notNull(),
  description: text("description"),
  status: questionStatus("status").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const questionCards = pgTable(
  "question_cards",
  {
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.cardId] })],
);

export const questionClaims = pgTable(
  "question_claims",
  {
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.claimId] })],
);

export const questionSources = pgTable(
  "question_sources",
  {
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.sourceId] })],
);

export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromEntityType: text("from_entity_type").notNull(),
    fromEntityId: uuid("from_entity_id").notNull(),
    relationshipType: relationshipType("relationship_type").notNull(),
    toEntityType: text("to_entity_type").notNull(),
    toEntityId: uuid("to_entity_id").notNull(),
    description: text("description"),
    status: relationshipStatus("status").notNull().default("CANONICAL"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("relationships_from_idx").on(table.fromEntityType, table.fromEntityId),
    index("relationships_to_idx").on(table.toEntityType, table.toEntityId),
  ],
);

export const researchEvents = pgTable(
  "research_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    eventType: researchEventType("event_type").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("research_events_user_created_idx").on(table.userId, table.createdAt)],
);

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    contributionType: contributionType("contribution_type").notNull(),
    content: jsonb("content").notNull(),
    status: contributionStatus("status").notNull().default("PENDING"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("contributions_status_idx").on(table.status)],
);

export const cardVersions = pgTable(
  "card_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: jsonb("content").notNull(),
    changedBy: text("changed_by"),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("card_versions_card_version_uq").on(table.cardId, table.versionNumber)],
);
