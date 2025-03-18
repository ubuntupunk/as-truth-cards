
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
          "relative w-full h-full cursor-pointer transform-gpu perspective-1000",
          isFlipped ? "animate-card-flip" : "animate-card-flip-back",
          "duration-700 preserve-3d"
        )}
        onClick={handleFlip}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Card Front */}
        <div 
          className={cn(
            "card-face card-front absolute inset-0 rounded-xl border border-border bg-card shadow-lg flex flex-col p-6 overflow-hidden dark:border-border",
            "backface-hidden"
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="text-4xl mb-4 mx-auto">{card.symbol}</div>
          <h3 className="text-lg font-medium mb-3 text-center">{card.title}</h3>
          <p className="text-sm text-muted-foreground text-center flex-grow flex items-center justify-center px-4">
            {card.frontDescription}
          </p>
          <div className="mt-4 text-xs text-center text-muted-foreground">Tap to reveal truth</div>
        </div>
        
        {/* Card Back */}
        <div 
          className={cn(
            "card-face card-back absolute inset-0 rounded-xl border border-border bg-primary shadow-lg flex flex-col p-6 overflow-hidden dark:border-border",
            "backface-hidden transform-gpu rotate-y-180"
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="text-4xl mb-4 mx-auto transform rotate-180">{card.symbol}</div>
          <h3 className="text-lg font-medium mb-3 text-center">{card.title}</h3>
          <div className="flex flex-col flex-grow overflow-auto">
            <p className="text-sm mb-4 px-2">
              {card.backDescription}
            </p>
            {card.sources && card.sources.length > 0 && (
              <div className="mt-auto">
                <h4 className="text-xs font-semibold mb-1">Sources:</h4>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {card.sources.map((source, i) => (
                    <li key={i} className="text-left">{source}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-4 text-xs text-center text-muted-foreground">Tap to flip back</div>
        </div>
      </div>
    </div>
  );
};

export default Card;
