import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { cards } from '@/data/cards';
import Card from './Card';
import { Shuffle } from 'lucide-react';
import { useDelayedVisibility } from '@/utils/animations';

interface CardDeckProps {
  includePalestineStack: boolean;
}

const CardDeck: React.FC<CardDeckProps> = ({ includePalestineStack }) => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDeckVisible, setIsDeckVisible] = useState(true);
  const [filteredCards, setFilteredCards] = useState(cards);
  const isVisible = useDelayedVisibility(300);
  
  useEffect(() => {
    if (includePalestineStack) {
      setFilteredCards(cards);
    } else {
      setFilteredCards(cards.filter(card => !card.includedInPalestineStack));
    }
  }, [includePalestineStack]);
  
  const handleDrawCard = () => {
    setIsSelecting(true);
    setIsDeckVisible(false);
    
    setTimeout(() => {
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * filteredCards.length);
      } while (newIndex === selectedCard && filteredCards.length > 1);
      
      setSelectedCard(newIndex);
      setIsSelecting(false);
    }, 1200);
  };
  
  const handleReset = () => {
    setIsSelecting(true);
    setIsDeckVisible(false);
    
    // Use the same draw card logic but with a shorter delay
    setTimeout(() => {
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * filteredCards.length);
      } while (newIndex === selectedCard && filteredCards.length > 1);
      
      setSelectedCard(newIndex);
      setIsSelecting(false);
    }, 800);
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
            <div className="space-y-12">
              {/* Card Stack */}
              <div className="relative w-64 h-96 mx-auto">
                {filteredCards.slice(0, 5).map((_, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "absolute inset-0 rounded-xl border border-border shadow-lg",
                      "bg-gradient-to-br from-card to-background",
                      "dark:from-slate-700 dark:to-slate-800 dark:border-slate-600",
                      "transition-all duration-300 ease-out",
                      index === 0 ? "rotate-0" : index % 2 === 0 ? `rotate-${index}` : `-rotate-${index}`
                    )}
                    style={{ transform: `translateY(${index * 2}px) rotate(${index % 2 === 0 ? index * 2 : -index * 2}deg)` }}
                  />
                ))}
              </div>
              
              <button
                onClick={handleDrawCard}
                className="rounded-full px-8 py-3 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                Draw a Card
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center",
                "animate-spin text-primary-foreground dark:text-slate-100"
              )}>
                <Shuffle className="w-8 h-8" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="max-w-sm mx-auto">
            <Card card={filteredCards[selectedCard]} index={0} isRevealed={false} />
          </div>
          
          <div className="text-center">
            {!isSelecting ? (
              <button
                onClick={handleReset}
                className="rounded-full px-8 py-3 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                Draw Another Card
              </button>
            ) : (
              <div className="flex items-center justify-center">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center",
                  "animate-spin text-primary-foreground dark:text-slate-100"
                )}>
                  <Shuffle className="w-8 h-8" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CardDeck;
