// types/database.ts
export type InteractionType = 'VIEW' | 'SHARE' | 'FEEDBACK' | 'THUMBS_UP' | 'THUMBS_DOWN'

export interface UserInteraction {
  id: number
  createdAt: Date
  userId?: string
  cardId: number
  interactionType: InteractionType
  feedbackRating?: number
  feedbackText?: string
}

export interface InteractionCounts {
  thumbsUpCount: number
  thumbsDownCount: number
}
