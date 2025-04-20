import React, { useState, useEffect } from 'react';
import Card from './Card';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface CardData {
  id: number;
  title: string;
  frontDescription: string;
  backDescription: string;
  symbol: string;
  imageUrl?: string;
  sources: any;
  tags?: string[];
  includedInPalestineStack: boolean;
  isFeatured: boolean;
}

interface FeaturedCardProps {
  featuredCard?: CardData;
}

const FeaturedCard: React.FC<FeaturedCardProps> = ({ featuredCard }) => {
  const [featuredCardData, setFeaturedCardData] = useState<CardData | null>(null);
  const [liked, setLiked] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchFeaturedCard = async () => {
      try {
        const response = await fetch('/api/cards/featured');
        if (response.ok) {
          const data: CardData = await response.json();
          setFeaturedCardData(data);
        } else {
          console.error('Failed to fetch featured card:', response.status);
        }
      } catch (error) {
        console.error('Error fetching featured card:', error);
      }
    };

    fetchFeaturedCard();
  }, []);

  const handleLike = async (liked: boolean) => {
    setLiked(liked);
    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: displayFeaturedCard.id,
          liked: liked,
        }),
      });
    } catch (error) {
      console.error('Error sending interaction:', error);
    }
  };

  const displayFeaturedCard = featuredCardData || {
    id: 0,
    title: "Discover Hidden Truths",
    frontDescription: "Explore our deck of cards that reveal the truth behind common misconceptions and stereotypes. Each card offers factual insights backed by research.",
    backDescription: "Our cards are designed to promote critical thinking and understanding. By exploring these cards, you'll gain a deeper perspective on complex topics often misrepresented in casual conversation.",
    symbol: "✨",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
    sources: [
      {
        text: "Based on peer-reviewed research and historical documentation",
      }
    ],
    includedInPalestineStack: false,
    isFeatured: true
  };

  return (
    <div className="max-w-md mx-auto">
      <Card card={displayFeaturedCard} index={0} isHero={true} />
      <div className="flex justify-around mt-4">
        <button onClick={() => handleLike(true)} className="text-green-500 hover:text-green-700">
          <ThumbsUp className="w-6 h-6" />
        </button>
        <button onClick={() => handleLike(false)} className="text-red-500 hover:text-red-700">
          <ThumbsDown className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default FeaturedCard;
