'use client'

import React from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

interface StackLayoutProps {
  children: React.ReactNode
}

export default function StackLayout({ children }: StackLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl py-12">
          {children}
        </div>
      </main>
      
      <Footer />
    </div>
  )
}