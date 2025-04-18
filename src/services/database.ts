// services/database.ts
import { prisma } from '@/lib/db';
import type { Card, UserInteraction } from '@prisma/client';

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
    userId?: string;
    cardId: number;
    interactionType: string;
    feedbackRating?: number;
    feedbackText?: string;
  }) {
    return await prisma.userInteraction.create({
      data: interaction,
    });
  },

  async updateCard(id: number, updates: Partial<Card>) {
    return await prisma.card.update({
      where: { id },
      data: updates,
    });
  }
};
