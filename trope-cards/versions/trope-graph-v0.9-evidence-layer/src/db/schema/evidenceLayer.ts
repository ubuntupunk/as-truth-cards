import {
  pgTable, uuid, text, timestamp, integer
} from "drizzle-orm/pg-core";

export const evidenceItems = pgTable("evidence_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  locator: text("locator"),
  locatorType: text("locator_type"),
  evidenceStatus: text("evidence_status").notNull().default("PRIMARY"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const evidenceSources = pgTable("evidence_sources", {
  evidenceId: uuid("evidence_id").notNull(),
  sourceId: uuid("source_id").notNull(),
  relation: text("relation").notNull().default("DERIVED_FROM"),
});

export const evidenceClaims = pgTable("evidence_claims", {
  evidenceId: uuid("evidence_id").notNull(),
  claimId: uuid("claim_id").notNull(),
  relation: text("relation").notNull(),
  strength: text("strength").notNull().default("UNSPECIFIED"),
  notes: text("notes"),
});

export const evidenceInterpretations = pgTable("evidence_interpretations", {
  evidenceId: uuid("evidence_id").notNull(),
  interpretationId: uuid("interpretation_id").notNull(),
  relation: text("relation").notNull(),
});

export const evidenceInferences = pgTable("evidence_inferences", {
  evidenceId: uuid("evidence_id").notNull(),
  inferenceId: uuid("inference_id").notNull(),
  relation: text("relation").notNull().default("USED_BY"),
});
