import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'preact/hooks'
import type React from 'react'
import type { CardData } from '@/data/cards'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'

interface CardProps {
  card: CardData
  index: number
  isRevealed?: boolean
  isHero?: boolean
}

const Card: React.FC<CardProps> = ({
  card,
  index,
  isRevealed = false,
  isHero = false,
}) => {
  const [isFlipped, setIsFlipped] = useState(isRevealed)
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null)
  const [isVoting, setIsVoting] = useState(false)
  const isVisible = useDelayedVisibility(100 + index * 50)

  const handleFlip = () => {
    if (!isVoting) {
      setIsFlipped(!isFlipped)
    }
  }

  const handleVote = async (vote: 'up' | 'down') => {
    if (userVote || isVoting) return

    const localStorageKey = `card_${card.id}_voted`
    if (localStorage.getItem(localStorageKey)) {
      return
    }

    setIsVoting(true)
    setUserVote(vote)
    localStorage.setItem(localStorageKey, 'true')

    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card.id,
          interactionType: vote === 'up' ? 'RATING_UP' : 'RATING_DOWN',
        }),
      })
    } catch (error) {
      console.error('Failed to record vote:', error)
    } finally {
      setIsVoting(false)
    }
  }

  const hasVoted =
    typeof window !== 'undefined' &&
    !!localStorage.getItem(`card_${card.id}_voted`)

  return (
    <div
      className={cn(
        'card-container aspect-[2/3] w-full max-w-xs mx-auto',
        isHero ? 'max-w-md' : 'max-w-xs',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10',
        'transition-all duration-700 ease-out',
      )}
    >
      <div
        className={cn(
          'relative w-full h-full cursor-pointer transform-gpu perspective-1000',
          isFlipped ? 'animate-card-flip' : 'animate-card-flip-back',
          'duration-700 preserve-3d',
        )}
        onClick={handleFlip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleFlip()
          }
        }}
        role="button"
        tabIndex={0}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Card Front */}
        <div
          className={cn(
            'card-face card-front absolute inset-0 rounded-xl border overflow-hidden',
            'shadow-lg flex flex-col p-6 overflow-hidden',
            isHero
              ? 'bg-gradient-to-br from-primary/90 to-primary/30'
              : 'bg-gradient-to-br from-card to-background',
            'dark:from-slate-700 dark:to-slate-800 dark:text-slate-100 dark:border-slate-600',
            'backface-hidden',
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {card.imageUrl && (
            <div
              className={cn(
                'mb-4 overflow-hidden rounded-lg',
                isHero ? 'h-48' : 'h-32',
              )}
            >
              <img
                src={card.imageUrl}
                alt={card.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="text-4xl mb-4 mx-auto">{card.symbol}</div>
          <h3
            className={cn(
              'font-medium mb-3 text-center',
              isHero ? 'text-xl' : 'text-lg',
            )}
          >
            {card.title}
          </h3>
          <p
            className={cn(
              'text-muted-foreground text-center flex-grow flex items-center justify-center px-4',
              isHero ? 'text-base' : 'text-sm',
            )}
          >
            {card.frontDescription}
          </p>
          <div className="mt-4 text-xs text-center text-muted-foreground">
            {isHero ? 'Tap to learn more' : 'Tap to reveal truth'}
          </div>
        </div>

        {/* Card Back */}
        <div
          className={cn(
            'card-face card-back absolute inset-0 rounded-xl border overflow-hidden',
            'shadow-lg flex flex-col p-6',
            'bg-gradient-to-br from-secondary/80 to-secondary/30',
            'dark:from-slate-800 dark:to-slate-900 dark:text-slate-100 dark:border-slate-700',
            'backface-hidden transform-gpu rotate-y-180',
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="text-4xl mb-4 mx-auto transform rotate-180">
            {card.symbol}
          </div>
          <h3 className="text-lg font-medium mb-3 text-center">{card.title}</h3>
          <div className="flex flex-col flex-grow overflow-auto">
            <p className="text-sm mb-4 px-2">{card.backDescription}</p>
            {card.sources && card.sources.length > 0 && (
              <div className="mt-auto">
                <h4 className="text-xs font-semibold mb-1">Sources:</h4>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {card.sources.map((source, i) => (
                    <li key={source.url || i} className="text-left">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-primary-foreground"
                        >
                          {source.text}
                        </a>
                      ) : (
                        source.text
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {/* Rating Buttons */}
          <div className="mt-4 flex justify-center gap-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleVote('up')
              }}
              disabled={hasVoted || isVoting}
              className={cn(
                'p-2 rounded-full transition-colors',
                userVote === 'up'
                  ? 'bg-green-500 text-white'
                  : 'hover:bg-green-100 dark:hover:bg-green-900',
                hasVoted && 'opacity-50 cursor-not-allowed',
              )}
              aria-label="Helpful"
            >
              <ThumbsUp className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleVote('down')
              }}
              disabled={hasVoted || isVoting}
              className={cn(
                'p-2 rounded-full transition-colors',
                userVote === 'down'
                  ? 'bg-red-500 text-white'
                  : 'hover:bg-red-100 dark:hover:bg-red-900',
                hasVoted && 'opacity-50 cursor-not-allowed',
              )}
              aria-label="Not helpful"
            >
              <ThumbsDown className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 text-xs text-center text-muted-foreground">
            {hasVoted ? 'Thanks for your feedback!' : 'Was this helpful?'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Card
