import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const argumentChainKindEnum = pgEnum("argument_chain_kind", [
  "PRIMARY_ARGUMENT",
  "COUNTERARGUMENT",
  "ALTERNATIVE_INTERPRETATION",
  "EDITORIAL_RECONSTRUCTION",
]);

export const inferenceStepRoleEnum = pgEnum("inference_step_role", [
  "MAIN",
  "COUNTER",
  "ALTERNATIVE",
  "CONTEXT",
]);

export const inferenceStepRelationTypeEnum = pgEnum("inference_step_relation_type", [
  "CHALLENGES",
  "QUALIFIES",
  "ALTERNATIVE_TO",
  "DEPENDS_ON",
  "REFINES",
  "CONTEXTUALISES",
]);

export const argumentChains = pgTable(
  "argument_chains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    kind: argumentChainKindEnum("kind").notNull().default("EDITORIAL_RECONSTRUCTION"),
    epistemicStatus: text("epistemic_status").notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cardIdx: index("argument_chains_card_idx").on(table.cardId),
  }),
);

export const inferenceStepRelations = pgTable(
  "inference_step_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceInferenceStepId: uuid("source_inference_step_id").notNull(),
    targetInferenceStepId: uuid("target_inference_step_id").notNull(),
    relationType: inferenceStepRelationTypeEnum("relation_type").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index("inference_step_relations_source_idx").on(table.sourceInferenceStepId),
    targetIdx: index("inference_step_relations_target_idx").on(table.targetInferenceStepId),
    uniqueRelation: uniqueIndex("inference_step_relations_unique_idx").on(
      table.sourceInferenceStepId,
      table.targetInferenceStepId,
      table.relationType,
    ),
  }),
);

export const argumentChainSteps = pgTable(
  "argument_chain_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    argumentChainId: uuid("argument_chain_id").notNull(),
    inferenceStepId: uuid("inference_step_id").notNull(),
    role: inferenceStepRoleEnum("role").notNull().default("MAIN"),
    ordinal: integer("ordinal").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    chainIdx: index("argument_chain_steps_chain_idx").on(table.argumentChainId),
    inferenceIdx: index("argument_chain_steps_inference_idx").on(table.inferenceStepId),
    uniqueStep: uniqueIndex("argument_chain_steps_unique_idx").on(
      table.argumentChainId,
      table.inferenceStepId,
    ),
  }),
);
