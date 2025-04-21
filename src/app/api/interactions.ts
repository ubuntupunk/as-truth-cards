import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    // Basic validation (add more robust validation as needed)
    const { cardId, interactionType } = req.body
    if (!cardId || !interactionType) {
      return res.status(400).json({ error: 'Missing required interaction fields' })
    }

    const interaction = await prisma.userInteraction.create({
      data: { cardId: parseInt(cardId), interactionType },
    })
    res.status(201).json(interaction)
  } catch (error: unknown) {
    console.error('Error during interaction:', error)
    return res.status(500).json({ message: 'Failed to process interaction' })
  }
}
