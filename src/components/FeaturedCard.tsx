import React from 'react'
import Card from './Card'
import { FeaturedCardInfo } from '../types/cards'

interface FeaturedCardProps {
  featuredCard?: FeaturedCardInfo
}

const FeaturedCard: React.FC<FeaturedCardProps> = ({ featuredCard }) => {
  const displayFeaturedCard: FeaturedCardInfo = featuredCard || {
    id: 0,
    title: 'Discover Hidden Truths',
    frontDescription:
      'Explore our deck of cards that reveal the truth behind common misconceptions and stereotypes. Each card offers factual insights backed by research.',
    backDescription: `Our cards are designed to promote critical thinking and understanding. By exploring these cards, you'll gain a deeper perspective on complex topics often misrepresented in casual conversation.\nEach card is a gateway to knowledge, encouraging you to question assumptions and seek the truth.`,
    symbol: '✨',
    imageUrl: '/anti1.jpeg',
    sources: [
      {
        text: 'Based on peer-reviewed research and historical documentation',
      },
    ],
    includedInPalestineStack: false,
    tags: [],
  }

  return (
    <div className="max-w-md mx-auto">
      <Card
        card={displayFeaturedCard}
        index={0}
        isHero={true}
        isFeatured={true}
        isInteractive={false}
      />
    </div>
  )
}

export default FeaturedCard
