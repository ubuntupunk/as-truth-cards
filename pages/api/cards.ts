import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Card } from '@prisma/client';
import { CardData } from '../../src/data/cards'; // Import CardData type
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

const transformCardRecord = (card: Card): CardData => {
  console.log("Card:", card);
  return {
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
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const cardRecords = await prisma.card.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    const cards: CardData[] = cardRecords.map(transformCardRecord);
    res.status(200).json(cards);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
}
