// components/HeroSection.tsx
import React from 'react'
import { cn } from '../../src/lib/utils'
import { Checkbox } from '../../src/components/ui/checkbox'
import { Label } from '../../src/components/ui/label'
import { useDelayedVisibility } from '../../src/utils/animations'

interface HeroSectionProps {
  showPalestineStack: boolean
  setShowPalestineStack: (checked: boolean) => void
}

const HeroSection: React.FC<HeroSectionProps> = ({ showPalestineStack, setShowPalestineStack }) => {
  const isHeaderVisible = useDelayedVisibility(100)
  const isContentVisible = useDelayedVisibility(300)

  return (
    <div className="text-center space-y-6">
      <div className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium mb-2 animate-fade-in">
        Interactive Education
      </div>

      <h1
        className={cn(
          'text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight',
          isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          'transition-all duration-700 ease-out'
        )}
      >
        Revealing Truth
      </h1>

      <p
        className={cn(
          'max-w-2xl mx-auto text-lg text-muted-foreground',
          isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          'transition-all duration-700 ease-out delay-100'
        )}
      >
        Draw a card to explore and debunk harmful Jew-hatred misconceptions. Each card reveals
        important truths behind common AntiSemitic falsehoods.
      </p>

      <div
        className={cn(
          'flex items-center justify-center space-x-2 pt-4',
          isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          'transition-all duration-700 ease-out delay-200'
        )}
      >
        <Checkbox
          id="showPalestineStack"
          checked={showPalestineStack}
          onCheckedChange={(checked) => setShowPalestineStack(checked as boolean)}
        />
        <Label htmlFor="showPalestineStack" className="text-sm cursor-pointer">
          Include Israel/Palestine content
        </Label>
      </div>
    </div>
  )
}

export default HeroSection
