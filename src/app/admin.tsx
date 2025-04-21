'use client' // Add this directive for client-side hooks

import { useUser } from '@stackframe/stack'
import React, { useState, useEffect } from 'react'
// import { useRouter } from 'next/navigation'; // Removed as it's no longer needed for role check
import { CardData } from '@/types/cards'
import CardList from '@/components/admin/CardList'
import CardEditor from '@/components/admin/CardEditor'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Info, Save, X } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function Admin() {
  // Correct usage of useUser hook
  const user = useUser({ or: 'redirect' })
  // const router = useRouter(); // Removed as it's no longer needed for role check

  // useEffect(() => {
  // Role check removed. Assuming roles are not directly available via useUser.
  // Authorization should ideally happen server-side or via a separate API call.
  // The useUser hook with { or: "redirect" } handles unauthenticated users.
  // }, [user]); // Dependencies removed

  const [cards, setCards] = useState<CardData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  // Declare editingCard state only once
  const [editingCard, setEditingCard] = useState<CardData | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const { toast } = useToast()

  // Fetch cards effect
  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await fetch('/api/cards')
        if (!response.ok) {
          const errorText = await response.text()
          console.error('HTTP error response text:', errorText)
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
        }
        const data: CardData[] = await response.json()
        setCards(data)
      } catch (error) {
        console.error('Failed to fetch cards:', error)
      }
    }

    fetchCards()
  }, []) // Empty dependency array ensures this runs once on mount

  const handleEdit = (card: CardData) => {
    setEditingCard(card)
  }

  const handleAddNew = async () => {
    const newId = Math.max(0, ...cards.map((c) => c.id)) + 1
    const newCard = {
      id: newId,
      title: 'New Card',
      frontDescription: '',
      backDescription: '',
      symbol: '🔄',
    }

    try {
      const response = await fetch('/api/cards', {
        // Corrected API endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCard),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('HTTP error response text:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }

      const data = await response.json()
      setCards([...cards, data])
      setEditingCard(data) // Set the new card as the editing card
    } catch (error) {
      console.error('Failed to add new card:', error)
      toast({ title: 'Error', description: 'Failed to add new card.', variant: 'destructive' })
    }
  }

  const handleSave = async (updatedCard: CardData) => {
    try {
      const response = await fetch('/api/cards', {
        // Corrected API endpoint
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedCard),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('HTTP error response text:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }

      const data = await response.json()
      setCards(cards.map((card) => (card.id === updatedCard.id ? data : card)))
      setEditingCard(null) // Close editor after saving
      toast({ title: 'Success', description: 'Card saved successfully.' })
    } catch (error) {
      console.error('Failed to save card:', error)
      toast({ title: 'Error', description: 'Failed to save card.', variant: 'destructive' })
    }
  }

  const handleDelete = async (cardId: number) => {
    try {
      const response = await fetch(`/api/cards?id=${cardId}`, {
        // Corrected API endpoint
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('HTTP error response text:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }

      setCards(cards.filter((card) => card.id !== cardId))
      toast({
        title: 'Card Deleted',
        description: 'The card has been removed',
      })
    } catch (error) {
      console.error('Failed to delete card:', error)
      toast({ title: 'Error', description: 'Failed to delete card.', variant: 'destructive' })
    }
  }

  const handleExport = () => {
    toast({
      title: 'Export Ready',
      description: 'Export functionality is not yet implemented.',
    })
  }

  const handleCancel = () => {
    setEditingCard(null)
  }

  // Render null or a loading state while user is being checked/redirected
  // The { or: "redirect" } in useUser handles the case where user is null.
  // Role check removed - relying on backend API for authorization.
  if (!user) {
    return null // Or a loading spinner while redirecting
  }

  return (
    <>
      <Header />
      <main className="flex-grow pt-24 pb-16 px-4 md:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
            <p className="text-muted-foreground">Manage the Truth Cards content from this panel.</p>
          </div>

          {editingCard ? (
            <CardEditor card={editingCard} onSave={handleSave} onCancel={handleCancel} />
          ) : (
            <CardList
              cards={cards}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAddNew}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery} // Pass setSearchQuery
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
