import { PrismaClient, AccessLevel, UserRole } from '@prisma/client';
import { NextResponse } from 'next/server'; // Import NextResponse
import { CardData } from '../../../types/cards'
import { stackServerApp } from '../../../stack/server';
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

type Card = {
  id: number;
  createdAt: Date;
  title: string;
  frontDescription: string;
  backDescription: string;
  symbol: string;
  imageUrl?: string;
  tags: string[];
  includedInPalestineStack: boolean;
  isFeatured: boolean;
  sources?: any; // Using any for Json type
  interactions: any[]; // Using any for UserInteraction[] type
};

const prisma = new PrismaClient()

// Helper function to transform Prisma Card record to CardData type
const transformCardRecord = (card: Card): CardData => {
  return {
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
  }
}

// GET
export async function GET() {
  try {
    const cardRecords = await prisma.card.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })
    const cards: CardData[] = cardRecords.map(transformCardRecord)
    return NextResponse.json(cards);
  } catch (error: any) {
    console.error(`Error handling GET request:`, error)
    return NextResponse.json({ error: `Failed to handle GET request` }, { status: 500 });
  }
}

// POST
export async function POST(req: Request) {
  try {
    const user = await stackServerApp.getUser()
    console.log('User object:', user)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Not logged in' }, { status: 401 });
    }
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    const newCardData = await req.json() as Omit<CardData, 'id'>;
    const createdCardRecord = await prisma.card.create({
      data: {
        ...newCardData,
        sources: newCardData.sources || [],
        tags: newCardData.tags || [],
      },
    })
    return NextResponse.json(transformCardRecord(createdCardRecord), { status: 201 });
  } catch (error: any) {
    console.error(`Error handling POST request:`, error)
    return NextResponse.json({ error: `Failed to handle POST request` }, { status: 500 });
  }
}

// PUT
export async function PUT(req: Request) {
  try {
    const user = await stackServerApp.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Not logged in' }, { status: 401 });
    }
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    const updatedCardData = await req.json() as CardData;
    if (!updatedCardData.id) {
      return NextResponse.json({ error: 'Bad Request: Card ID is required for update' }, { status: 400 });
    }
    const updatedCardRecord = await prisma.card.update({
      where: { id: updatedCardData.id },
      data: {
        ...updatedCardData,
        id: undefined,
        sources: updatedCardData.sources || [],
        tags: updatedCardData.tags || [],
      },
    })
    return NextResponse.json(transformCardRecord(updatedCardRecord));
  } catch (error: any) {
    console.error(`Error handling PUT request:`, error)
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: `Card not found` }, { status: 404 });
    }
    return NextResponse.json({ error: `Failed to handle PUT request` }, { status: 500 });
  }
}

// DELETE
export async function DELETE(req: Request) {
  try {
    const user = await stackServerApp.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Not logged in' }, { status: 401 });
    }
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Bad Request: Card ID is required in query parameters' }, { status: 400 });
    }
    const cardId = parseInt(id, 10)
    if (isNaN(cardId)) {
      return NextResponse.json({ error: 'Bad Request: Invalid Card ID format' }, { status: 400 });
    }

    await prisma.card.delete({
      where: { id: cardId },
    })
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error(`Error handling DELETE request:`, error)
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    return NextResponse.json({ error: `Failed to handle DELETE request` }, { status: 500 });
  }
}
