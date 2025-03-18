
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { CardData } from '@/data/cards';
import { useDelayedVisibility } from '@/utils/animations';

interface CardProps {
  card: CardData;
  index: number;
  isRevealed?: boolean;
}

const Card: React.FC<CardProps> = ({ card, index, isRevealed = false }) => {
  const [isFlipped, setIsFlipped] = useState(isRevealed);
  const isVisible = useDelayedVisibility(100 + index * 50);
  
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  
  return (
    <div 
      className={cn(
        "card-container aspect-[2/3] w-full max-w-xs mx-auto",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
        "transition-all duration-700 ease-out"
      )}
    >
      <div 
        className={cn(
          "relative w-full h-full cursor-pointer",
          isFlipped ? "flipped" : ""
        )}
        onClick={handleFlip}
      >
        {/* Card Front */}
        <div className="card-face card-front absolute inset-0 rounded-xl border border-border bg-card shadow-lg flex flex-col p-6 overflow-hidden">
          <div className="text-4xl mb-4 mx-auto">{card.symbol}</div>
          <h3 className="text-lg font-medium mb-3 text-center">{card.title}</h3>
          <p className="text-sm text-muted-foreground text-center flex-grow flex items-center justify-center px-4">
            {card.frontDescription}
          </p>
          <div className="mt-4 text-xs text-center text-muted-foreground">Tap to reveal truth</div>
        </div>
        
        {/* Card Back */}
        <div className="card-face card-back absolute inset-0 rounded-xl border border-border bg-primary shadow-lg flex flex-col p-6 overflow-hidden">
          <div className="text-4xl mb-4 mx-auto transform rotate-180">{card.symbol}</div>
          <h3 className="text-lg font-medium mb-3 text-center">{card.title}</h3>
          <p className="text-sm flex-grow overflow-auto px-2">
            {card.backDescription}
          </p>
          <div className="mt-4 text-xs text-center text-muted-foreground">Tap to flip back</div>
        </div>
      </div>
    </div>
  );
};

export default Card;
