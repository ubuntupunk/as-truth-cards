// types/database.ts
export type InteractionType =
  | 'VIEW'
  | 'SHARE'
  | 'FEEDBACK'
  | 'THUMBS_UP'
  | 'THUMBS_DOWN'
  | 'RATING_UP'
  | 'RATING_DOWN'
  | 'STRUCTURED_FEEDBACK'
  | 'BOOKMARK'
  | 'REPORT'
  | 'ACADEMIC_FEEDBACK'
  | 'COMMENT'
  | 'FLAG'

import type { UserInteraction as PrismaUserInteraction } from '@prisma/client'

export type UserInteraction = PrismaUserInteraction

export interface InteractionCounts {
  thumbsUpCount: number
  thumbsDownCount: number
}
