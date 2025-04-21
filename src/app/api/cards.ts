import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient, Card } from '@prisma/client'
import { CardData } from '../../types/cards'
import { stackServerApp } from '../../stack/server'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

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
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- Admin Check Middleware ---
  const isAdminRequest = ['POST', 'PUT', 'DELETE'].includes(req.method || '')
  let user = null

  if (isAdminRequest) {
    try {
      user = await stackServerApp.getUser()
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Not logged in' })
      }
      if (!user.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Forbidden: Admin privileges required' })
      }
    } catch (error) {
      console.error('Error getting user:', error)
      return res.status(500).json({ error: 'Failed to authenticate user' })
    }
  }

  try {
    switch (req.method) {
      case 'GET': {
        const cardRecords = await prisma.card.findMany({
          orderBy: {
            createdAt: 'desc',
          },
        })
        const cards: CardData[] = cardRecords.map(transformCardRecord)
        res.status(200).json(cards)
        break
      }

      case 'POST': {
        const newCardData = req.body as Omit<CardData, 'id'>
        const createdCardRecord = await prisma.card.create({
          data: {
            ...newCardData,
            sources: newCardData.sources || [],
            tags: newCardData.tags || [],
          },
        })
        res.status(201).json(transformCardRecord(createdCardRecord))
        break
      }

      case 'PUT': {
        const updatedCardData = req.body as CardData
        if (!updatedCardData.id) {
          return res.status(400).json({ error: 'Bad Request: Card ID is required for update' })
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
        res.status(200).json(transformCardRecord(updatedCardRecord))
        break
      }

      case 'DELETE': {
        const { id } = req.query
        if (!id || typeof id !== 'string') {
          return res
            .status(400)
            .json({ error: 'Bad Request: Card ID is required in query parameters' })
        }
        const cardId = parseInt(id, 10)
        if (isNaN(cardId)) {
          return res.status(400).json({ error: 'Bad Request: Invalid Card ID format' })
        }

        await prisma.card.delete({
          where: { id: cardId },
        })
        res.status(204).end()
        break
      }

      default: {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        res.status(405).end(`Method ${req.method} Not Allowed`)
      }
    }
  } catch (error: unknown) {
    console.error(`Error handling ${req.method} request:`, error)
    if ((error as { code?: string }).code === 'P2025') {
      return res.status(404).json({ error: 'Card not found' })
    }
    res.status(500).json({ error: `Failed to handle ${req.method} request` })
  } finally {
    await prisma.$disconnect()
  }
}
