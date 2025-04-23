import React, { useState, useEffect } from 'react'
import { cn } from '../../src/lib/utils';
import Card from './Card';
import { Shuffle } from 'lucide-react';
import { useDelayedVisibility } from '../../src/utils/animations';
import { CardData } from '../../src/types/cards'; // Assuming CardData type is defined here or adjust path

interface CardDeckProps {
  includePalestineStack: boolean;
}

const CardDeck: React.FC<CardDeckProps> = ({ includePalestineStack }) => {
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDeckVisible, setIsDeckVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isVisible = useDelayedVisibility(300);

  useEffect(() => {
    const fetchCards = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/cards');
        if (!response.ok) {
          const errorText = await response.text();
          console.error('HTTP error response text:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        const data: CardData[] = await response.json();
        setAllCards(data);
      } catch (e) {
        console.error('Failed to fetch cards:', e);
        setError('Failed to load cards. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCards();
  }, []);

  useEffect(() => {
    if (allCards.length > 0) {
      if (includePalestineStack) {
        setFilteredCards(allCards);
      } else {
        setFilteredCards(allCards.filter((card) => !card.includedInPalestineStack));
      }
      // Reset selection when filter changes
      setSelectedCardIndex(null);
      setIsDeckVisible(true);
    }
  }, [includePalestineStack, allCards]);

  const handleDrawCard = () => {
    setIsSelecting(true);
    setIsDeckVisible(false);

    setTimeout(() => {
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * filteredCards.length);
      } while (newIndex === selectedCardIndex && filteredCards.length > 1);

      setSelectedCardIndex(newIndex);
      setIsSelecting(false);
    }, 1200); // Simulate shuffling time
  };

  const handleReset = () => {
    setIsSelecting(true);

    // Hide the current card immediately
    setSelectedCardIndex(null);

    // Short delay before showing shuffle animation
    setTimeout(() => {
      setIsDeckVisible(false); // Ensure deck isn't shown during shuffle

      // Simulate shuffling and selecting a new card
      setTimeout(() => {
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * filteredCards.length);
        } while (newIndex === selectedCardIndex && filteredCards.length > 1); // Ensure it's a different card if possible

        setSelectedCardIndex(newIndex);
        setIsSelecting(false);
      }, 1200); // Shuffle animation time
    }, 100); // Delay before shuffle starts
  };

  return (
    <div
      className={cn(
        'w-full max-w-4xl mx-auto px-4',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10',
        'transition-all duration-700 ease-out',
        isLoading ? 'opacity-0' : 'opacity-100' // Hide while loading initially
      )}
    >
      {isLoading && <div className="text-center py-10">Loading cards...</div>}
      {error && <div className="text-center py-10 text-red-500">{error}</div>}
      {!isLoading && !error && selectedCardIndex === null ? (
        <div className="text-center">
          {isDeckVisible && filteredCards.length > 0 ? (
            <div className="space-y-12">
              {/* Card Stack Representation */}
              <div className="relative w-64 h-96 mx-auto">
                {/* Show a few cards stacked */}
                {[...Array(Math.min(filteredCards.length, 5))].map((_, index) => (
                  <div
                    key={`stack-${index}`}
                    className={cn(
                      'absolute inset-0 rounded-xl border border-border shadow-lg',
                      'bg-gradient-to-br from-card to-background',
                      'dark:from-slate-700 dark:to-slate-800 dark:border-slate-600',
                      'transition-all duration-300 ease-out',
                      index === 0
                        ? 'rotate-0'
                        : index % 2 === 0
                          ? `rotate-${index}`
                          : `-rotate-${index}`
                    )}
                    style={{
                      transform: `translateY(${index * 2}px) rotate(${index % 2 === 0 ? index * 2 : -index * 2}deg)`,
                    }}
                  />
                ))}
              </div>

              {filteredCards.length > 0 ? (
                <button
                  onClick={handleDrawCard}
                  disabled={isSelecting}
                  className="rounded-full px-8 py-3 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  Draw a Card
                </button>
              ) : (
                <p>No cards available for this selection.</p>
              )}
            </div>
          ) : (
            // Show shuffle animation when isDeckVisible is false AND we are selecting
            <div className="flex items-center justify-center h-96">
              <div
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center',
                  'animate-spin text-primary-foreground dark:text-slate-100'
                )}
              >
                <Shuffle className="w-8 h-8" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'space-y-8',
            'transition-opacity duration-400 ease-in-out',
            isSelecting ? 'opacity-0' : 'opacity-100' // Fade out card while selecting new one
          )}
        >
          {
            selectedCardIndex !== null && filteredCards[selectedCardIndex] ? (
              <div className="max-w-sm mx-auto">
                <Card
                  card={filteredCards[selectedCardIndex]}
                  index={0}
                  isRevealed={false}
                  isFeatured={filteredCards[selectedCardIndex].isFeatured || false}
                />
              </div>
            ) : null /* Handle case where index might be invalid briefly */
          }

          <div className="text-center h-16">
            {' '}
            {/* Reserve space for button/spinner */}
            {!isSelecting ? (
              <button
                onClick={handleReset}
                disabled={filteredCards.length <= 1} // Disable if only one card
                className="rounded-full px-8 py-3 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                Draw Another Card
              </button>
            ) : (
              <div className="flex items-center justify-center pt-3">
                {' '}
                {/* Adjust spinner position */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center', // Smaller spinner
                    'animate-spin text-primary-foreground dark:text-slate-100'
                  )}
                >
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
