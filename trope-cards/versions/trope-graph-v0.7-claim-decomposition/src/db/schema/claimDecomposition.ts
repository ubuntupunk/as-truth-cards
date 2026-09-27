import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const claimRelationTypeEnum = pgEnum("claim_relation_type", [
  "SUPPORTS",
  "CHALLENGES",
  "QUALIFIES",
  "CONTRADICTS",
  "CONTEXTUALISES",
  "EXEMPLIFIES",
  "REQUIRES",
  "GENERALISES",
  "EQUATES",
  "ANACHRONISTICALLY_MAPS",
  "RETROSPECTIVELY_IDENTIFIES",
]);

export const inferenceTypeEnum = pgEnum("inference_type", [
  "DEDUCTIVE",
  "INDUCTIVE",
  "ABDUCTIVE",
  "ANALOGICAL",
  "HISTORICAL_CONTINUITY",
  "RETROSPECTIVE_IDENTITY",
  "ANACHRONISTIC_MAPPING",
  "GENERALISATION",
  "EQUIVALENCE",
  "CAUSAL",
  "NORMATIVE",
  "UNSPECIFIED",
]);

export const inferencePremiseRoleEnum = pgEnum("inference_premise_role", [
  "PRIMARY",
  "CONTEXT",
  "BRIDGE",
  "COUNTERPREMISE",
]);

export const inferenceSteps = pgTable(
  "inference_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    inferenceType: inferenceTypeEnum("inference_type").notNull().default("UNSPECIFIED"),
    epistemicStatus: text("epistemic_status").notNull().default("OPEN"),
    notes: text("notes"),
    isCanonical: boolean("is_canonical").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cardIdx: index("inference_steps_card_idx").on(table.cardId),
  }),
);

export const inferencePremises = pgTable(
  "inference_premises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inferenceStepId: uuid("inference_step_id").notNull(),
    claimId: uuid("claim_id").notNull(),
    role: inferencePremiseRoleEnum("role").notNull().default("PRIMARY"),
    ordinal: integer("ordinal").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    inferenceIdx: index("inference_premises_inference_idx").on(table.inferenceStepId),
    claimIdx: index("inference_premises_claim_idx").on(table.claimId),
    uniquePremise: uniqueIndex("inference_premises_unique_idx").on(
      table.inferenceStepId,
      table.claimId,
    ),
  }),
);

export const inferenceConclusions = pgTable(
  "inference_conclusions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inferenceStepId: uuid("inference_step_id").notNull(),
    claimId: uuid("claim_id").notNull(),
    ordinal: integer("ordinal").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    inferenceIdx: index("inference_conclusions_inference_idx").on(table.inferenceStepId),
    claimIdx: index("inference_conclusions_claim_idx").on(table.claimId),
    uniqueConclusion: uniqueIndex("inference_conclusions_unique_idx").on(
      table.inferenceStepId,
      table.claimId,
    ),
  }),
);

export const claimRelations = pgTable(
  "claim_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceClaimId: uuid("source_claim_id").notNull(),
    targetClaimId: uuid("target_claim_id").notNull(),
    relationType: claimRelationTypeEnum("relation_type").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index("claim_relations_source_idx").on(table.sourceClaimId),
    targetIdx: index("claim_relations_target_idx").on(table.targetClaimId),
    relationIdx: index("claim_relations_type_idx").on(table.relationType),
    uniqueRelation: uniqueIndex("claim_relations_unique_idx").on(
      table.sourceClaimId,
      table.targetClaimId,
      table.relationType,
    ),
  }),
);
