import React, { useState, useEffect } from 'react'
import Card from './Card'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { CardData } from '../types/cards'

interface FeaturedCardProps {
  featuredCard?: CardData
}

const FeaturedCard: React.FC<FeaturedCardProps> = ({ featuredCard }) => {
  const [featuredCardData, setFeaturedCardData] = useState<CardData | null>(null)
  const [liked, setLiked] = useState<boolean | null>(null)

  useEffect(() => {
    const fetchFeaturedCard = async () => {
      try {
        const response = await fetch('/api/cards/featured')
        if (response.ok) {
          const data: CardData = await response.json()
          setFeaturedCardData(data)
        } else {
          console.error('Failed to fetch featured card:', response.status)
        }
      } catch (error) {
        console.error('Error fetching featured card:', error)
      }
    }

    fetchFeaturedCard()
  }, [])

  const handleLike = async (liked: boolean) => {
    setLiked(liked)
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
      })
    } catch (error) {
      console.error('Error sending interaction:', error)
    }
  }

  const displayFeaturedCard = featuredCardData || {
    id: 0,
    title: 'Discover Hidden Truths',
    frontDescription:
      'Explore our deck of cards that reveal the truth behind common misconceptions and stereotypes. Each card offers factual insights backed by research.',
    backDescription:
      `Our cards are designed to promote critical thinking and understanding. By exploring these cards, you'll gain a deeper perspective on complex topics often misrepresented in casual conversation.\nEach card is a gateway to knowledge, encouraging you to question assumptions and seek the truth. Thumbs up or Thumbs down to record your approval or disapproval. Vetted Users can also submit their own cards to contribute to the deck, fostering a community of informed discussion.\nJoin us in this journey of discovery and enlightenment. Together, we can challenge the status quo and promote a more informed society. Free of hatred, bigotry and unfair discrimination.`,
    symbol: '✨',
    imageUrl:
      '/anti1.jpeg',
    sources: [
      {
        text: 'Based on peer-reviewed research and historical documentation',
      },
    ],
    includedInPalestineStack: false,
    isFeatured: true, // Provide a default value
  }

  return (
    <div className="max-w-md mx-auto">
      <Card card={displayFeaturedCard} index={0} isHero={true} isFeatured={true} />
      <div className="flex justify-around mt-4">
        <button onClick={() => handleLike(true)} className="text-green-500 hover:text-green-700">
          <ThumbsUp className="w-6 h-6" />
        </button>
        <button onClick={() => handleLike(false)} className="text-red-500 hover:text-red-700">
          <ThumbsDown className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}

export default FeaturedCard
