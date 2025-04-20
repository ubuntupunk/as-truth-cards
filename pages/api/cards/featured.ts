import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Card } from '@prisma/client';
import { CardData } from '../../../src/data/cards'; // Import CardData type

const prisma = new PrismaClient();

const transformCardRecord = (card: Card): CardData => ({
  id: card.id,
  title: card.title,
  frontDescription: card.frontDescription,
  backDescription: card.backDescription,
  symbol: card.symbol,
  imageUrl: card.imageUrl ?? undefined,
  sources: card.sources as any,
  tags: card.tags,
  includedInPalestineStack: card.includedInPalestineStack,
  isFeatured: card.isFeatured,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const featuredCardRecord = await prisma.card.findFirst({
      where: {
        isFeatured: true,
      },
    });
    if (featuredCardRecord) {
      const featuredCard: CardData = transformCardRecord(featuredCardRecord);
      res.status(200).json(featuredCard);
    } else {
      res.status(404).json({ error: 'No featured card found' });
    }
  } catch (error) {
    console.error('Error fetching featured card:', error);
    res.status(500).json({ error: 'Failed to fetch featured card' });
  }
}
