'use client'
import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CardDeck from '../components/CardDeck'
import FeaturedCard from '../components/FeaturedCard'
import HeroSection from '../components/HeroSection'
import type { CardData } from '@/types/cards'

const Index = () => {
  const [showPalestineStack, setShowPalestineStack] = useState(false)
  // Removed unused 'cards' state: const [cards, setCards] = useState<CardData[]>([])
  const [featuredCard, setFeaturedCard] = useState<CardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        // Removed fetch for '/api/cards' as it's unused here
        const featured = await fetch('/api/cards/featured').then((res) => res.json())

        // Removed unused setCards(allCards)
        setFeaturedCard(featured)
      } catch (error) {
        console.error('Error loading featured card:', error) // Updated error message
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow pt-24 pb-16 px-4">
        <section className="container mx-auto max-w-4xl py-12 space-y-16">
          <HeroSection
            showPalestineStack={showPalestineStack}
            setShowPalestineStack={setShowPalestineStack}
          />

          <div className="grid gap-8 lg:grid-cols-2 items-start">
            <div className="w-full max-w-md mx-auto lg:max-w-none">
              <FeaturedCard featuredCard={featuredCard} />
            </div>
            <div className="w-full">
              <CardDeck includePalestineStack={showPalestineStack} />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default Index
