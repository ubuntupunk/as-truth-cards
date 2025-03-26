import React from 'react';
import { cn } from '@/lib/utils';
import CardDeck from './CardDeck';
import FeaturedCard from './FeaturedCard';
import { cards } from '@/data/cards';

interface CardSectionProps {
  includePalestineStack: boolean;
}

const CardSection: React.FC<CardSectionProps> = ({ includePalestineStack }) => {
  const featuredCard = cards.find(card => card.isFeatured);

  return (
    <div className={cn(
      "container mx-auto px-4",
      "grid gap-8 items-start",
      // Stack vertically on mobile, side by side on laptop/desktop
      "grid-cols-1 lg:grid-cols-2",
      // Add some vertical spacing on mobile
      "space-y-8 lg:space-y-0"
    )}>
      <div className="w-full max-w-md mx-auto lg:max-w-none">
        <FeaturedCard featuredCard={featuredCard} />
      </div>
      <div className="w-full">
        <CardDeck includePalestineStack={includePalestineStack} />
      </div>
    </div>
  );
};

export default CardSection;
