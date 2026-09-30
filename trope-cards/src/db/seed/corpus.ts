import { draftCards } from './draftCards'
import { identityRetrospectionCards } from './identityRetrospection'
import type { CardSeed } from './types'

/**
 * The full authored card corpus: the 45-card v0.5 draft plus the two Identity Retrospection
 * cards added in v0.6. Both are already typed as `CardSeed[]`, so no widening is needed.
 *
 * This lives apart from `seed/index.ts` on purpose. The seeder imports the Drizzle client,
 * which resolves a connection string at module load, so importing the corpus from there
 * would make every reader of the authored data require a database. The seed runner and the
 * verifier both need this list, and the verifier needs it to diff authored axis against
 * persisted axis; the static test suite needs it to check the corpus with no database at
 * all.
 */
export const cardCorpus: readonly CardSeed[] = [
  ...draftCards,
  ...identityRetrospectionCards,
]
