import { useQuery } from '@tanstack/react-query'
import { Shuffle } from 'lucide-react'
import { useEffect, useState } from 'preact/hooks'
import type React from 'react'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'
import Card from './Card'

interface CardData {
  id: number
  title: string
  frontDescription: string
  backDescription: string
  symbol: string
  imageUrl?: string
  tags?: string[]
  includedInPalestineStack?: boolean
  isFeatured?: boolean
  sources?: unknown[]
}

interface CardDeckProps {
  includePalestineStack: boolean
}

const CardDeck: React.FC<CardDeckProps> = ({ includePalestineStack }) => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [isDeckVisible, setIsDeckVisible] = useState(true)
  const isVisible = useDelayedVisibility(300)

  const { data: cards = [], isLoading } = useQuery<CardData[]>({
    queryKey: ['cards'],
    queryFn: async () => {
      const res = await fetch('/api/cards')
      if (!res.ok) throw new Error('Failed to fetch cards')
      return res.json()
    },
  })

  const filteredCards = cards.filter(
    (card) => includePalestineStack || !card.includedInPalestineStack,
  )

  const featuredCard = cards.find((card) => card.isFeatured)

  const handleDrawCard = () => {
    if (filteredCards.length === 0) return
    setIsSelecting(true)
    setIsDeckVisible(false)

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * filteredCards.length)
      setSelectedCard(randomIndex)
      setIsSelecting(false)
    }, 1200)
  }

  const handleReset = () => {
    setSelectedCard(null)
    setIsDeckVisible(true)
  }

  const defaultFeaturedCard: CardData = {
    id: 0,
    title: 'Discover Hidden Truths',
    frontDescription:
      'Explore our deck of cards that reveal the truth behind common misconceptions and stereotypes. Each card offers factual insights backed by research.',
    backDescription:
      "Our cards are designed to promote critical thinking and understanding. By exploring these cards, you'll gain a deeper perspective on complex topics often misrepresented in casual conversation.",
    symbol: '✨',
    imageUrl:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    sources: [
      { text: 'Based on peer-reviewed research and historical documentation' },
    ],
    includedInPalestineStack: false,
  }

  const displayFeaturedCard = featuredCard || defaultFeaturedCard

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 text-center py-12">
        <p className="text-muted-foreground">Loading cards...</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full max-w-4xl mx-auto px-4',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10',
        'transition-all duration-700 ease-out',
      )}
    >
      {selectedCard === null ? (
        <div className="text-center">
          {isDeckVisible ? (
            <div className="space-y-12">
              <div className="max-w-md mx-auto">
                <Card card={displayFeaturedCard} index={0} isHero={true} />
              </div>

              <div className="relative w-64 h-96 mx-auto">
                {filteredCards.slice(0, 5).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'absolute inset-0 rounded-xl border border-border shadow-lg',
                      'bg-gradient-to-br from-card to-background',
                      'dark:from-slate-700 dark:to-slate-800 dark:border-slate-600',
                      'transition-all duration-300 ease-out',
                    )}
                    style={{
                      transform: `translateY(${index * 2}px) rotate(${index % 2 === 0 ? index * 2 : -index * 2}deg)`,
                    }}
                  />
                ))}
              </div>

              <button
                onClick={handleDrawCard}
                disabled={filteredCards.length === 0}
                className="rounded-full px-8 py-3 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Draw a Card
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center',
                  'animate-spin text-primary-foreground dark:text-slate-100',
                )}
              >
                <Shuffle className="w-8 h-8" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="max-w-sm mx-auto">
            <Card
              card={filteredCards[selectedCard]}
              index={0}
              isRevealed={false}
            />
          </div>

          <div className="text-center">
            <button
              onClick={handleReset}
              className="rounded-full px-8 py-3 bg-primary text-primary-foreground font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              Draw Another Card
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CardDeck
