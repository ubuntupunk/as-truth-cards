import React from 'react';
import Card from './Card';
// import { CardData } from '../../src/data/cards'; // Import from data/cards instead of types/cards

interface FeaturedCardProps {
  featuredCard?: CardData;
}

const FeaturedCard: React.FC<FeaturedCardProps> = ({ featuredCard }) => {
  const defaultFeaturedCard: CardData = {
    id: 0,
    title: "Discover Hidden Truths",
    frontDescription: "Explore our deck of cards that reveal the truth behind common misconceptions and stereotypes. Each card offers factual insights backed by research.",
    backDescription: "Our cards are designed to promote critical thinking and understanding. By exploring these cards, you'll gain a deeper perspective on complex topics often misrepresented in casual conversation.",
    symbol: "✨",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
    sources: [ // This is now optional based on the CardData type from data/cards
      {
        text: "Based on peer-reviewed research and historical documentation",
      }
    ],
    includedInPalestineStack: false,
    isFeatured: true
  };

  const displayFeaturedCard = featuredCard || defaultFeaturedCard;

  return (
    <div className="max-w-md mx-auto">
      <Card card={displayFeaturedCard} index={0} isHero={true} />
    </div>
  );
};

export default FeaturedCard;
