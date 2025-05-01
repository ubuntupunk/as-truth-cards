import { UserInteraction } from './database'

export interface CardData {
  id: number
  title: string
  frontDescription: string
  backDescription: string
  symbol: string
  imageUrl?: string // Made optional with ?
  sources: Array<{ text: string; url?: string }>
  includedInPalestineStack: boolean
  isFeatured?: boolean
  tags?: string[] // Added tags property
  interactions: UserInteraction[];
}
