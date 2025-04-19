// services/database.ts
import { prisma } from '@/lib/db';
import type { InteractionCounts, UserInteraction } from '@/types/database';

export const cardService = {
  async getAllCards() {
    if (!prisma) return [];
    return await prisma.card.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async getFeaturedCard() {
    if (!prisma) return null;
    return await prisma.card.findFirst({
      where: {
        isFeatured: true,
      },
    });
  },

  async recordInteraction(interaction: {
    cardId: string;
    interactionType: UserInteraction['interactionType']; // use the union type
  }) {
    if (!prisma) return null;
    return await prisma.cardInteraction.create({
      data: interaction,
    });
  },
  
  async getInteractionCounts(cardId: string) {
    if (!prisma) return { thumbsUpCount: 0, thumbsDownCount: 0 };
    const thumbsUpCount = await prisma.cardInteraction.count({
      where: {
        cardId: cardId,
        interactionType: 'thumbsUp',
      },
    });

    const thumbsDownCount = await prisma.cardInteraction.count({
      where: {
        cardId: cardId,
        interactionType: 'thumbsDown',
      },
    });

    return { thumbsUpCount, thumbsDownCount };
  },

  async updateCard(id: number, updates: any) {
    if (!prisma) return null;
    return await prisma.card.update({
      where: { id },
      data: updates,
    });
  }
};
