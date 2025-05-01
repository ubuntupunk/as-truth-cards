import { PrismaClient, Card, UserInteraction } from '@prisma/client' // Use path alias
import { NextResponse } from 'next/server' // Import NextResponse
import { CardData } from '../../../data/cards' // Import CardData type

const prisma = new PrismaClient()

interface CardWithInteractions extends Card {
  interactions: UserInteraction[]
}

const transformCardRecord = (card: CardWithInteractions): CardData => ({
  id: card.id,
  title: card.title,
  frontDescription: card.frontDescription,
  backDescription: card.backDescription,
  symbol: card.symbol,
  imageUrl: card.imageUrl ?? undefined,
  sources: card.sources as { text: string }[],
  tags: card.tags,
  includedInPalestineStack: card.includedInPalestineStack,
  isFeatured: card.isFeatured,
  interactions: card.interactions,
})

export async function GET() {
  // Export a GET function
  try {
    const featuredCardRecord = await prisma.card.findFirst({
      where: {
        isFeatured: true,
      },
      include: {
        interactions: true,
      },
    })
    if (featuredCardRecord) {
      const featuredCard: CardData = transformCardRecord(featuredCardRecord)
      return NextResponse.json(featuredCard) // Use NextResponse
    } else {
      return NextResponse.json({ error: 'No featured card found' }, { status: 404 }) // Use NextResponse
    }
  } catch (error) {
    console.error('Error fetching featured card:', error)
    return NextResponse.json({ error: 'Failed to fetch featured card' }, { status: 500 }) // Use NextResponse
  }
}
