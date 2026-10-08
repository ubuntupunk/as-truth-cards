/**
 * The legacy flat deck, preserved unchanged behind `/legacy/deck`.
 *
 * This was the site's original "Revealing Truth" draw-a-card surface: a
 * Prisma-backed 2:3 card stack with an Israel/Palestine toggle. The product
 * shell's discovery composition moved to `pages/Deck.tsx` at `/` (SPEC §3.1,
 * §3.3), and SPEC §14 retires the toggle and the physical-card presentation as
 * design requirements — so this page stays reachable for comparison but is
 * no longer the route anyone lands on.
 */

import { useState } from 'react'
import CardDeck from '@/components/CardDeck'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'

const LegacyDeck = () => {
  const isHeaderVisible = useDelayedVisibility(100)
  const isContentVisible = useDelayedVisibility(300)
  const [showPalestineStack, setShowPalestineStack] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow pt-24 pb-16 px-4">
        <section className="container mx-auto max-w-4xl py-12 space-y-16">
          <div className="text-center space-y-6">
            <div className="inline-block px-3 py-1 rounded-full bg-primary text-xs font-medium mb-2 animate-fade-in">
              Interactive Education
            </div>

            <h1
              className={cn(
                'text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight',
                isHeaderVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4',
                'transition-all duration-700 ease-out',
              )}
            >
              Revealing Truth
            </h1>

            <p
              className={cn(
                'max-w-2xl mx-auto text-lg text-muted-foreground',
                isContentVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4',
                'transition-all duration-700 ease-out delay-100',
              )}
            >
              Draw a card to explore and debunk harmful misconceptions. Each
              card reveals important truths behind common falsehoods.
            </p>

            <div
              className={cn(
                'flex items-center justify-center space-x-2 pt-4',
                isContentVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4',
                'transition-all duration-700 ease-out delay-200',
              )}
            >
              <Checkbox
                id="showPalestineStack"
                checked={showPalestineStack}
                onCheckedChange={(checked) =>
                  setShowPalestineStack(checked as boolean)
                }
              />
              <Label
                htmlFor="showPalestineStack"
                className="text-sm cursor-pointer"
              >
                Include Israel/Palestine content
              </Label>
            </div>
          </div>

          <CardDeck includePalestineStack={showPalestineStack} />
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default LegacyDeck
