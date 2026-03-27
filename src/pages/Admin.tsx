import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, Save, X } from 'lucide-react'
import { useState } from 'preact/hooks'
import CardEditor from '@/components/admin/CardEditor'
import CardList from '@/components/admin/CardList'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useAdminCheck } from '@/hooks/useAdminCheck'

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

const Admin = () => {
  const { isAdmin, loading, isSignedIn } = useAdminCheck()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingCard, setEditingCard] = useState<CardData | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: cards = [], isLoading } = useQuery<CardData[]>({
    queryKey: ['cards'],
    queryFn: async () => {
      const res = await fetch('/api/cards')
      if (!res.ok) throw new Error('Failed to fetch cards')
      return res.json()
    },
    enabled: isAdmin && !loading,
  })

  const createMutation = useMutation({
    mutationFn: async (newCard: Omit<CardData, 'id'>) => {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCard),
      })
      if (!res.ok) throw new Error('Failed to create card')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      setEditingCard(null)
      toast({
        title: 'Card Created',
        description: 'The card has been created successfully',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create card',
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: CardData) => {
      const res = await fetch(`/api/cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update card')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      setEditingCard(null)
      toast({
        title: 'Card Updated',
        description: 'The card has been updated successfully',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update card',
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete card')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      toast({ title: 'Card Deleted', description: 'The card has been removed' })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete card',
        variant: 'destructive',
      })
    },
  })

  const handleEdit = (card: CardData) => {
    setEditingCard(card)
  }

  const handleAddNew = () => {
    setEditingCard({
      id: 0,
      title: 'New Card',
      frontDescription: '',
      backDescription: '',
      symbol: '🔄',
      includedInPalestineStack: false,
      isFeatured: false,
    })
  }

  const handleSave = (updatedCard: CardData) => {
    if (updatedCard.id === 0) {
      createMutation.mutate(updatedCard)
    } else {
      updateMutation.mutate(updatedCard)
    }
  }

  const handleDelete = (cardId: number) => {
    deleteMutation.mutate(cardId)
  }

  const handleExport = () => {
    setShowExportDialog(true)
    toast({
      title: 'Export Ready',
      description: 'Copy the code below to update your data file',
    })
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow pt-24 pb-16 px-4 md:px-8">
          <div className="container mx-auto max-w-4xl text-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow pt-24 pb-16 px-4 md:px-8">
        <div className="container mx-auto max-w-4xl">
          {!isSignedIn && (
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold mb-4">Sign in required</h1>
              <p className="text-muted-foreground">
                Please sign in to access the admin panel
              </p>
            </div>
          )}

          {isSignedIn && !isAdmin && (
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold mb-4">Access denied</h1>
              <p className="text-muted-foreground">
                You don't have permission to access this page
              </p>
            </div>
          )}

          {isAdmin && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
                <p className="text-muted-foreground">
                  Manage the Truth Cards content from this panel.
                </p>
              </div>

              {showExportDialog ? (
                <div className="mb-8 space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Export Data</AlertTitle>
                    <AlertDescription>
                      Copy the code below and replace the contents of{' '}
                      <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">
                        src/data/cards.ts
                      </code>
                    </AlertDescription>
                  </Alert>

                  <div className="relative">
                    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                      {`export interface CardData {
  id: number;
  title: string;
  frontDescription: string;
  backDescription: string;
  symbol: string;
}

export const cards: CardData[] = ${JSON.stringify(cards, null, 2)};`}
                    </pre>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowExportDialog(false)}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mb-8 flex justify-end">
                  <Button
                    onClick={handleExport}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Export Changes
                  </Button>
                </div>
              )}

              {editingCard ? (
                <CardEditor
                  card={editingCard}
                  onSave={handleSave}
                  onCancel={() => setEditingCard(null)}
                />
              ) : (
                <CardList
                  cards={cards}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAdd={handleAddNew}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default Admin
