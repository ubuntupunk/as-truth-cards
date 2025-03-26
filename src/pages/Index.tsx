// pages/Index.tsx
import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CardDeck from '@/components/CardDeck';
import FeaturedCard from '@/components/FeaturedCard';
import HeroSection from '@/components/HeroSection';
import { cards } from '@/data/cards';

const Index = () => {
  const [showPalestineStack, setShowPalestineStack] = useState(false);
  const featuredCard = cards.find(card => card.isFeatured);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow pt-24 pb-16 px-4">
        <section className="container mx-auto max-w-4xl py-12 space-y-16">
          <HeroSection 
            showPalestineStack={showPalestineStack}
            setShowPalestineStack={setShowPalestineStack}
          />
          
          {/* Card Section with side-by-side layout on desktop */}
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
  );
};

export default Index;
