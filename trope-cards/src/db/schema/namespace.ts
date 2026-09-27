import { pgSchema } from 'drizzle-orm/pg-core'

/**
 * The PostgreSQL schema that owns every Trope Graph object.
 *
 * The host application keeps its own `cards` table in `public`, managed by Prisma
 * (integer primary key, deck presentation content, foreign key from
 * `user_interactions`). A Trope Graph `cards` row is a different entity: a research
 * card keyed by uuid and slug, carrying epistemic status and mechanism links. Both
 * existed in the v0.1 design and the v0.1 migration would have failed outright against
 * the live database had it been applied as written.
 *
 * Isolating the graph in its own schema keeps the two card concepts distinct and means
 * the graph can be dropped, re-migrated, or shipped to a different database without
 * touching the deck application. If the two ever need to be linked, do it with an
 * explicit bridge column rather than by merging the tables.
 */
export const tropeGraph = pgSchema('trope_graph')
