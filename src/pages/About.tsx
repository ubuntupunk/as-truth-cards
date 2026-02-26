import React from 'react'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { cn } from '@/lib/utils'
import { useDelayedVisibility } from '@/utils/animations'

const About = () => {
  const isHeaderVisible = useDelayedVisibility(100)
  const isContentVisible = useDelayedVisibility(300)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow pt-24 pb-16 px-4">
        <section className="container mx-auto max-w-3xl py-12 space-y-12">
          <div className="text-center space-y-6">
            <div className="inline-block px-3 py-1 rounded-full bg-primary text-xs font-medium mb-2 animate-fade-in">
              About This Project
            </div>

            <h1
              className={cn(
                'text-4xl md:text-5xl font-medium tracking-tight',
                isHeaderVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4',
                'transition-all duration-700 ease-out',
              )}
            >
              Understanding Our Purpose
            </h1>
          </div>

          <div
            className={cn(
              'prose prose-lg max-w-none',
              isContentVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4',
              'transition-all duration-700 ease-out delay-100',
            )}
          >
            <p>
              This educational tool was created to address and debunk common
              misconceptions and harmful stereotypes about Jewish people that
              have persisted throughout history.
            </p>

            <p>
              By presenting these myths alongside factual corrections, we aim to
              promote understanding, critical thinking, and a more nuanced view
              of complex issues. The cards are designed to expose harmful
              narratives while providing evidence-based context.
            </p>

            <h2>Educational Mission</h2>

            <p>
              Our mission is to combat harmful stereotypes through education.
              Each card presents a common antisemitic trope before revealing its
              historical context and factual inaccuracies. This format
              encourages reflection on how these ideas persist and spread.
            </p>

            <p>
              The card deck format draws inspiration from tarot, but serves as
              an educational tool rather than a predictive one. By making these
              difficult topics approachable, we hope to engage people in
              thoughtful consideration of how stereotypes function and why
              they're harmful.
            </p>

            <h2>Sources & Further Reading</h2>

            <p>
              The information presented in these cards is based on historical
              research and contemporary scholarship. For those interested in
              learning more, we recommend exploring resources from:
            </p>

            <ul>
              <li>The United States Holocaust Memorial Museum</li>
              <li>The Anti-Defamation League</li>
              <li>The American Jewish Committee</li>
              <li>Academic institutions with Jewish Studies programs</li>
            </ul>

            <p>
              We encourage all users to approach these topics with an open mind
              and a commitment to fighting prejudice in all its forms.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default About
