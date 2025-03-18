
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { cards } from '@/data/cards';
import Card from './Card';
import { Shuffle } from 'lucide-react';
import { useDelayedVisibility } from '@/utils/animations';

const CardDeck: React.FC = () => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDeckVisible, setIsDeckVisible] = useState(true);
  const isVisible = useDelayedVisibility(300);
  
  const handleDrawCard = () => {
    setIsSelecting(true);
    setIsDeckVisible(false);
    
    // Simulate card selection with delay
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * cards.length);
      setSelectedCard(randomIndex);
      setIsSelecting(false);
    }, 1200);
  };
  
  const handleReset = () => {
    setSelectedCard(null);
    setIsDeckVisible(true);
  };
  
  return (
    <div className={cn(
      "w-full max-w-4xl mx-auto px-4",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
      "transition-all duration-700 ease-out"
    )}>
      {selectedCard === null ? (
        <div className="text-center">
          {isDeckVisible ? (
            <div className="space-y-8">
              <div className="relative w-64 h-96 mx-auto">
                {cards.slice(0, 5).map((_, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "absolute inset-0 rounded-xl border border-border bg-card shadow-lg",
                      "transition-all duration-300 ease-out",
                      index === 0 ? "rotate-0" : index % 2 === 0 ? `rotate-${index}` : `-rotate-${index}`
                    )}
                    style={{ transform: `translateY(${index * 2}px) rotate(${index % 2 === 0 ? index * 2 : -index * 2}deg)` }}
                  />
                ))}
              </div>
              
              <button
                onClick={handleDrawCard}
                className="rounded-full px-8 py-3 bg-foreground text-primary font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                Draw a Card
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center",
                "animate-spin"
              )}>
                <Shuffle className="w-8 h-8" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="max-w-sm mx-auto">
            <Card card={cards[selectedCard]} index={0} isRevealed={false} />
          </div>
          
          <div className="text-center">
            <button
              onClick={handleReset}
              className="rounded-full px-8 py-3 bg-foreground text-primary font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              Draw Another Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardDeck;
