import { Router } from 'express';
import prisma from '../lib/db.js';

const router = Router();

interface CardInput {
  title: string;
  frontDescription: string;
  backDescription: string;
  symbol: string;
  imageUrl?: string;
  tags?: string[];
  includedInPalestineStack?: boolean;
  isFeatured?: boolean;
  sources?: unknown;
}

router.get('/', async (_req, res) => {
  try {
    const cards = await prisma.card.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(cards);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(card);
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data: CardInput = req.body;
    const card = await prisma.card.create({
      data: {
        title: data.title,
        frontDescription: data.frontDescription,
        backDescription: data.backDescription,
        symbol: data.symbol,
        imageUrl: data.imageUrl,
        tags: data.tags || [],
        includedInPalestineStack: data.includedInPalestineStack ?? false,
        isFeatured: data.isFeatured ?? false,
        sources: data.sources,
      },
    });
    res.status(201).json(card);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data: Partial<CardInput> = req.body;
    const card = await prisma.card.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.frontDescription && { frontDescription: data.frontDescription }),
        ...(data.backDescription && { backDescription: data.backDescription }),
        ...(data.symbol && { symbol: data.symbol }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.tags && { tags: data.tags }),
        ...(data.includedInPalestineStack !== undefined && { includedInPalestineStack: data.includedInPalestineStack }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
        ...(data.sources !== undefined && { sources: data.sources }),
      },
    });
    res.json(card);
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.card.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

export default router;