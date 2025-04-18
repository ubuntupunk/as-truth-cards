// pages/Index.tsx
import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CardDeck from '@/components/CardDeck';
import FeaturedCard from '@/components/FeaturedCard';
import HeroSection from '@/components/HeroSection';
import { cardService } from '@/services/database';
import type { CardRecord } from '@/types/database';

const Index = () => {
  const [showPalestineStack, setShowPalestineStack] = useState(false);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [featuredCard, setFeaturedCard] = useState<CardRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [allCards, featured] = await Promise.all([
          cardService.getAllCards(),
          cardService.getFeaturedCard()
        ]);
        
        setCards(allCards);
        setFeaturedCard(featured);
      } catch (error) {
        console.error('Error loading cards:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
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
              <CardDeck 
                cards={cards}
                includePalestineStack={showPalestineStack} 
              />
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
