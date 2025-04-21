// services/database.ts
import type { InteractionCounts, UserInteraction } from '@/types/database'
import type { CardData } from '@/types/cards'

export const cardService = {
  async getAllCards() {
    return []
  },

  async getFeaturedCard() {
    return null
  },

  async recordInteraction(interaction: {
    cardId: string
    interactionType: UserInteraction['interactionType'] // use the union type
  }) {
    return null
  },

  async getInteractionCounts(cardId: string) {
    return { thumbsUpCount: 0, thumbsDownCount: 0 }
  },

  async updateCard(id: number, updates: Partial<CardData>) {
    return null
  },
}
