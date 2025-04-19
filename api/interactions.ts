import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardService } from '../src/services/database';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Basic validation (add more robust validation as needed)
    const { cardId, interactionType } = req.body;
    if (!cardId || !interactionType) {
      return res.status(400).json({ error: 'Missing required interaction fields' });
    }

    const interaction = await cardService.recordInteraction({ cardId, interactionType });
    res.status(201).json(interaction);

  } catch (error: any) {
    console.error("General error:", error);
    return res.status(500).json({ error: 'Failed to record interaction', details: error.message });
  }
}
