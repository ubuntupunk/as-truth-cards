import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardService } from '../../src/services/database';
import { CardData } from '../../src/data/cards'; // Import CardData type
import { CardRecord } from '../../src/types/database'; // Import CardRecord type

const transformCardRecord = (card: CardRecord): CardData => ({
  id: card.id,
  title: card.title,
  frontDescription: card.front_description,
  backDescription: card.back_description,
  symbol: card.symbol,
  imageUrl: card.image_url,
  sources: card.sources,
  tags: card.tags,
  includedInPalestineStack: card.included_in_palestine_stack,
  isFeatured: card.is_featured,
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const featuredCardRecord = await cardService.getFeaturedCard();
    if (featuredCardRecord) {
      const featuredCard: CardData = transformCardRecord(featuredCardRecord);
      res.status(200).json(featuredCard);
    } else {
      res.status(404).json({ error: 'No featured card found' });
    }
  } catch (error) {
    console.error('Error fetching featured card:', error);
    res.status(500).json({ error: 'Failed to fetch featured card' });
  }
}
