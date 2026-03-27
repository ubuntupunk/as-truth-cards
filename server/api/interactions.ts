import { Router } from 'express';
import prisma from '../lib/db.js';

const router = Router();

interface InteractionInput {
  cardId: number;
  interactionType: 'RATING_UP' | 'RATING_DOWN' | 'VIEW' | 'SHARE';
  userId?: string;
  feedbackRating?: number;
  feedbackText?: string;
}

router.post('/', async (req, res) => {
  try {
    const data: InteractionInput = req.body;
    const { cardId, interactionType, userId, feedbackRating, feedbackText } = data;

    if (!cardId || !interactionType) {
      res.status(400).json({ error: 'cardId and interactionType are required' });
      return;
    }

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    const interaction = await prisma.userInteraction.create({
      data: {
        cardId,
        interactionType,
        userId: userId || null,
        feedbackRating: feedbackRating || null,
        feedbackText: feedbackText || null,
        status: 'APPROVED',
      },
    });

    res.status(201).json(interaction);
  } catch (error) {
    console.error('Error creating interaction:', error);
    res.status(500).json({ error: 'Failed to create interaction' });
  }
});

router.get('/card/:cardId', async (req, res) => {
  try {
    const cardId = parseInt(req.params.cardId, 10);
    const interactions = await prisma.userInteraction.findMany({
      where: { cardId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(interactions);
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'Failed to fetch interactions' });
  }
});

export default router;