import prisma from './lib/db.js'
import { cards } from '../src/data/cards'

async function main() {
  console.log('Seeding database...')

  for (const card of cards) {
    await prisma.card.upsert({
      where: { id: card.id },
      update: {},
      create: {
        id: card.id,
        title: card.title,
        frontDescription: card.frontDescription,
        backDescription: card.backDescription,
        symbol: card.symbol,
        imageUrl: card.imageUrl || null,
        tags: card.tags || [],
        includedInPalestineStack: card.includedInPalestineStack ?? false,
        isFeatured: card.isFeatured ?? false,
        sources: card.sources ?? [],
      },
    })
  }

  console.log(`Seeded ${cards.length} cards`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })