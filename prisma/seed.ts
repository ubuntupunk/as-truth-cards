// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import { cards } from '../src/data/cards.js' // Ensure this path is correct relative to prisma/seed.ts

const prisma = new PrismaClient()

console.log('Starting to seed database...')

try {
  // Clear existing cards (optional, kept from original script)
  try {
    await prisma.card.deleteMany()
    console.log('Cleared existing cards')
  } catch (error) {
    // Log if deletion fails (e.g., table doesn't exist yet or other issues)
    // Or simply ignore if it's expected that the table might not exist on first run
    console.log('Could not clear existing cards or no cards to clear.')
  }

  // Seed new cards
  const createdCards = await Promise.all(
    cards.map((card) => {
      // Ensure sources is handled correctly - Prisma expects JsonValue
      // Use JSON.parse/stringify to ensure type compatibility for Prisma's Json type
      const sourcesData = JSON.parse(JSON.stringify(card.sources ?? [])) // Use ?? [] for safety

      return prisma.card.create({
        data: {
          id: card.id,
          title: card.title,
          frontDescription: card.frontDescription,
          backDescription: card.backDescription,
          symbol: card.symbol,
          imageUrl: card.imageUrl ?? null,
          sources: sourcesData, // Use the JSON-compatible data
          tags: card.tags ?? [],
          includedInPalestineStack: card.includedInPalestineStack ?? false,
          isFeatured: card.isFeatured ?? false,
        },
      })
    })
  )

  console.log(`Seeded ${createdCards.length} cards successfully.`)
} catch (e) {
  console.error('Error seeding database:', e)
  process.exitCode = 1 // Set exit code to indicate failure
} finally {
  // Ensure Prisma client disconnects regardless of success or failure
  await prisma.$disconnect()
  console.log('Prisma client disconnected.')
  // Exit the process if there was an error
  if (process.exitCode === 1) {
    process.exit(1)
  }
}
