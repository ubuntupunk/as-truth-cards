import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient, Card } from '@prisma/client';
import { CardData } from '../src/data/cards'; // Import CardData type

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
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const cardRecords = await prisma.card.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    const cards: CardData[] = cardRecords.map(transformCardRecord);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.status(200).json(JSON.stringify(cards));
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
}
