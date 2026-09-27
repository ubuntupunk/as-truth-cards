import { db } from "../index";
import {
  cardCollections,
  cardMechanisms,
  cards,
  collections,
  mechanisms,
} from "../schema/tropeGraph";
import { collectionsSeed, mechanismsSeed } from "./taxonomy";
import { draftCards } from "./draftCards";

/**
 * Seed the presentation-level card corpus.
 *
 * This deliberately does NOT invent claims or sources. Those are a separate
 * migration stage because the current editorial draft does not provide a
 * sufficiently normalized evidence model for every entry.
 */
export async function seedTropeGraph() {
  await db.transaction(async (tx) => {
    const collectionRows = await tx
      .insert(collections)
      .values(collectionsSeed.map((item) => item))
      .onConflictDoUpdate({
        target: collections.slug,
        set: { name: collections.name, description: collections.description },
      })
      .returning({ id: collections.id, slug: collections.slug });

    const collectionId = new Map(collectionRows.map((row) => [row.slug, row.id]));

    const mechanismRows = await tx
      .insert(mechanisms)
      .values(
        mechanismsSeed.map(([slug, name, description]) => ({
          slug,
          name,
          description,
        })),
      )
      .onConflictDoUpdate({
        target: mechanisms.slug,
        set: { name: mechanisms.name, description: mechanisms.description },
      })
      .returning({ id: mechanisms.id, slug: mechanisms.slug });

    const mechanismId = new Map(mechanismRows.map((row) => [row.slug, row.id]));

    for (const seed of draftCards) {
      const [card] = await tx
        .insert(cards)
        .values({
          slug: seed.slug,
          title: seed.title,
          summary: seed.summary,
          primaryType: seed.primaryType,
          epistemicStatus: seed.status,
          editorialNotes: seed.editorialNotes,
        })
        .onConflictDoUpdate({
          target: cards.slug,
          set: {
            title: seed.title,
            summary: seed.summary,
            primaryType: seed.primaryType,
            epistemicStatus: seed.status,
            editorialNotes: seed.editorialNotes,
            updatedAt: new Date(),
          },
        })
        .returning({ id: cards.id });

      const collectionLinks = seed.collection
        .map((slug) => collectionId.get(slug))
        .filter((id): id is string => Boolean(id))
        .map((collectionId) => ({ cardId: card.id, collectionId }));

      if (collectionLinks.length) {
        await tx
          .insert(cardCollections)
          .values(collectionLinks)
          .onConflictDoNothing();
      }

      const mechanismLinks = (seed.mechanisms ?? [])
        .map((slug) => mechanismId.get(slug))
        .filter((id): id is string => Boolean(id))
        .map((mechanismId) => ({ cardId: card.id, mechanismId }));

      if (mechanismLinks.length) {
        await tx
          .insert(cardMechanisms)
          .values(mechanismLinks)
          .onConflictDoNothing();
      }
    }
  });
}
