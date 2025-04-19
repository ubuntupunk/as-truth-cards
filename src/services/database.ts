// services/database.ts
import { prisma } from '@/lib/db';
import type { InteractionCounts, UserInteraction } from '@/types/database';

export const cardService = {
  async getAllCards() {
    return await prisma.card.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async getFeaturedCard() {
    return await prisma.card.findFirst({
      where: {
        isFeatured: true,
      },
    });
  },

async recordInteraction(interaction: {
    cardId: string;
    interactionType: UserInteraction['interaction_type']; // use the union type
  }) {
    return await prisma.cardInteraction.create({
      data: interaction,
    });
  },
  
  async getInteractionCounts(cardId: string) {
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
    return await prisma.card.update({
      where: { id },
      data: updates,
    });
  }
};
